# CHANGELOG — EventFlow Product Polish V5

## API / backend

1. **Naprawa tras NestJS**
   - Zmieniono kontrolery z `@Controller('api/...')` na `@Controller('...')`.
   - Powód: `main.ts` ma `app.setGlobalPrefix('api')`, więc stare kontrolery tworzyły endpointy `/api/api/...`.
   - Dotyczy m.in. `kalendarz`, `wynajmy`, `urlopy`, `flota`, `oferty`, `gus`, `crm`, `magazyn`, `serwis`, `slowniki`, `dashboard`, `wydarzenia`, `zadania`.

2. **Kalendarz**
   - Naprawiono endpoint `/api/kalendarz?od=...&do=...`.
   - Wspólny endpoint `POST /api/kalendarz/szybkie-dodanie` obsługuje: wydarzenie, wypożyczenie, spotkanie, wydarzenie prywatne i urlop.

3. **GUS/MF**
   - Dodano aliasy:
     - `GET /api/gus/:nip`
     - `GET /api/gus/nip/:nip`
   - Front może więc działać z krótką trasą używaną w UI.

4. **Słowniki**
   - Dodano `GET /api/slowniki/statusy-wynajmu`.
   - Jeśli statusy wynajmu nie istnieją, tworzone są domyślne: Nowe, Wydane, Zwrócone, Problem.

5. **Magazyn / opakowania**
   - Dodano `POST /api/magazyn/opakowania`.
   - Opakowanie jest tworzone jako model `typ_sprzetu='opakowanie'` plus egzemplarz.
   - Nie tworzono osobnej tabeli opakowań, bo obecny model danych już obsługuje case/skrzynię przez `egzemplarze.id_case`.

6. **Ceny**
   - Utrzymano endpointy:
     - `GET /api/magazyn/cennik`
     - `PUT /api/magazyn/cennik/masowo`
   - UI zapisuje ceny do `ceny_modeli`.

7. **Oferty**
   - `POST /api/oferty` obsługuje opcjonalne `id_oferty_szablonu`.
   - Jeśli pole jest podane, backend duplikuje wybraną ofertę razem z sekcjami i pozycjami, a następnie przypisuje ją do nowego wydarzenia/kontrahenta.

8. **Prisma / baza danych**
   - Uzupełniono relacje odwrotne w `Organizacja`:
     - `serwisy_pojazdow SerwisPojazdu[]`
     - `przeglady_pojazdow PrzegladPojazdu[]`
   - Dodano migrację `20260711170000_eventflow_product_polish_v5` z `CREATE TABLE IF NOT EXISTS` dla historii serwisów i przeglądów pojazdów.

## Frontend

1. **Kokpit**
   - `Dodaj` otwiera wspólny modal `QuickAddCalendarModal`.
   - Nie przenosi użytkownika do kalendarza.

2. **Kalendarz**
   - Startuje na widoku miesięcznym.
   - Używa tego samego komponentu dodawania co kokpit.

3. **Wydarzenia / wynajmy / urlopy**
   - Listy mają wyszukiwanie/sortowanie przez `DataTable`.
   - Dodano filtry odpowiednie do typu danych.

4. **Kontrahenci**
   - Poprawiono wywołanie GUS/MF.
   - UI pokazuje błąd, jeśli pobranie się nie uda.

5. **Opakowania**
   - Dodano prosty działający widok listy i modala `Dodaj opakowanie`.

6. **Ceny**
   - Dodano prosty działający widok filtrowania i zapisu cen.

7. **Oferty**
   - W modalu dodawania oferty dodano pole `Skopiuj dane z innej oferty / szablon`.
