#!/bin/zsh
set -euo pipefail

PROJECT_DIR="${0:A:h}"
NODE_DIR="/Users/yerlen/.nvm/versions/node/v22.23.1/bin"

export PATH="${NODE_DIR}:${PATH}"
cd "${PROJECT_DIR}"

"${NODE_DIR}/node" node_modules/typescript/bin/tsc -b
"${NODE_DIR}/node" node_modules/vite/bin/vite.js build
exec "${NODE_DIR}/node" node_modules/wrangler/bin/wrangler.js pages dev dist --port 5173 --ip 127.0.0.1
