# CHANGELOG V25 — kod i baza

## Frontend

- `apps/web/app/dashboard/warehouse/models/page.tsx`
  - przebudowany widok listy modeli na czytelną tabelę magazynową;
  - dodano kolumnę zdjęcia;
  - dodano filtrowanie po typie, kategorii i wyszukiwarce;
  - dodano akcje: podgląd, edycja, usunięcie;
  - dodano upload zdjęcia przy tworzeniu modelu.

- `apps/web/app/dashboard/warehouse/models/[id]/page.tsx`
  - dodano pełny tryb edycji modelu;
  - dodano upload, podgląd i usuwanie zdjęcia;
  - zachowano listę egzemplarzy oraz dodawanie egzemplarzy;
  - kody kreskowe i QR pozostają po stronie egzemplarzy.

## Backend

- `apps/api/src/magazyn/magazyn.service.ts`
  - `createModelSprzetu` zapisuje `zdjecie`;
  - `updateModel` aktualizuje `zdjecie`.

## Prisma / DB

- `apps/api/prisma/schema.prisma`
  - `ModelSprzetu.zdjecie` zmienione na `String? @db.Text`.

- migration:
  - `20260712140000_eventflow_product_polish_v25/migration.sql`
  - `ALTER TABLE "modele" ALTER COLUMN "zdjecie" TYPE TEXT;`
