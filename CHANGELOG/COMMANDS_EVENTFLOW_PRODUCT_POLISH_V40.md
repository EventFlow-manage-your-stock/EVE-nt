# Komendy V40

```bash
set -e

PATCH_ZIP="$HOME/Downloads/EventFlow_Product_Polish_v40_patch.zip"
PROJECT_DIR="$HOME/Desktop/EventFlow"
PATCH_DIR="/tmp/eventflow_patch_v40"

rm -rf "$PATCH_DIR"
mkdir -p "$PATCH_DIR"

unzip "$PATCH_ZIP" -d "$PATCH_DIR"
rsync -av --progress "$PATCH_DIR/" "$PROJECT_DIR/"

cd "$PROJECT_DIR/apps/api"

pnpm exec prisma format --schema=prisma/schema.prisma

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
  pnpm exec prisma generate --schema=prisma/schema.prisma
```
