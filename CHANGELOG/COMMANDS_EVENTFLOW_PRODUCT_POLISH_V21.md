# Komendy wdrożenia V21

```bash
set -e

PATCH_ZIP="$HOME/Downloads/EventFlow_Product_Polish_v21_patch.zip"
DESKTOP="$HOME/Desktop"
PROJECT_DIR="$DESKTOP/EventFlow"
PATCH_DIR="/tmp/eventflow_patch_v21"

cd "$DESKTOP"

if [ ! -f "$PATCH_ZIP" ]; then
  echo "Nie znaleziono patcha: $PATCH_ZIP"
  exit 1
fi

if [ -d "EventFlow" ]; then
  mv EventFlow "EventFlow_backup_$(date +%Y%m%d_%H%M%S)"
fi

git clone https://github.com/EventFlow-manage-your-stock/EventFlow.git EventFlow

cd "$PROJECT_DIR"

git checkout -b local/product-polish-v21

rm -rf "$PATCH_DIR"
mkdir -p "$PATCH_DIR"

unzip "$PATCH_ZIP" -d "$PATCH_DIR"

rsync -av --progress "$PATCH_DIR/" "$PROJECT_DIR/"

git status

pnpm install --force

cd "$PROJECT_DIR/apps/api"

cat > .env <<'ENVEOF'
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db"
JWT_SECRET="dev_secret_123"
API_PORT=3002
PORT=3002
ENVEOF

cp prisma/schema.prisma "prisma/schema.prisma.backup_$(date +%Y%m%d_%H%M%S)"

pnpm exec prisma format --schema=prisma/schema.prisma

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma db push --schema=prisma/schema.prisma

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma generate --schema=prisma/schema.prisma

cd "$PROJECT_DIR"
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

NEXT_PUBLIC_API_URL="http://localhost:3002/api" \
pnpm --filter web dev
```

