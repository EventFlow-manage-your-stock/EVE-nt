# Changelog V8 — kod i baza danych

## Frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`
- Przebudowany ekran szczegółów wydarzenia na panel wzorowany na pierwotnym projekcie z GitHuba.
- Dodane górne akcje: powrót, zapis, usunięcie.
- Dodane sekcje: dane wydarzenia, manager, statusy poboczne, harmonogram.
- Dodane zakładki modułowe: chat, zadania, szczegóły, sprzęt, sprzęt zewnętrzny, załączniki, oferty, wynajmy, ekipa, flota, historia.
- Zakładka Oferty obsługuje wiele ofert przypisanych do jednego wydarzenia.
- Zapis wydarzenia zostaje na tym samym panelu i odświeża dane.

### `apps/web/app/dashboard/rentals/[id]/page.tsx`
- Nowy panel szczegółów wynajmu.
- Edycja podstawowych danych wynajmu.
- Lista wielu ofert przypisanych do wynajmu.
- Możliwość dodania oferty bezpośrednio do wynajmu.

### `apps/web/app/dashboard/rentals/page.tsx`
- Klik w rekord wypożyczenia otwiera panel szczegółów.

### `apps/web/app/dashboard/events/page.tsx`
- Klik w wypożyczenie z zakładki wydarzeń otwiera panel wynajmu.
- Klik w urlop otwiera panel urlopu.

### `apps/web/app/dashboard/calendar/page.tsx`
- Klik w wynajem w kalendarzu prowadzi do `/dashboard/rentals/[id]`.
- Klik w urlop w kalendarzu prowadzi do `/dashboard/leaves/[id]`.

### `apps/web/app/dashboard/offers/page.tsx`
- Przy tworzeniu oferty można przypisać ją do wydarzenia albo bezpośrednio do wynajmu.
- Lista ofert pokazuje kolumnę Wynajem.

### `apps/web/app/dashboard/leaves/[id]/page.tsx`
- Dodany prosty panel edycji nieobecności/urlopu.

## Backend

### `apps/api/src/wydarzenia/wydarzenia.service.ts`
- `findOne` filtruje po organizacji.
- `findOne` zwraca oferty, wynajmy, ekipę, flotę i historię.

### `apps/api/src/wynajmy/wynajmy.service.ts`
- Wynajem zwraca wiele ofert przypisanych bezpośrednio do wynajmu.
- Zachowana została oferta główna (`id_oferty`) jako relacja zaakceptowana/główna.

### `apps/api/src/oferty/oferty.service.ts`
- Oferta obsługuje `id_wynajmu`.
- Tworzenie, aktualizacja i duplikacja oferty zachowują przypisanie do wynajmu.

### `apps/api/src/urlopy/*`
- Dodany endpoint `GET /api/urlopy/:id`.

## Baza danych / Prisma

### `apps/api/prisma/schema.prisma`
- Dodane pole `id_wynajmu` w modelu `Oferta`.
- Dodana relacja `Oferta.wynajem` → `Wynajem`.
- Dodana relacja `Wynajem.oferty` → lista ofert przypisanych do wynajmu.
- Dotychczasowe `Wynajem.id_oferty` zostaje jako oferta główna/zaakceptowana.

### Migracja
- `apps/api/prisma/migrations/20260711203000_eventflow_product_polish_v8/migration.sql`
- Dodaje kolumnę `oferty.id_wynajmu`, indeks i FK do `wynajmy.id`.
