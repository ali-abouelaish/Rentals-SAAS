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
  BLUE=$'\033[0;34m'
  BOLD=$'\033[1m'
  NC=$'\033[0m'
else
  RED=""; GREEN=""; BLUE=""; BOLD=""; NC=""
fi

step() { printf "%s%s==>%s %s%s%s\n" "$BLUE" "$BOLD" "$NC" "$BOLD" "$1" "$NC"; }
ok()   { printf "%s  ok%s %s\n" "$GREEN" "$NC" "$1"; }
err()  { printf "%s  !!%s %s\n" "$RED" "$NC" "$1" >&2; }

step "Checking for .next.prev on ${SSH_TARGET}"
if ! ssh "$SSH_TARGET" "test -d '${REMOTE_PATH}/.next.prev'"; then
  err "No .next.prev found at ${REMOTE_PATH}. Nothing to roll back to."
  err "Run npm run deploy at least once to create a rollback target."
  exit 1
fi
ok "Found previous build"

step "Swapping .next and .next.prev on remote"
ssh "$SSH_TARGET" "
  set -e
  cd '${REMOTE_PATH}'
  if [ -e .next.swap ]; then
    echo 'stale .next.swap exists, refusing to proceed' >&2
    exit 1
  fi
  mv .next .next.swap
  mv .next.prev .next
  mv .next.swap .next.prev
"
ok "Swap complete"

step "Reloading PM2 process: ${PM2_NAME}"
ssh "$SSH_TARGET" "pm2 reload '${PM2_NAME}'"
ok "PM2 reloaded"

printf "\n%s%sRollback complete.%s\n" "$GREEN" "$BOLD" "$NC"
printf "  The previous build is now active.\n"
printf "  Run npm run deploy again to roll forward.\n"
