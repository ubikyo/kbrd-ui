#!/bin/sh

set -e

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "# Build Web"
npm run build

echo "# Git status"
git status

echo "# Git add ."
git add .

if git diff --cached --quiet; then
    echo "# Rien a committer, pas de bump"
    exit 0
fi

echo "# Git commit"
git commit -m "wip"
