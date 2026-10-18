# Auto-deploy

The server rebuilds the site every hour, in a throw-away container, and rsyncs it
into the nginx webroot. No CI deploy, no webhooks, no secrets, and **no code from
the repo runs on the host**. The same setup as umstutorial's `deploy/`, adapted to
an Astro build and to more than one instance (www and beta) on the same server.

## Why hourly, and why a container

The site is static, but part of it is not in git: the workshops, areas of interest
and floor map come from the members API (`UMS_API_URL`) and are read only when the
site is built. So the build runs every hour whether or not `main` changed. That
also picks up new commits on `main` within the hour.

Anyone who can get a commit onto `main` controls what the build does: `package.json`,
dependency install scripts, the Astro config and every page. None of that runs on
the host:

| Where     | What runs                                                         | Trust                                                |
| --------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| host      | `/usr/local/sbin/umswebb-deploy.sh` + the systemd units           | installed by root, by hand, from a reviewed checkout |
| container | `git clone` → `pnpm install --frozen-lockfile` → `pnpm build`     | untrusted; throw-away `node:22-bookworm`, non-root   |
| host      | sanity check + `rsync` into the webroot                           | trusted script again                                 |

The container gets `--read-only`, `--cap-drop ALL`, `no-new-privileges`, memory / CPU /
pid limits, a wall-clock timeout, and exactly two writable host paths: a fresh staging
dir it puts the finished site in, and a scratch dir for the clone and the package store.
Both are deleted after every run. It needs outbound network (GitHub, npm, the members
API and app). The only host environment it sees is `UMS_SITE_URL`, `UMS_API_URL` and
`UMS_APP_URL`. The worst a malicious commit can do is publish a bad site or waste
some CPU for fifteen minutes.

If the build fails — a broken commit, the API down — the webroot is not touched and
the previous site stays up.

Consequence for maintainers: **changes under `deploy/` are not picked up by the timer.**
They only take effect when root re-runs `install.sh`.

## What runs

| File                       | Purpose                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `umswebb-deploy.sh`        | Host runner. Starts the container, checks the result, rsyncs to the webroot. Single-flight per instance via `flock`. |
| `umswebb-deploy@.service`  | Oneshot template unit; `%i` is the instance. Reads `/etc/umswebb/%i.env`.              |
| `umswebb-deploy@.timer`    | `OnCalendar=hourly`, `Persistent=true`, up to 5 min random delay so instances don't collide. |
| `www.env.example`, `beta.env.example` | Starting point for `/etc/umswebb/<instance>.env`.                           |
| `install.sh`               | Installs runner + units, creates the env file if missing, pulls the image, enables the instance's timer, runs once. |
| `nginx.conf.example`       | Vhost with cache headers for Astro's hashed assets.                                     |

`/etc/umswebb/<instance>.env` holds:

| Variable       | www                                                    | beta                                |
| -------------- | ------------------------------------------------------ | ----------------------------------- |
| `REPO_URL`     | `https://github.com/uppsala-makerspace/umswebb.git`    | same                                |
| `BRANCH`       | `main`                                                 | `main`, or a branch to preview      |
| `WEBROOT`      | `/var/www/www.uppsalamakerspace.se`                    | `/var/www/beta.uppsalamakerspace.se` |
| `UMS_SITE_URL` | `https://www.uppsalamakerspace.se`                     | `https://beta.uppsalamakerspace.se` |
| `UMS_API_URL`  | `https://umsme.uppsalamakerspace.se/api/public/entries` | same                               |
| `UMS_APP_URL`  | `https://app.uppsalamakerspace.se`                     | same                                |

State is in `/var/lib/umswebb/<instance>` (staging/scratch dirs during a run,
`last-deployed-sha` after). Image `node:22-bookworm`; limits 2 GB RAM, 2 CPUs,
512 pids, 15 min.

## Publishing

Every build is a fresh clone, so every file in it is new as far as mtimes go. The
runner therefore rsyncs with `--checksum` and without `--times`: files whose content
did not change are left alone, keep their mtime, and nginx keeps handing out the
same `ETag`/`Last-Modified` for them. Changed files are put in place together at the
end (`--delay-updates`) and removed files go last (`--delete-delay`), so a page is
never served while the hashed assets it references are missing.

## One-time setup on a server

Prerequisites: `docker` (daemon running), `rsync`, `systemd`, `nginx`, `git` (for the
checkout below only). No node on the host.

```sh
# 1. Get the deploy files. Any checkout works; this one can be deleted afterwards.
git clone --depth 1 https://github.com/uppsala-makerspace/umswebb.git /root/umswebb-src

# 2. Install each instance. Creates /etc/umswebb/<instance>.env from the example,
#    enables the timer and runs a first deploy so problems surface here.
sudo /root/umswebb-src/deploy/install.sh www
sudo /root/umswebb-src/deploy/install.sh beta
```

Then set up nginx from `nginx.conf.example`, one vhost per instance, with `root`
at the instance's `WEBROOT`. On beta, keep the `X-Robots-Tag` line.

## Updating the deploy files

```sh
git -C /root/umswebb-src pull      # or a fresh clone
sudo /root/umswebb-src/deploy/install.sh www
sudo /root/umswebb-src/deploy/install.sh beta
```

Site content and code changes need none of this — the timer builds whatever is on
the branch. Changing an instance's settings is an edit to `/etc/umswebb/<instance>.env`,
picked up by the next run. Every few months, also `docker pull node:22-bookworm`
for base-image fixes (the runner only pulls when the image is missing).

## Operator commands

```sh
systemctl list-timers 'umswebb-deploy@*'          # next runs
systemctl status umswebb-deploy@www.timer          # next run + last result
journalctl -u umswebb-deploy@www -n 50            # recent deploy log
journalctl -fu umswebb-deploy@www                 # follow live
sudo systemctl start umswebb-deploy@www           # force a deploy now
cat /var/lib/umswebb/www/last-deployed-sha         # what's live
```

A run ends with `= deployed umswebb@www=<sha>`.

## Trying the runner locally

The runner is plain bash and only needs docker; you can run it against a scratch
webroot without root (the container user then has to be your own uid):

```sh
mkdir -p /tmp/dt/state /tmp/dt/webroot
STATE_DIR=/tmp/dt/state WEBROOT=/tmp/dt/webroot BUILD_UID=$(id -u) \
  deploy/umswebb-deploy.sh
```

It builds `main` from GitHub, not your working tree.

## Removing an instance

```sh
sudo systemctl disable --now umswebb-deploy@beta.timer
sudo rm -rf /var/lib/umswebb/beta /etc/umswebb/beta.env
```

When no instance is left, also remove
`/etc/systemd/system/umswebb-deploy@.{service,timer}` and
`/usr/local/sbin/umswebb-deploy.sh`, then `systemctl daemon-reload`. The webroot
stays; remove it by hand if you also want that gone.
