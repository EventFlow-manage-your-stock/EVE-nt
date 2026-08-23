# CHANGELOG — EventFlow Product Polish V20

## Kod frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`

- Przebudowano widok zakładki `Sprzęt` w panelu wydarzenia.
- Dodano bardziej intuicyjny układ:
  - nagłówek z opisem procesu,
  - trzy tryby pracy: `Dodaj do eventu`, `Wydaj`, `Przyjmij`,
  - lewa część: sprzęt wydarzenia według kategorii,
  - prawa część: wyszukiwarka/skaner i koszyk operacji.
- Utrzymano dotychczasową logikę:
  - WZ/PZ tylko na egzemplarze,
  - case po skanie rozwija się do egzemplarzy w środku,
  - dokument PDF otwiera się w nowej karcie.

### `apps/web/app/dashboard/offers/[id]/page.tsx`

- Przebudowano modal `Dodaj sprzęt` w ofercie.
- Dodano picker sprzętu:
  - kategorie po lewej,
  - wyszukiwarka i kafelki modeli pośrodku,
  - formularz pozycji po prawej.
- Dodano podgląd wartości netto pozycji przed dodaniem.
- Zachowano istniejące API i endpointy ofert.

## Baza danych

- Brak zmian.
- Nie dodano nowych tabel ani pól.

## Ryzyko

- Patch jest UI-only.
- Jeśli u użytkownika lokalny layout różni się od patcha, najczęściej wystarczy ponowne nałożenie patcha przez `rsync`, bez kasowania projektu.
