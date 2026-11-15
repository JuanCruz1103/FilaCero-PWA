#!/bin/sh
set -eu
cd "$(dirname "$0")"
echo "FilaCero: abre http://localhost:3000"
exec node server/index.mjs
