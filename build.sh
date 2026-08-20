#!/bin/sh

set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "# Bump version Web"

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

echo "# npm version patch"
npm version patch