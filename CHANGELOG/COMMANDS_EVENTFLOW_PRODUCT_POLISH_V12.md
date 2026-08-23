# Komendy V12

## Wdrożenie patcha

```bash
cd ~/Desktop/EventFlow
rsync -av --progress /tmp/eventflow_patch_v12/ ~/Desktop/EventFlow/
pnpm install --force
cd apps/api
pnpm exec prisma format --schema=prisma/schema.prisma
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma db push --schema=prisma/schema.prisma
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma generate --schema=prisma/schema.prisma
```

## API

```bash
cd ~/Desktop/EventFlow
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
PORT=3002 \
pnpm --filter api dev
```

## Web

```bash
cd ~/Desktop/EventFlow
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm --filter web dev
```
