#!/bin/sh

set -e

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_DIR"

npm install
npm run dev
