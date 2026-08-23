# CHANGELOG - EventFlow Product Polish V4

## Frontend

### Layout
- Dodano `apps/web/public/eventflow-logo.svg`.
- Zmieniono `apps/web/app/dashboard/layout.tsx`:
  - logo w lewym górnym rogu,
  - informacja o zalogowanym użytkowniku pod logo,
  - stare ukryte moduły nadal nie są usuwane, tylko nie ma ich w menu.

### API helper
- Zmieniono `apps/web/lib/api.ts`:
  - obsługa obu stylów adresów: `/auth/login` i `/api/...`,
  - ochrona przed błędem `/api/api/...`,
  - token pobierany z `access_token`, `eventflow_token` albo store Zustand.

### Kokpit
- Zmieniono przycisk `Dodaj z kalendarza` na `Dodaj`.

### Kalendarz
- `apps/web/app/dashboard/calendar/page.tsx`:
  - domyślny widok miesięczny,
  - try/catch/finally, żeby nie wisiał loader,
  - większa czcionka dnia i pasków,
  - mocniejsze podświetlenie dzisiejszego dnia,
  - modal dodawania: wydarzenie, wypożyczenie, spotkanie, prywatne, urlop.

### Wydarzenia
- `apps/web/app/dashboard/events/page.tsx`:
  - zakładki: wydarzenia, wynajmy, urlopy,
  - sortowalna tabela,
  - filtrowanie po statusie, typie, kontrahencie i dacie,
  - dodawanie z modala po przycisku `Dodaj`.

### Kontrahenci
- `apps/web/app/dashboard/crm/page.tsx`:
  - lista kontrahentów,
  - dodawanie po przycisku `Dodaj`,
  - pobieranie danych z GUS po NIP.
- `apps/web/app/dashboard/crm/contacts/page.tsx`:
  - lista kontaktów,
  - dodawanie kontaktu po przycisku `Dodaj`.

### Magazyn
- `apps/web/app/dashboard/warehouse/models/page.tsx`:
  - model bez kodu kreskowego,
  - domyślna wartość egzemplarza na modelu.
- `apps/web/app/dashboard/warehouse/models/[id]/page.tsx`:
  - ukryte: tagi, cross rental, arkusz dostępności, zamienniki, tłumaczenia,
  - przycisk `Generuj naklejki`,
  - kalendarz dostępności modelu,
  - formularz egzemplarza zgodny z ustaleniami: nazwa egzemplarza, numer egzemplarza, kody QR/kreskowy, checkbox rozróżnienia kodów, bez pola pakowane pojedynczo i bez notatek ukrytych.
- `apps/web/app/dashboard/warehouse/items/page.tsx`:
  - dodawanie egzemplarza przez wybór modelu,
  - generowanie naklejek dla zaznaczonych egzemplarzy.
- `apps/web/app/dashboard/warehouse/labels/page.tsx`:
  - osobna karta A4 z QR/kodami kreskowymi, gotowa do wydruku lub zapisania jako PDF.
- `apps/web/app/dashboard/warehouse/categories/page.tsx`:
  - dodawanie dopiero po przycisku,
  - podkategorie przez `id_rodzica`,
  - usuwanie soft delete,
  - ręczna kolejność.

### Serwis
- `apps/web/app/dashboard/service/page.tsx`:
  - działający modal `Nowe zgłoszenie`,
  - wybór egzemplarza, statusu zgłoszenia i statusu sprzętu.
- `apps/web/app/dashboard/service/statuses/page.tsx`:
  - statusy zgodne ze wzorem ze zrzutu.

### Flota
- `apps/web/app/dashboard/fleet/page.tsx`:
  - lista z sortowaniem i wyszukiwaniem,
  - dodawanie po przycisku,
  - VIN, przebieg, data przeglądu, data OC,
  - kalendarz informacyjny dla przeglądu i OC.

### Oferty
- `apps/web/app/dashboard/offers/page.tsx`:
  - lista ofert,
  - oferta musi być przypisana do wydarzenia przy tworzeniu,
  - duplikacja oferty z listy.
- `apps/web/app/dashboard/offers/[id]/page.tsx`:
  - układ inspirowany NEW: dane, budżet/podsumowanie, harmonogramowo-grupowa struktura,
  - grupy sprzętowe jako sekcje oferty,
  - pozycje: sprzęt, obsługa, transport, nocleg, usługa,
  - kolumny: nazwa, opis, cena, liczba, rabat, dni pracy, VAT, razem netto,
  - duplikacja oferty,
  - duplikacja grupy sprzętowej,
  - przygotowane przyciski synchronizacji wydarzenie <-> oferta.

## Backend

### Magazyn
- `apps/api/src/magazyn/magazyn.service.ts`:
  - model nie zapisuje kodu kreskowego z UI,
  - dodano obsługę `wartosc_domyslna_egzemplarza`,
  - egzemplarz zapisuje `numer_egzemplarza`, `zewnetrzny_kod_kreskowy`, `zewnetrzny_qr_kod`, `rozroznij_kod_qr`,
  - `pakowany_pojedynczo` zostaje w bazie, ale UI go nie pokazuje.

### Serwis
- `apps/api/src/serwis/serwis.service.ts`:
  - domyślne statusy serwisu ustawione jak na zrzucie,
  - nowe zgłoszenie może zmienić status serwisowy sprzętu.

### Flota
- `apps/api/src/flota/flota.service.ts`:
  - obsługa VIN, przebiegu, przeglądu, OC, historii serwisów i przeglądów.

### Oferty
- `apps/api/src/oferty/oferty.controller.ts` i `apps/api/src/oferty/oferty.service.ts`:
  - duplikacja całej oferty,
  - duplikacja sekcji/grupy sprzętowej,
  - endpoint synchronizacji wydarzenie <-> oferta zapisujący akcję w logach.

## Baza danych

Dodano migrację:
`apps/api/prisma/migrations/20260711153000_eventflow_product_polish_v4/migration.sql`

Zmiany:
- `modele.wartosc_domyslna_egzemplarza`
- `egzemplarze.numer_egzemplarza`
- `egzemplarze.zewnetrzny_kod_kreskowy`
- `egzemplarze.zewnetrzny_qr_kod`
- `egzemplarze.rozroznij_kod_qr`
- `pojazdy.vin`
- `pojazdy.przebieg_km`
- `pojazdy.data_przegladu`
- `pojazdy.data_oc`
- dodatkowe pola floty: marka, model, rok produkcji, polisa OC, ubezpieczyciel
- nowe tabele: `serwisy_pojazdow`, `przeglady_pojazdow`

Nie usuwano istniejących pól. Pola niechciane na tym etapie są ukrywane w UI albo pozostawione jako historyczne.
