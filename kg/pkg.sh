#!/bin/bash
cd $(dirname $0)
pwd
source .env

# 打包 JS
ENCRYPT_PASSWORD=$ENCRYPT_PASSWORD npm run build

# 从 line.dev.html 生成 line.html
sed 's|<script type="module" src="./src/index.js"></script>|<script type="text/javascript" src="./js/index.min.js"></script>|' line.dev.html | \
sed 's|<title>KG (Dev)</title>|<title>KG</title>|' > line.html

echo "✅ Generated line.html from line.dev.html"