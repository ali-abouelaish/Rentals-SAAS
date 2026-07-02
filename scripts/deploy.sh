#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="root"
REMOTE_HOST="187.124.112.229"
REMOTE_PATH="/var/www/harborops/Rentals-SAAS"
PM2_NAME="harborops"
SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

# Health check (run on the VPS against the local PM2 process after reload).
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_RETRIES=10
HEALTH_DELAY=3

ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done
# Env escape hatch for CI / non-interactive runs.
if [ "${DEPLOY_YES:-0}" = "1" ]; then ASSUME_YES=1; fi

if [ -t 1 ]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'
  BOLD=$'\033[1m'
  NC=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; NC=""
fi

step() { printf "%s%s==>%s %s%s%s\n" "$BLUE" "$BOLD" "$NC" "$BOLD" "$1" "$NC"; }
ok()   { printf "%s  ok%s %s\n" "$GREEN" "$NC" "$1"; }
warn() { printf "%s  !!%s %s\n" "$YELLOW" "$NC" "$1"; }
err()  { printf "%s  !!%s %s\n" "$RED" "$NC" "$1" >&2; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Windows / cwRsync compatibility.
# Chocolatey's rsync is Cygwin-based; if it spawns a non-Cygwin ssh (Git Bash's
# MSYS ssh or Windows OpenSSH) it dies with "dup() in/out/err failed". Pin
# RSYNC_RSH to the ssh bundled with cwRsync, and disable MSYS path mangling so
# the remote "host:/path" spec is passed through untouched. No-op on macOS/Linux.
# ---------------------------------------------------------------------------
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS_NO_PATHCONV=1
    CWRSYNC_SSH_WIN="/c/ProgramData/chocolatey/lib/rsync/tools/bin/ssh.exe"
    CWRSYNC_SSH_CYG="/cygdrive/c/ProgramData/chocolatey/lib/rsync/tools/bin/ssh"
    if [ ! -e "$CWRSYNC_SSH_WIN" ]; then
      err "cwRsync ssh not found at C:\\\\ProgramData\\\\chocolatey\\\\lib\\\\rsync\\\\tools\\\\bin\\\\ssh.exe"
      err "Install rsync with 'choco install rsync' (elevated), or edit CWRSYNC_SSH_* in this script."
      exit 1
    fi
    # Git Bash HOME (/c/Users/x) -> Cygwin path (/cygdrive/c/Users/x) so the
    # Cygwin ssh resolves the key and known_hosts.
    CYG_HOME="$(printf '%s' "$HOME" | sed -E 's#^/([a-zA-Z])/#/cygdrive/\1/#')"
    RSYNC_RSH="$CWRSYNC_SSH_CYG -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${CYG_HOME}/.ssh/known_hosts"
    [ -f "$HOME/.ssh/id_ed25519" ] && RSYNC_RSH="$RSYNC_RSH -i ${CYG_HOME}/.ssh/id_ed25519"
    export RSYNC_RSH
    ;;
esac

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

# ---------------------------------------------------------------------------
# Push guard: surface anything that means the remote branch != what you deploy.
# ---------------------------------------------------------------------------
step "Checking working tree and branch state"
GUARD_WARNINGS=0

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  warn "Working tree has uncommitted changes (these are deployed via the local build but are NOT pushed)."
  GUARD_WARNINGS=$((GUARD_WARNINGS + 1))
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")"
if [ -z "$UPSTREAM" ]; then
  warn "Branch '${GIT_BRANCH}' has no upstream — cannot tell if it is pushed."
  GUARD_WARNINGS=$((GUARD_WARNINGS + 1))
else
  AHEAD="$(git rev-list --count "${UPSTREAM}..HEAD" 2>/dev/null || echo 0)"
  if [ "${AHEAD:-0}" -gt 0 ]; then
    warn "Local '${GIT_BRANCH}' is ${AHEAD} commit(s) ahead of '${UPSTREAM}' — push first if you want the deployed code on the remote."
    GUARD_WARNINGS=$((GUARD_WARNINGS + 1))
  fi
fi

if [ "$GUARD_WARNINGS" -eq 0 ]; then
  ok "Working tree clean and branch up to date with ${UPSTREAM}"
fi

# ---------------------------------------------------------------------------
# Confirmation: show exactly what is about to happen and require sign-off.
# ---------------------------------------------------------------------------
printf "\n%sAbout to deploy:%s\n" "$BOLD" "$NC"
printf "  branch: %s\n" "$GIT_BRANCH"
printf "  sha:    %s\n" "$GIT_SHA"
printf "  target: %s:%s\n" "$SSH_TARGET" "$REMOTE_PATH"
printf "  pm2:    %s\n\n" "$PM2_NAME"

if [ "$ASSUME_YES" -eq 1 ]; then
  ok "Confirmation skipped (-y / DEPLOY_YES)"
elif [ ! -t 0 ]; then
  err "Not an interactive terminal and -y was not passed. Re-run with -y to confirm."
  exit 1
else
  printf "Proceed? [y/N] "
  read -r REPLY
  case "$REPLY" in
    y|Y|yes|YES) ;;
    *) err "Aborted by user."; exit 1 ;;
  esac
fi

step "Building locally"
npm run build
ok "Local build complete"

step "Reading remote package-lock.json checksum (before rsync)"
LOCK_SUM_BEFORE="$(ssh "$SSH_TARGET" "if [ -f '${REMOTE_PATH}/package-lock.json' ]; then sha256sum '${REMOTE_PATH}/package-lock.json' | awk '{print \$1}'; else echo missing; fi")"
ok "before: ${LOCK_SUM_BEFORE}"

step "Backing up remote .next to .next.prev"
BACKUP_RESULT="$(ssh "$SSH_TARGET" "
  set -e
  cd '${REMOTE_PATH}'
  if [ -d .next ]; then
    rm -rf .next.prev
    cp -a .next .next.prev
    echo 'backup_created'
  else
    echo 'no_existing_next'
  fi
")"
if [ "$BACKUP_RESULT" = "backup_created" ]; then
  ok "Backup created (.next.prev)"
else
  warn "No existing .next on remote — no rollback target for this deploy"
fi

step "Rsyncing .next/ (excluding cache, with --delete)"
rsync -az --delete --exclude='cache' --exclude='cache/**' \
  .next/ "${SSH_TARGET}:${REMOTE_PATH}/.next/"
ok ".next synced"

step "Rsyncing public/ (with --delete)"
rsync -az --delete public/ "${SSH_TARGET}:${REMOTE_PATH}/public/"
ok "public synced"

step "Rsyncing package.json, package-lock.json, next.config.mjs"
rsync -az package.json package-lock.json next.config.mjs "${SSH_TARGET}:${REMOTE_PATH}/"
ok "manifests synced"

step "Reading remote package-lock.json checksum (after rsync)"
LOCK_SUM_AFTER="$(ssh "$SSH_TARGET" "sha256sum '${REMOTE_PATH}/package-lock.json' | awk '{print \$1}'")"
ok "after:  ${LOCK_SUM_AFTER}"

if [ "$LOCK_SUM_BEFORE" != "$LOCK_SUM_AFTER" ]; then
  step "package-lock.json changed, running npm ci --omit=dev on VPS"
  ssh "$SSH_TARGET" "cd '${REMOTE_PATH}' && npm ci --omit=dev"
  ok "Remote dependencies installed"
else
  ok "package-lock.json unchanged, skipping npm ci"
fi

step "Reloading PM2 process: ${PM2_NAME}"
ssh "$SSH_TARGET" "pm2 reload '${PM2_NAME}' --update-env"
ok "PM2 reloaded"

# ---------------------------------------------------------------------------
# Health check: confirm the app actually serves traffic after the reload.
# A reachable HTTP response under 500 means the Node process booted cleanly.
# ---------------------------------------------------------------------------
auto_rollback() {
  if [ "$BACKUP_RESULT" != "backup_created" ]; then
    err "No .next.prev backup exists for this deploy — cannot auto-roll back."
    err "Inspect the app manually: ssh ${SSH_TARGET} 'pm2 logs ${PM2_NAME}'"
    return 1
  fi
  step "Rolling back to previous build (.next.prev)"
  ssh "$SSH_TARGET" "
    set -e
    cd '${REMOTE_PATH}'
    rm -rf .next.broken
    mv .next .next.broken
    mv .next.prev .next
    mv .next.broken .next.prev
    pm2 reload '${PM2_NAME}' --update-env
  "
  warn "Rolled back. The previous build is active again; the failed build is kept at .next.prev."
}

step "Health checking ${HEALTH_URL} on the VPS (up to ${HEALTH_RETRIES} tries)"
HEALTH_OK=0
HEALTH_CODE=""
for i in $(seq 1 "$HEALTH_RETRIES"); do
  HEALTH_CODE="$(ssh "$SSH_TARGET" "curl -sS -o /dev/null -w '%{http_code}' --max-time 5 '${HEALTH_URL}' 2>/dev/null || echo 000")"
  HEALTH_CODE="${HEALTH_CODE:-000}"        # ssh/network failure -> empty
  case "$HEALTH_CODE" in *[!0-9]*) HEALTH_CODE=000 ;; esac  # keep it numeric
  if [ "$HEALTH_CODE" != "000" ] && [ "$HEALTH_CODE" -lt 500 ]; then
    HEALTH_OK=1
    ok "App healthy (HTTP ${HEALTH_CODE}) after ${i} try(s)"
    break
  fi
  warn "attempt ${i}/${HEALTH_RETRIES}: HTTP ${HEALTH_CODE} — retrying in ${HEALTH_DELAY}s"
  sleep "$HEALTH_DELAY"
done

if [ "$HEALTH_OK" -ne 1 ]; then
  err "Health check failed (last status: HTTP ${HEALTH_CODE})."
  auto_rollback || true
  exit 1
fi

printf "\n%s%sDeploy complete.%s\n" "$GREEN" "$BOLD" "$NC"
printf "  branch: %s\n" "$GIT_BRANCH"
printf "  sha:    %s\n" "$GIT_SHA"
printf "  target: %s:%s\n" "$SSH_TARGET" "$REMOTE_PATH"
