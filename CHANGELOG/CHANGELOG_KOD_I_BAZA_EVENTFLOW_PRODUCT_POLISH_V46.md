# CHANGELOG V46

## Frontend

- `apps/web/app/dashboard/events/[id]/page.tsx`
  - Dodano wykrywanie modeli ilościowych w planie sprzętu wydarzenia.
  - Dodano checkbox „Wydaj/Przyjmij na sztuki bez skanu” przy modelach ilościowych.
  - Dodano funkcję `toggleQuantityRowWithoutScan`, która dodaje/usuwa model ilościowy w aktualnym dokumencie.
  - Zaktualizowano komunikaty przy skanowaniu i pustej liście dokumentu.

## Backend / baza

- Brak zmian.
- Nie wykonywać `prisma db push` dla tego patcha.
