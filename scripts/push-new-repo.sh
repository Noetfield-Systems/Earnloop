#!/usr/bin/env bash
set -euo pipefail
# Requires GitHub auth through the developer's normal SSH/keychain setup.
# Create the existing public Noetfield-Systems/Earnloop repo on github.com first.
REPO="git@github.com:Noetfield-Systems/Earnloop.git"
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "$REPO"; fi
if [ "$(git remote get-url origin)" != "$REPO" ]; then echo 'Origin differs from intended new repo — refusing to push' >&2; exit 1; fi
npm run verify
git push -u origin main
