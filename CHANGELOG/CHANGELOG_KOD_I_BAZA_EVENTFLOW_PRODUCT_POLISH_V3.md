# Opis zmian w kodzie i bazie danych

## 1. Kokpit

Zmienione pliki:
- `apps/web/app/dashboard/page.tsx`
- `apps/api/src/dashboard/dashboard.service.ts`

Zmiany:
- Usunięto z widoku kokpitu kafelki: „Sprzęt dostępny”, „Otwarte oferty”, „Przychód planowany”.
- Zostawiono kafelek „Wydarzenia w tym tygodniu”.
- Dodano kafelek „Aktualne serwisy”, liczony z tabeli `serwisy_sprzetu`, gdzie `data_rozwiazania IS NULL`.

## 2. Zadania

Bez zmian funkcjonalnych. Zakładka zostaje jak była.

## 3. Kalendarz

Dodane/zmienione pliki:
- `apps/api/src/kalendarz/*`
- `apps/web/app/dashboard/calendar/page.tsx`
- `apps/web/lib/googleMaps.ts`

Zmiany:
- Dodano zbiorczy endpoint kalendarza: wydarzenia, wypożyczenia, urlopy, serwis, flota.
- Przycisk „Dodaj” otwiera wybór: wydarzenie, wypożyczenie, spotkanie, wydarzenie prywatne, urlop.
- Dodano widoki: miesiąc, tydzień, dzień, lista.
- Usunięto pole miesiąca księgowania z formularza dodawania wydarzenia.
- Dodano ręczne miejsce i ręczny adres z linkiem do Google Maps.
- Nazwa „boczne etapy” została w UI potraktowana jako „statusy poboczne” w warstwie statusów/ikon.
- Usunięto z nowego widoku kafelki: historia przebiegów, powiadomienia.
- Zwiększono czytelność pasków kalendarza i podświetlenie dzisiejszego dnia.

## 4. Plan dnia

Zmienione pliki:
- `apps/web/app/dashboard/layout.tsx`

Zmiany:
- Zakładka „Plan dnia” została ukryta w menu. Kod historyczny nie został usunięty z projektu.

## 5. Wydarzenia

Zmienione pliki:
- `apps/api/src/wydarzenia/wydarzenia.service.ts`
- `apps/web/app/dashboard/events/page.tsx`
- `apps/web/app/dashboard/events/[id]/page.tsx`
- `apps/web/components/EventForm.tsx`

Zmiany:
- Dodano wybór typu wydarzenia `id_typu_wydarzenia`.
- Typ wydarzenia ma kolor widoczny w kalendarzu.
- Status wydarzenia może mieć ikonę widoczną przed nazwą wydarzenia.
- Usunięto z menu „Grupy sprzętowe”.
- Wypożyczenia przeniesiono do osobnej zakładki i endpointów opartych o tabele `wynajmy` i `pozycje_wynajmu`.

## 6. Kontrahenci

Zmienione/dodane pliki:
- `apps/api/src/crm/*`
- `apps/api/src/gus/*`
- `apps/web/app/dashboard/crm/page.tsx`
- `apps/web/app/dashboard/crm/contacts/page.tsx`

Zmiany:
- Lista kontrahentów zostaje.
- Usunięto z menu kafelek „Grupy”.
- Dodano kafelek/zakładkę „Kontakty”.
- Dodano CRUD kontaktów oparty o `kontakty_kontrahentow`.
- Dodano endpoint pobierania danych po NIP: `/api/api/gus/nip/:nip`.
- Miejsca ukryte z menu na MVP.

## 7. Magazyn

Zmienione/dodane pliki:
- `apps/api/src/magazyn/*`
- `apps/web/app/dashboard/warehouse/categories/page.tsx`
- `apps/web/app/dashboard/warehouse/receiving/page.tsx`
- `apps/web/app/dashboard/warehouse/unreturned/page.tsx`

Zmiany:
- Ukryto z menu: magazyn dostawców, wydanie z magazynu, załączniki modeli, baza sprzętu.
- Dodano zarządzanie kategoriami sprzętu.
- Dodano zakładkę przyjęcia do magazynu jako osobny ekran przygotowany pod dalszy formularz.
- Dodano niezwrócony sprzęt na podstawie wynajmów bez `data_zwrotu_rzeczywista`.
- Dodano kalendarz zajętości modelu sprzętu przez endpoint `/api/api/magazyn/modele/:id/zajetosc`.

## 8. Serwis

Zmienione/dodane pliki:
- `apps/api/src/serwis/*`
- `apps/web/app/dashboard/service/statuses/page.tsx`

Zmiany:
- Dodano tworzenie zgłoszeń serwisowych.
- Dodano CRUD statusów serwisowych.
- Kafelek serwisu pokazuje aktualne aktywne naprawy.

## 9. Flota

Dodane pliki:
- `apps/api/src/flota/*`
- `apps/web/app/dashboard/fleet/page.tsx`

Zmiany:
- Dodano pojazdy na podstawie tabeli `pojazdy`.
- Dodano rezerwacje pojazdów przez `wydarzenia_pojazdy`.
- Dodano dostępność auta na podstawie rezerwacji wydarzeń.

## 10. Ustawienia i uprawnienia

Dodane pliki:
- `apps/api/src/ustawienia/*`
- `apps/web/app/dashboard/settings/page.tsx`
- `apps/web/app/dashboard/settings/permissions/page.tsx`

Zmiany:
- Dodano zakładki: personalizacja systemu, uprawnienia.
- Ukryto „Słowniki” z menu głównego.
- Dodano role i przypisywanie ról użytkownikom na bazie `role` i `uzytkownicy_role`.
- Dodano konfigurację typów wydarzeń i statusów wydarzeń.

## 11. Oferty

Dodane pliki:
- `apps/api/src/oferty/*`
- `apps/web/app/dashboard/offers/page.tsx`
- `apps/web/app/dashboard/offers/[id]/page.tsx`

Zmiany:
- Dodano panel ofert w stylu NEW: oferta → wersja → sekcje/sale → pozycje.
- Obsłużono typy pozycji: sprzęt, transport, obsługa, nocleg, usługa, inne.
- Oferty liczą sumy netto/VAT/brutto z pozycji.

## 12. Ukryte zakładki

Ukryto z menu:
- Wypożyczenia i konflikty
- Statystyki
- Rozliczenia
- Finanse
- Historia
- Planowanie
- Miejsca

Nie usuwano kodu biznesowego tych obszarów, tylko wyłączono je z nawigacji MVP.

## 13. Baza danych / Prisma

Zmienione pliki:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260711120000_eventflow_product_polish_v3/migration.sql`

Zmiany w bazie:
- `statusy_wydarzen.ikona VARCHAR(20)` — ikona statusu widoczna w kalendarzu.
- `wydarzenia.miejsce_reczne VARCHAR(255)` — ręczne miejsce wydarzenia.
- `wydarzenia.adres_reczny VARCHAR(255)` — adres do Google Maps.
- `wydarzenia.link_google_maps VARCHAR(500)` — link mapy.
- `wydarzenia.szacowany_czas_dojazdu_min INTEGER` — pole pod szacowany czas dojazdu.
- Usunięto duplikat `@@map("magazyny")` ze schematu Prisma, bo to może powodować problemy przy generowaniu klienta.
