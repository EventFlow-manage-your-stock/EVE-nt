# Komendy wdrożeniowe V5 — macOS

Zakładamy, że ZIP jest pobrany do `~/Downloads/EventFlow_Product_Polish_v5_patch.zip`.

```bash
cd ~/Desktop

if [ -d "EventFlow" ]; then
  mv EventFlow "EventFlow_backup_$(date +%Y%m%d_%H%M%S)"
fi

git clone https://github.com/EventFlow-manage-your-stock/EventFlow.git EventFlow
cd EventFlow
git checkout -b local/product-polish-v5

rm -rf /tmp/eventflow_patch_v5
mkdir -p /tmp/eventflow_patch_v5
unzip ~/Downloads/EventFlow_Product_Polish_v5_patch.zip -d /tmp/eventflow_patch_v5

rsync -av --progress /tmp/eventflow_patch_v5/ ~/Desktop/EventFlow/

pnpm install --force

cd apps/api
cat > .env <<'ENV'
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db"
JWT_SECRET="dev_secret_123"
API_PORT=3002
PORT=3002
ENV

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma db push --schema=prisma/schema.prisma

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

Web:

```bash
cd ~/Desktop/EventFlow
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm --filter web dev
```

Test kalendarza:

```bash
curl -i "http://localhost:3002/api/kalendarz?od=2026-06-30&do=2026-08-06"
```

Oczekiwane bez tokena: `401 Unauthorized`, nie `Cannot GET`.
