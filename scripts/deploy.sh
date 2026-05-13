#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="root"
REMOTE_HOST="187.124.112.229"
REMOTE_PATH="/var/www/harborops/Rentals-SAAS"
PM2_NAME="harborops"
SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

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

step "Building locally"
npm run build
ok "Local build complete"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

step "Reading remote package-lock.json checksum (before rsync)"
LOCK_SUM_BEFORE="$(ssh "$SSH_TARGET" "if [ -f '${REMOTE_PATH}/package-lock.json' ]; then sha256sum '${REMOTE_PATH}/package-lock.json' | awk '{print \$1}'; else echo missing; fi")"
ok "before: ${LOCK_SUM_BEFORE}"

step "Backing up remote .next to .next.prev"
ssh "$SSH_TARGET" "
  set -e
  cd '${REMOTE_PATH}'
  if [ -d .next ]; then
    rm -rf .next.prev
    cp -a .next .next.prev
    echo 'backup_created'
  else
    echo 'no_existing_next'
  fi
"
ok "Backup step done"

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

printf "\n%s%sDeploy complete.%s\n" "$GREEN" "$BOLD" "$NC"
printf "  branch: %s\n" "$GIT_BRANCH"
printf "  sha:    %s\n" "$GIT_SHA"
printf "  target: %s:%s\n" "$SSH_TARGET" "$REMOTE_PATH"
