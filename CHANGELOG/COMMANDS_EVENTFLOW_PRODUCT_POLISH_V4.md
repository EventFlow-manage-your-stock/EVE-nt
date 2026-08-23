# Komendy - EventFlow Product Polish V4

Zakładam, że ZIP jest w `~/Downloads/EventFlow_Product_Polish_v4_patch.zip`.

```bash
cd ~/Desktop

if [ -d "EventFlow" ]; then
  mv EventFlow "EventFlow_backup_$(date +%Y%m%d_%H%M%S)"
fi

git clone https://github.com/EventFlow-manage-your-stock/EventFlow.git EventFlow
cd EventFlow
git checkout -b local/product-polish-v4

rm -rf /tmp/eventflow_patch_v4
mkdir -p /tmp/eventflow_patch_v4
unzip ~/Downloads/EventFlow_Product_Polish_v4_patch.zip -d /tmp/eventflow_patch_v4

# WAŻNE: rsync scala pliki i nie kasuje reszty folderów.
rsync -av --progress /tmp/eventflow_patch_v4/ ~/Desktop/EventFlow/

git status
pnpm install --force
```

API `.env`:

```bash
cd ~/Desktop/EventFlow/apps/api
cat > .env <<'ENV'
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db"
JWT_SECRET="dev_secret_123"
API_PORT=3002
PORT=3002
ENV
```

Prisma:

```bash
cd ~/Desktop/EventFlow/apps/api
pnpm exec prisma migrate dev --schema=prisma/schema.prisma --name eventflow_product_polish_v4
pnpm exec prisma generate --schema=prisma/schema.prisma
```

Jeżeli używasz istniejącej bazy i migracje się gryzą, wykonaj ręcznie SQL z:
`apps/api/prisma/migrations/20260711153000_eventflow_product_polish_v4/migration.sql`, potem:

```bash
pnpm exec prisma db pull --schema=prisma/schema.prisma
pnpm exec prisma generate --schema=prisma/schema.prisma
```

Odpalanie:

```bash
# Terminal 1
cd ~/Desktop/EventFlow
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
PORT=3002 \
pnpm --filter api dev
```

```bash
# Terminal 2
cd ~/Desktop/EventFlow
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm --filter web dev
```

Adresy:

```text
WEB: http://localhost:3000/login
API: http://localhost:3002/api
Prisma Studio: cd apps/api && pnpm exec prisma studio --schema=prisma/schema.prisma
```
