# CHANGELOG — EventFlow Product Polish V6

## Frontend

### Kalendarz
Plik: `apps/web/app/dashboard/calendar/page.tsx`

- Przebudowany widok miesięczny, tygodniowy, dzienny i lista.
- Dodane filtry typów wpisów: wydarzenia, wynajmy, nieobecności, serwis, flota.
- Dodana wyszukiwarka wpisów.
- Wpisy są klikalne i prowadzą do odpowiedniego modułu.
- Status nie jest już osobnym tekstem na kafelku — jest ikoną przed nazwą wpisu.
- Dzisiejszy dzień ma mocne podświetlenie.
- Jeżeli wydarzenie trwa przez wiele dni i obejmuje dzisiejszy dzień, wcześniejsze dni dostają pastelowy kolor.

### Edycja wydarzenia
Plik: `apps/web/app/dashboard/events/[id]/page.tsx`

- Formularz nie wysyła już całego obiektu wydarzenia z relacjami Prisma.
- Payload zawiera tylko pola edytowalne.
- Puste selecty są wysyłane jako `null`, a nie pusty string.
- Dodano obsługę błędów i stan `Zapisuję...`.

### Serwis
Plik: `apps/web/app/dashboard/service/page.tsx`

- Dodane dwa widoki: `Nasz widok` i `Lista`.
- `Nasz widok` grupuje zgłoszenia według statusów serwisowych.
- Zachowany formularz nowego zgłoszenia.

Plik: `apps/web/app/dashboard/service/statuses/page.tsx`

- Statusy serwisowe można edytować inline.
- Dodane przesuwanie kolejności strzałkami.
- Dodane usuwanie statusu.

### Flota
Plik: `apps/web/app/dashboard/fleet/page.tsx`

- Naprawiony endpoint listy i zapisu pojazdów z `/api/flota` na `/api/flota/pojazdy`.
- Przy zapisie liczby są normalizowane do `number/null`.

### Oferty
Plik: `apps/web/app/dashboard/offers/[id]/page.tsx`

- Przycisk PDF otwiera nową kartę `/dashboard/offers/[id]/pdf`.
- Dodany przycisk `Budżet`.
- Budżet pozwala wybrać grupy/sekcje, których ceny nie wolno ruszać.
- Widok pozycji pokazuje obniżkę budżetową przy pozycjach.

Nowy plik: `apps/web/app/dashboard/offers/[id]/pdf/page.tsx`

- Drukowalny widok oferty w stylu PDF.
- Użytkownik może kliknąć `Drukuj / zapisz jako PDF` i zapisać dokument z przeglądarki.

## Backend

### Wydarzenia
Plik: `apps/api/src/wydarzenia/wydarzenia.service.ts`

- Dodane helpery normalizujące `number/null`, `Date/null`, `string/null`.
- `create` i `update` nie próbują już zapisywać pustych stringów do relacji i dat.
- Daty z inputów `datetime-local` są zamieniane na `Date` po stronie API.

### Serwis
Pliki:
- `apps/api/src/serwis/serwis.service.ts`
- `apps/api/src/serwis/serwis.controller.ts`

- Dodany endpoint `DELETE /api/serwis/statusy/:id`.
- Usuwanie statusu działa jako soft-delete: `aktywny=false`, `data_usuniecia=now()`.

### Oferty
Pliki:
- `apps/api/src/oferty/oferty.service.ts`
- `apps/api/src/oferty/oferty.controller.ts`

- Dodany endpoint `POST /api/oferty/:id/budzet`.
- Algorytm budżetowy:
  - liczy sumę pozycji niezmienianych: obsługa, nocleg, transport, usługi oraz zablokowane sekcje sprzętowe,
  - pozostały budżet rozdziela proporcjonalnie na sprzęt,
  - zapisuje `cena_przed_budzetem_netto`, `rabat_budzetowy_netto`, `razem_netto`, VAT i brutto,
  - aktualizuje podsumowania oferty.

## Baza danych

W V6 nie dodawałem nowych tabel. Wykorzystane zostały pola, które były już w schemacie V4/V5:

- `oferty.budzet_netto`
- `oferty.suma_przed_budzetem_netto`
- `oferty.rabat_budzetowy_netto`
- `oferty.rabat_budzetowy_proc`
- `oferty.algorytm_budzetu`
- `pozycje_oferty.cena_przed_budzetem_netto`
- `pozycje_oferty.rabat_budzetowy_netto`
- `statusy_serwisu.kolejnosc`
- `statusy_serwisu.aktywny`
- `statusy_serwisu.data_usuniecia`
