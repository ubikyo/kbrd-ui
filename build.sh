#!/bin/sh
set -e

echo "# Bump version UI"

cd kbrd-ui

echo "# Git status"
git status

echo "# Git add ."
git add .

if git diff --cached --quiet; then
    echo "# Rien a committer, pas de bump"
    cd ..
    exit 0
fi

echo "# Git commit"
git commit -m "wip"

echo "# npm version patch"
npm version patch

cd ..