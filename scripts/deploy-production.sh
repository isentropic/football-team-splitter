#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
npm run build
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/nomads-production.XXXXXX")"
trap 'rm -rf "$DEPLOY_DIR"' EXIT
cp wrangler.production.toml "$DEPLOY_DIR/wrangler.toml"
cp -R dist functions "$DEPLOY_DIR/"
mkdir -p "$DEPLOY_DIR/src"
cp -R src/lib "$DEPLOY_DIR/src/lib"
COMMIT_SHA="$(git rev-parse HEAD)"
cd "$DEPLOY_DIR"
node "$PROJECT_DIR/node_modules/wrangler/bin/wrangler.js" pages deploy dist --project-name seoulnomads --branch main --commit-hash "$COMMIT_SHA"
