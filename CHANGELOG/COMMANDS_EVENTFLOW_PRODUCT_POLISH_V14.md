# Komendy wdrożenia V14

Pobierz ZIP do `~/Downloads/EventFlow_Product_Polish_v14_patch.zip`, a potem uruchom komendy z odpowiedzi ChatGPT.

Po wdrożeniu uruchom API:

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

Prisma Studio:

```bash
cd ~/Desktop/EventFlow/apps/api

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma studio --schema=prisma/schema.prisma
```
