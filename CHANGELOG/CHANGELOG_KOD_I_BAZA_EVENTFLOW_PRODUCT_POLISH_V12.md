# Changelog V12 — kod i baza danych

## Baza danych / Prisma

Dodano modele:

- `WydanieMagazynowe` → tabela `wydania_magazynowe`
- `PozycjaWydaniaMagazynowego` → tabela `pozycje_wydan_magazynowych`

Relacje dodane do:

- `Organizacja`
- `Uzytkownik`
- `Wydarzenie`
- `Wynajem`
- `ModelSprzetu`
- `Egzemplarz`

Dodano migrację:

- `apps/api/prisma/migrations/20260711230000_eventflow_product_polish_v12/migration.sql`

## Backend

### `apps/api/src/magazyn/magazyn.controller.ts`

Dodano endpointy:

- `GET /api/magazyn/dokumenty`
- `GET /api/magazyn/dokumenty/:id`
- `POST /api/magazyn/dokumenty`
- `GET /api/magazyn/wydarzenia/:id/sprzet`
- `POST /api/magazyn/wydarzenia/:id/sprzet`

### `apps/api/src/magazyn/magazyn.service.ts`

Dodano logikę:

- tworzenie dokumentów WZ/PZ/plan,
- pobieranie dokumentów z pozycjami,
- pobieranie sprzętu przypisanego do wydarzenia,
- dodawanie sprzętu do wydarzenia poprzez automatyczną listę sprzętu/wynajem techniczny.

### `apps/api/src/wydarzenia/wydarzenia.service.ts`

Lista wydarzeń zawiera teraz:

- `status_magazynowy`,
- `status_ksiegowy`.

### `apps/api/src/kalendarz/kalendarz.service.ts`

Wpisy wydarzeń w kalendarzu zawierają teraz:

- ikonę statusu głównego,
- ikonę statusu magazynowego,
- ikonę statusu księgowego,
- nazwę statusu magazynowego i księgowego.

## Frontend

### Magazyn

- `warehouse/receiving/page.tsx` — przebudowany na moduł Wydania i przyjęcia.
- `warehouse/documents/[id]/pdf/page.tsx` — nowy drukowalny widok PDF/potwierdzenia.
- `warehouse/packages/page.tsx` — przełącznik typy/egzemplarze, podgląd zawartości case.
- `warehouse/packages/[id]/page.tsx` — pełny podgląd i edycja case z możliwością dodawania/usuwania zawartości.
- `warehouse/models/page.tsx` — przełącznik sprzęt/opakowania/wszystkie.
- `warehouse/items/page.tsx` — przełącznik sprzęt/opakowania/wszystkie.

### Wydarzenia

- `events/[id]/page.tsx` — zakładka `Sprzęt` z dodawaniem sprzętu do wydarzenia, WZ/PZ i PDF z podpisem.
- `events/page.tsx` — status magazynowy i księgowy na liście oraz filtry.

### Kalendarz

- `calendar/page.tsx` — pokazuje ikony statusu magazynowego i księgowego obok nazwy wydarzenia.

## Komentarze w kodzie

Nowe miejsca są oznaczone komentarzem:

`EVENTFLOW_PRODUCT_POLISH_V12`
