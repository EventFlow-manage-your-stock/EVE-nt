# Komendy V43

```bash
set -e

PATCH_ZIP="$HOME/Downloads/EventFlow_Product_Polish_v43_patch.zip"
PROJECT_DIR="$HOME/Desktop/EventFlow"
PATCH_DIR="/tmp/eventflow_patch_v43"

rm -rf "$PATCH_DIR"
mkdir -p "$PATCH_DIR"

unzip "$PATCH_ZIP" -d "$PATCH_DIR"

rsync -av --progress "$PATCH_DIR/" "$PROJECT_DIR/"

cd "$PROJECT_DIR"
git status
```

Frontend:

```bash
cd ~/Desktop/EventFlow

NEXT_PUBLIC_API_URL="http://localhost:3002/api" \
pnpm --filter web dev
```
