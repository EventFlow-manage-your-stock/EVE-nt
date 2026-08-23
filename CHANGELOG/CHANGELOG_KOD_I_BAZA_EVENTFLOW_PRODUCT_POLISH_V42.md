# Changelog V42

## Frontend
- `apps/web/app/dashboard/layout.tsx`
  - dodano tryb bez dashboardowego sidebaru dla tras zawierających `/pdf`.
- `apps/web/app/dashboard/warehouse/documents/[id]/page.tsx`
  - przycisk `Drukuj` otwiera `/pdf?drukuj=1`.
- `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`
  - dodano style print-only ukrywające cały layout poza dokumentem,
  - ustawiono A4 portrait,
  - dodano automatyczny print po parametrze `drukuj=1`.

## Baza danych
- Brak zmian.
