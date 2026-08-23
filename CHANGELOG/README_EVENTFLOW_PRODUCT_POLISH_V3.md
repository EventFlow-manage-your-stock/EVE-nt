# EventFlow Product Polish v3

Patch wdraża poprawki z listy „Szkic poprawek EventFlow” bez usuwania starego kodu biznesowego. Tam, gdzie funkcje mają zostać ukryte na MVP, ukryłem je w nawigacji albo zostawiłem komentarz `EVENTFLOW_PRODUCT_POLISH_V3`.

## Jak użyć

1. Zrób branch:

```bash
git checkout -b product/polish-v3
```

2. Rozpakuj ZIP do głównego katalogu projektu `EventFlow` tak, żeby nadpisać/dodać pliki.

3. Zainstaluj zależności i wygeneruj Prismę:

```bash
pnpm install --force
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm prisma:generate
```

4. Jeżeli korzystasz z migracji Prisma:

```bash
cd apps/api
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma migrate dev --name eventflow_product_polish_v3
```

Alternatywnie na lokalnym dev możesz użyć:

```bash
cd apps/api
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm exec prisma db push --schema=prisma/schema.prisma
```

5. Odpal API i web osobno:

```bash
# Terminal 1
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
JWT_SECRET="dev_secret_123" \
API_PORT=3002 \
pnpm dev:api

# Terminal 2
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm dev:web
```

## Ważne

- API nadal zachowuje dotychczasową konwencję części kontrolerów: `@Controller('api/...')` + globalPrefix `api`, dlatego część endpointów działa jako `/api/api/...`. Nie robiłem dużej refaktoryzacji ścieżek, żeby nie rozwalić istniejącego frontu.
- Dodałem komentarze `EVENTFLOW_PRODUCT_POLISH_V3` w miejscach świadomych zmian.
- Nie usuwałem starych modułów biznesowo; ukryłem je w menu albo skomentowałem ich stare zachowanie.
