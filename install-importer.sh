#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "apps/api/package.json" ]]; then
  echo "Uruchom ten skrypt z katalogu głównego EventFlow_v2."
  exit 1
fi

mkdir -p apps/api/scripts
mkdir -p apps/api/import/new

cp "$(dirname "$0")/import-new-test-local.mjs" apps/api/scripts/import-new-test-local.mjs

echo
echo "Gotowe."
echo "1. Wrzuć eksporty do: apps/api/import/new/"
echo "2. cd apps/api"
echo "3. pnpm prisma generate"
echo "4. node scripts/import-new-test-local.mjs --data-dir ./import/new"
