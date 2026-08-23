# CHANGELOG V44

## Frontend

- `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`
  - poprawiono układ podpisów na PDF/druk,
  - dodano blok CSS `EVENTFLOW_PRODUCT_POLISH_V44`,
  - dodano wyliczanie wagi sprzętu i case,
  - dodano kafelek `Waga razem`.

- `apps/web/app/dashboard/warehouse/documents/[id]/page.tsx`
  - dodano wagę łączną na stronie po wystawieniu dokumentu,
  - dodano rozbicie: sprzęt + case.

## Backend

- `apps/api/src/magazyn/magazyn.service.ts`
  - endpoint dokumentu magazynowego zwraca relację `egzemplarz.case` z modelem case,
  - dzięki temu frontend liczy masę case tylko dla pozycji powstałych po skanie case.

## Baza

- Brak zmian w strukturze bazy.
- Nie uruchamiać `db push` tylko z powodu V44.
