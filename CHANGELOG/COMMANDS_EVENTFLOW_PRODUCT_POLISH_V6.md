# Komendy — EventFlow Product Polish V6

Patch V6 nakładaj na czysty projekt z Gita lub na projekt z V5. Najbezpieczniej tak samo jak poprzednio: `rsync` zamiast przeciągania folderów w Finderze.

## Po nałożeniu patcha

```bash
cd ~/Desktop/EventFlow
pnpm install --force
```

## Prisma

W V6 nie ma nowych tabel, ale po zmianach backendu warto zawsze wykonać format i generate:

```bash
cd ~/Desktop/EventFlow/apps/api

pnpm exec prisma format --schema=prisma/schema.prisma

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma generate --schema=prisma/schema.prisma
```

Jeżeli wcześniej nie robiłeś V4/V5 `db push`, wykonaj też:

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma db push --schema=prisma/schema.prisma
```

Jeżeli Prisma zapyta o reset/utratę danych — przerwij `CTRL+C` i sprawdź komunikat.

## Odpalenie API

```bash
cd ~/Desktop/EventFlow

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
PORT=3002 \
pnpm --filter api dev
```

## Odpalenie web

```bash
cd ~/Desktop/EventFlow

NEXT_PUBLIC_API_URL="http://localhost:3002/api" \
pnpm --filter web dev
```

## Prisma Studio

```bash
cd ~/Desktop/EventFlow/apps/api

DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma studio --schema=prisma/schema.prisma
```
