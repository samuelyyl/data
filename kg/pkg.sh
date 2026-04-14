#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo "缺少 .env 文件" >&2
  exit 1
fi

set -a
source .env
set +a

# 打包 JS
npm run build

# 从 line.dev.html 生成 line.html
sed 's|<script type="module" src="./src/index.js"></script>|<script type="text/javascript" src="./js/index.min.js"></script>|' line.dev.html | \
sed 's|<title>KG (Dev)</title>|<title>KG</title>|' > line.html

echo "✅ Generated line.html from line.dev.html"
