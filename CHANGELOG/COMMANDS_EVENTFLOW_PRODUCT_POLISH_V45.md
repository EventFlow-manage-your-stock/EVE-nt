# Komendy V45

```bash
set -e

PATCH_ZIP="$HOME/Downloads/EventFlow_Product_Polish_v45_patch.zip"
PROJECT_DIR="$HOME/Desktop/EventFlow"
PATCH_DIR="/tmp/eventflow_patch_v45"

rm -rf "$PATCH_DIR"
mkdir -p "$PATCH_DIR"

unzip "$PATCH_ZIP" -d "$PATCH_DIR"

rsync -av --progress "$PATCH_DIR/" "$PROJECT_DIR/"

cd "$PROJECT_DIR/apps/api"

pnpm exec prisma format --schema=prisma/schema.prisma

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma generate --schema=prisma/schema.prisma
```

API:

```bash
cd ~/Desktop/EventFlow

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
PORT=3002 \
pnpm --filter api dev
```

Frontend:

```bash
cd ~/Desktop/EventFlow

rm -rf apps/web/.next

NEXT_PUBLIC_API_URL="http://localhost:3002/api" \
pnpm --filter web dev
```
