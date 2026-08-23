# Changelog V7 - kod i baza

## Kod frontend

- `apps/web/components/DataTable.tsx`
  - Dodano automatyczny panel szczegółów po kliknięciu rekordu.
  - Dodano opcjonalne `onSaveRow`, aby moduły mogły zapisywać edycję rekordu.

- `apps/web/app/dashboard/calendar/page.tsx`
  - Serwis usunięty z domyślnego filtra aktywnych typów.
  - Wpisy wielodniowe mają segmenty łączące się wizualnie w pasek.
  - Dzisiaj pozostaje mocno widoczne.

- `apps/web/app/dashboard/warehouse/page.tsx`
  - Dodany odporny widok magazynu wewnętrznego.
  - Naprawa błędu `toFixed is not a function` przez normalizację wartości liczbowych.
  - Model nie pokazuje własnego kodu kreskowego; wskazujemy, że kod dotyczy egzemplarzy.

- `apps/web/app/dashboard/warehouse/labels/page.tsx`
  - Etykiety generowane jedna pod drugą bez osobnych ramek wokół etykiety.
  - Układ A4 przygotowany do `drukuj / zapisz jako PDF`.

- `apps/web/app/dashboard/warehouse/packages/page.tsx`
  - Kod kreskowy i QR domyślnie są takie same.
  - Dodano checkbox rozróżnienia QR od kodu kreskowego.
  - Ukryto wartość case z formularza.

- `apps/web/app/dashboard/fleet/page.tsx`
  - Poprawiony zapis pojazdu z komunikatem błędu.
  - Panel floty pokazuje daty OC, przeglądów i serwisów jako wpisy informacyjne.
  - Tabela floty obsługuje panel szczegółów i zapis zmian przez `onSaveRow`.

- `apps/web/app/dashboard/offers/[id]/page.tsx`
  - Dodano zmianę koloru istniejącej grupy sprzętowej w ofercie.

## Kod backend

- `apps/api/src/kalendarz/kalendarz.service.ts`
  - Dodano wpisy informacyjne floty do kalendarza ogólnego: OC, przegląd techniczny, serwis pojazdu i historia przeglądów.

- `apps/api/src/oferty/oferty.controller.ts`
  - Dodano endpoint `PUT /api/oferty/:id/sekcje/:sekcjaId`.

- `apps/api/src/oferty/oferty.service.ts`
  - Dodano `updateSekcja`, aby można było zmieniać kolor/nazwę/opis/kolejność grupy sprzętowej.

## Baza danych

- Brak nowych tabel.
- Brak wymaganej migracji poza istniejącym `prisma db push` ze schematu V6/V7.
