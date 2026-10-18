#!/usr/bin/env bash
# Host-side deploy runner for umswebb.
#
# Installed by root to /usr/local/sbin/umswebb-deploy.sh and run hourly, once
# per instance (www, beta), by the systemd template units. This file is the
# ONLY code on the host that the deploy trusts. Everything from the repository —
# package.json, the Astro build, the code that fetches the members API — runs
# inside a throw-away Docker container that can write to exactly two host
# directories: the staging dir it hands back the site in, and a scratch dir for
# the clone and the package store. When the container exits, this script
# sanity-checks the result and rsyncs it into the webroot.
#
# The build runs every hour whether or not main has changed, because the site
# also carries the workshops and areas of interest from the members API, and
# that is only read at build time.
#
# The copy in the git repo (deploy/umswebb-deploy.sh) is the source of truth
# for maintenance, but it is NOT executed from the checkout and NOT picked up
# automatically. Re-run deploy/install.sh as root to roll out a change to this
# file. See deploy/README.md for the threat model.
#
# Configured via env (defaults below); /etc/umswebb/<instance>.env sets the
# values for an instance.

set -euo pipefail

INSTANCE=${INSTANCE:-www}
REPO_URL=${REPO_URL:-https://github.com/uppsala-makerspace/umswebb.git}
BRANCH=${BRANCH:-main}
WEBROOT=${WEBROOT:-/var/www/www.uppsalamakerspace.se}
STATE_DIR=${STATE_DIR:-/var/lib/umswebb/$INSTANCE}
# Lock lives in our own dir, not /run/lock: that one is world-writable with
# the sticky bit, and fs.protected_regular refuses to open a file there that
# another user created — root included.
LOCK=${LOCK:-$STATE_DIR/deploy.lock}

# What the build talks to and what URL it belongs to. These, and nothing else
# from the host environment, are passed into the container.
UMS_SITE_URL=${UMS_SITE_URL:-https://www.uppsalamakerspace.se}
UMS_API_URL=${UMS_API_URL:-https://umsme.uppsalamakerspace.se/api/public/entries}
UMS_APP_URL=${UMS_APP_URL:-https://app.uppsalamakerspace.se}

IMAGE=${IMAGE:-node:22-bookworm}
BUILD_TIMEOUT=${BUILD_TIMEOUT:-15m}
BUILD_UID=${BUILD_UID:-1000}       # the `node` user in the official image
BUILD_MEMORY=${BUILD_MEMORY:-2g}
BUILD_CPUS=${BUILD_CPUS:-2}
BUILD_PIDS=${BUILD_PIDS:-512}
# Owner for files in the webroot. Default: whoever owns the webroot today, or
# root:root if it doesn't exist yet.
WEBROOT_OWNER=${WEBROOT_OWNER:-}

step() { printf '\n→ %s\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

[[ "$INSTANCE" =~ ^[a-z0-9-]+$ ]] || fail "bad INSTANCE: $INSTANCE"

step "deploy starting ($INSTANCE)"
echo "  REPO_URL = $REPO_URL @ $BRANCH"
echo "  WEBROOT  = $WEBROOT"
echo "  SITE     = $UMS_SITE_URL"
echo "  API      = $UMS_API_URL"
echo "  APP      = $UMS_APP_URL"
echo "  IMAGE    = $IMAGE"
echo "  user     = $(id -un) ($(id -u))"

for c in docker rsync timeout flock mktemp; do
  command -v "$c" >/dev/null || fail "missing required command: $c"
done
docker info >/dev/null 2>&1 || fail "cannot talk to the docker daemon"

# Single-flight per instance: if another run is in progress, exit 0 quietly so
# the timer doesn't pile up failures.
mkdir -p "$(dirname "$LOCK")" "$STATE_DIR"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "  another deploy of $INSTANCE is running; skipping"
  exit 0
fi

# Two host dirs the container may write, both created empty every run and
# removed on exit, success or not:
#   STAGE   /out   — the finished site, picked up by rsync below
#   SCRATCH /work  — clone, node_modules, pnpm store, corepack, TMPDIR
STAGE=$(mktemp -d "$STATE_DIR/stage.XXXXXX")
SCRATCH=$(mktemp -d "$STATE_DIR/scratch.XXXXXX")
cleanup() { rm -rf "$STAGE" "$SCRATCH"; }
trap cleanup EXIT
chown "$BUILD_UID:$BUILD_UID" "$STAGE" "$SCRATCH"
chmod 0700 "$STAGE" "$SCRATCH"
mkdir -p "$SCRATCH/tmp" && chown "$BUILD_UID:$BUILD_UID" "$SCRATCH/tmp"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  step "pulling $IMAGE"
  docker pull --quiet "$IMAGE"
fi

# What runs inside the container. Deliberately inline here rather than in the
# repo: the repo is untrusted input, this script is not. Shallow clone of the
# requested branch, install deps with the pnpm version pinned in package.json
# (install scripts included — that is exactly what we are sandboxing), build,
# hand back dist/ plus the SHA.
read -r -d '' BUILD_SCRIPT <<'EOF' || true
set -euo pipefail
mkdir -p /work/bin
corepack enable --install-directory /work/bin pnpm
export PATH="/work/bin:$PATH"
git clone --quiet --depth 1 --branch "$BRANCH" -- "$REPO_URL" src
cd src
sha=$(git rev-parse HEAD)
echo "umswebb at $sha"
echo "node $(node --version), pnpm $(pnpm --version)"
pnpm install --frozen-lockfile
pnpm build
cp -a dist/. /out/
echo "$sha" > /out/.deployed-sha
EOF

step "building in container (timeout $BUILD_TIMEOUT)"
# --read-only: the image filesystem is immutable; the only writable paths are
# the two bind mounts and a small tmpfs /tmp as a safety net. TMPDIR points
# into the scratch mount so git, pnpm and Astro all land there.
timeout --kill-after=30s "$BUILD_TIMEOUT" \
  docker run --rm --init \
    --name "umswebb-build-$INSTANCE" \
    --user "$BUILD_UID:$BUILD_UID" \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --read-only \
    --tmpfs /tmp:rw,nosuid,size=64m,uid="$BUILD_UID",gid="$BUILD_UID" \
    --memory "$BUILD_MEMORY" --cpus "$BUILD_CPUS" --pids-limit "$BUILD_PIDS" \
    --network bridge \
    --mount "type=bind,src=$SCRATCH,dst=/work" \
    --mount "type=bind,src=$STAGE,dst=/out" \
    -e HOME=/work -e TMPDIR=/work/tmp \
    -e COREPACK_HOME=/work/.corepack -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    -e npm_config_store_dir=/work/.pnpm-store \
    -e CI=true -e ASTRO_TELEMETRY_DISABLED=1 \
    -e REPO_URL="$REPO_URL" -e BRANCH="$BRANCH" \
    -e UMS_SITE_URL="$UMS_SITE_URL" -e UMS_API_URL="$UMS_API_URL" -e UMS_APP_URL="$UMS_APP_URL" \
    -w /work \
    "$IMAGE" bash -c "$BUILD_SCRIPT" \
  || fail "container build failed (exit $?)"
ok "container finished"

step "checking build output"
# The build already fails when the members API can't be read, but check that
# what came back is a whole site, API data included, before it goes live.
[[ -f "$STAGE/index.html" ]] || fail "no index.html in build output — refusing to publish"
[[ -f "$STAGE/vad-vi-gor/index.html" ]] || fail "no vad-vi-gor/index.html in build output — refusing to publish"
[[ -n "$(ls -A "$STAGE/ums-data" 2>/dev/null)" ]] || fail "no ums-data/ in build output — refusing to publish"
[[ -s "$STAGE/.deployed-sha" ]] || fail "no .deployed-sha in build output"
sha=$(tr -cd '0-9a-f' < "$STAGE/.deployed-sha")
[[ ${#sha} -eq 40 ]] || fail "malformed .deployed-sha"
mv "$STAGE/.deployed-sha" "$STATE_DIR/last-deployed-sha"   # keep it out of the webroot
ok "output looks sane ($(find "$STAGE" -type f | wc -l) files)"

step "publishing to $WEBROOT"
if [[ -z "$WEBROOT_OWNER" ]]; then
  if [[ -d "$WEBROOT" ]]; then
    WEBROOT_OWNER=$(stat -c '%u:%g' "$WEBROOT")
  else
    WEBROOT_OWNER=root:root
  fi
fi
mkdir -p "$WEBROOT"
# Every build is a fresh clone, so every file has a new mtime. --checksum
# without --times compares content instead and leaves unchanged files alone:
# otherwise ~200 MB would be rewritten every hour and nginx would hand out new
# ETag/Last-Modified for all of it, defeating visitors' caches.
#
# --delay-updates puts changed files in place together at the end, and
# --delete-delay removes old ones only after that, so a page is never served
# while the hashed assets it references are missing.
rsync -rlpog --checksum --delay-updates --delete-delay \
  --chown="$WEBROOT_OWNER" --chmod=D0755,F0644 \
  "$STAGE"/ "$WEBROOT"/
ok "published"

printf '\n= deployed umswebb@%s=%s\n' "$INSTANCE" "$sha"
