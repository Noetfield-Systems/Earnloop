#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v gh >/dev/null; then
  echo 'GitHub CLI is required. Install from https://cli.github.com/ and run gh auth login.' >&2
  echo 'Alternative: create an EMPTY private Noetfield-Systems/Earnloop repo at https://github.com/organizations/Noetfield-Systems/repositories/new then run ./scripts/push-new-repo.sh' >&2
  exit 2
fi
npm run verify
if gh repo view Noetfield-Systems/Earnloop >/dev/null 2>&1; then
  echo 'Repository already exists. Run scripts/push-new-repo.sh.'
  exit 0
fi
gh repo create Noetfield-Systems/Earnloop --private --source=. --remote=origin --push
