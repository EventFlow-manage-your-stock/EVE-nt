# Komendy EventFlow Product Polish v3

## Instalacja

```bash
cd /Users/michalstrykowski/Desktop/EventFlow
pnpm install --force
```

## Prisma

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm prisma:generate
```

Jeżeli chcesz wypchnąć zmiany schematu bez migracji:

```bash
cd apps/api
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma db push --schema=prisma/schema.prisma
```

Jeżeli chcesz użyć migracji:

```bash
cd apps/api
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma migrate dev --name eventflow_product_polish_v3
```

## Odpalanie API

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
pnpm dev:api
```

## Odpalanie frontu

```bash
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm dev:web
```

## Prisma Studio

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm prisma:studio
```
