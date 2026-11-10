#!/usr/bin/env bash
# Run the Playwright suite (visual snapshots and axe) in the same pinned Linux container as CI,
# so the baselines match pixel for pixel. Extra arguments go to `playwright test`, for example
# `--update-snapshots` after an intended change. Needs Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./node_modules/@playwright/test/package.json').version")
exec docker run --rm --ipc=host \
    -v "$PWD":/work -v cbox-ui-visual-node-modules:/work/node_modules -w /work \
    -e CI=1 \
    "mcr.microsoft.com/playwright:v${version}-noble" \
    bash -c 'npm install -g bun@1.3.14 >/dev/null 2>&1 && bun install --frozen-lockfile >/dev/null && bunx playwright test "$@"' -- "$@"
