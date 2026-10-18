#!/usr/bin/env bash
# Install (or update) the umswebb deploy runner for one instance on a server.
#
# Run as root from inside a checkout of this repo — any checkout, e.g. a
# temporary clone under /root. Nothing is executed from the checkout
# afterwards: this copies the runner to /usr/local/sbin and the systemd units
# to /etc/systemd/system, and that is what runs from then on.
#
#   sudo ./deploy/install.sh www
#   sudo ./deploy/install.sh beta
#
# Idempotent: re-run whenever deploy/umswebb-deploy.sh or the units change in
# git. The hourly timer does NOT pick those changes up by itself — that is the
# point (see deploy/README.md). The instance's env file in /etc/umswebb is
# created from deploy/<instance>.env.example the first time and left alone
# after that, so local edits survive.
#
# Env overrides: UNIT_DIR, BIN_DIR, CONF_DIR, IMAGE, RUN_NOW=0 to skip the
# first deploy.

set -euo pipefail

UNIT_DIR=${UNIT_DIR:-/etc/systemd/system}
BIN_DIR=${BIN_DIR:-/usr/local/sbin}
CONF_DIR=${CONF_DIR:-/etc/umswebb}
IMAGE=${IMAGE:-node:22-bookworm}
RUN_NOW=${RUN_NOW:-1}

step() { printf '\n→ %s\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

instance=${1:-}
[[ "$instance" =~ ^[a-z0-9-]+$ ]] || fail "usage: $0 <instance>   (e.g. www or beta)"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner_src="$here/umswebb-deploy.sh"
service_src="$here/umswebb-deploy@.service"
timer_src="$here/umswebb-deploy@.timer"
env_src="$here/$instance.env.example"
env_dst="$CONF_DIR/$instance.env"
unit="umswebb-deploy@$instance"

[[ $EUID -eq 0 ]] || fail "run as root (or with sudo)"
for f in "$runner_src" "$service_src" "$timer_src"; do
  [[ -f "$f" ]] || fail "missing $f — run from a checkout of the repo"
done

step "checking prerequisites"
for c in docker rsync timeout flock mktemp systemctl install; do
  command -v "$c" >/dev/null || fail "missing required command: $c"
done
docker info >/dev/null 2>&1 || fail "docker daemon not reachable — is docker installed and running?"
ok "docker, rsync, systemd present"

step "installing runner to $BIN_DIR"
install -m 0755 -o root -g root "$runner_src" "$BIN_DIR/umswebb-deploy.sh"
ok "$BIN_DIR/umswebb-deploy.sh"

step "installing systemd units to $UNIT_DIR"
install -m 0644 -o root -g root "$service_src" "$UNIT_DIR/umswebb-deploy@.service"
install -m 0644 -o root -g root "$timer_src"   "$UNIT_DIR/umswebb-deploy@.timer"
ok "umswebb-deploy@.service, umswebb-deploy@.timer"

step "configuration for $instance"
install -d -m 0755 -o root -g root "$CONF_DIR"
if [[ -f "$env_dst" ]]; then
  ok "$env_dst exists, left as is"
else
  [[ -f "$env_src" ]] || fail "no $env_dst and no $env_src to start it from — write $env_dst by hand"
  install -m 0644 -o root -g root "$env_src" "$env_dst"
  ok "$env_dst created from $(basename "$env_src") — check it"
fi
sed -e '/^#/d' -e '/^$/d' -e 's/^/    /' "$env_dst"

step "pulling build image $IMAGE"
docker pull --quiet "$IMAGE" >/dev/null
ok "image present"

step "systemctl daemon-reload + enable $unit.timer"
systemctl daemon-reload
systemctl enable --now "$unit.timer"
ok "timer enabled"
systemctl status --no-pager "$unit.timer" | head -8 || true

if [[ "$RUN_NOW" == "1" ]]; then
  step "running first deploy synchronously (a few minutes on a cold image)"
  if systemctl start "$unit.service"; then
    ok "first deploy completed"
  else
    journalctl -u "$unit.service" -n 80 --no-pager || true
    fail "first deploy failed — see the log above"
  fi
fi

cat <<EOF

install complete.

  status:  systemctl status $unit.timer
  logs:    journalctl -u $unit.service -n 50 --no-pager
  follow:  journalctl -fu $unit.service
  force:   systemctl start $unit.service
  config:  $env_dst
  update:  git pull in a checkout, then re-run this script
EOF
