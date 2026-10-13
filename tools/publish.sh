#!/usr/bin/env bash
# Commit everything and push to GitHub Pages (branch main, root).
set -euo pipefail
cd "$(dirname "$0")/.."
node --check game.js
git add -A
git commit -m "${1:-Update}" || true
git push origin main
echo "Live in ~1 min: https://pippopoppi.github.io/racism2/"
