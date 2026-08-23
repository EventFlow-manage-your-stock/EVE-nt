# CHANGELOG V35 — sprzęt ilościowy w modelu

## Frontend

### `apps/web/app/dashboard/warehouse/models/page.tsx`

- Dodano checkbox **Sprzęt ilościowy** w formularzu dodawania modelu.
- Dodano pola widoczne tylko dla sprzętu ilościowego:
  - stan ilościowy,
  - jednostka,
  - kod kreskowy modelu.
- Dla zwykłego sprzętu kod kreskowy modelu nie jest zapisywany, bo kody należą do egzemplarzy.
- W tabeli modeli dodano rozróżnienie:
  - `Sprzęt z egzemplarzami`,
  - `Sprzęt ilościowy`.
- Stan/dostępność dla sprzętu ilościowego bazuje na `ilosc_magazynowa`, a nie na liczbie egzemplarzy.

### `apps/web/app/dashboard/warehouse/models/[id]/page.tsx`

- Dodano checkbox **Sprzęt ilościowy** w edycji modelu.
- Dodano pola:
  - stan ilościowy,
  - jednostka,
  - kod kreskowy modelu.
- Dla modelu ilościowego zamiast tabeli egzemplarzy pokazuje się czytelny panel stanu ilościowego.
- Dla modelu ilościowego ukryto przycisk dodawania egzemplarza.
- Dla modelu zwykłego zostaje dotychczasowy widok egzemplarzy z numerem/SN/kodem.

## Backend

### `apps/api/src/magazyn/magazyn.service.ts`

- Dodano metodę `isSprzetIlosciowy`.
- `createModelSprzetu` zapisuje:
  - `tryb_ewidencji = ilosciowe` albo `egzemplarze`,
  - `ilosc_magazynowa`,
  - `jednostka`,
  - `kod_kreskowy` tylko dla sprzętu ilościowego.
- `updateModel` zapisuje te same pola.
- Lista modeli liczy stan sprzętu ilościowego na podstawie `ilosc_magazynowa`.

## Baza danych

Brak nowych tabel i migracji w V35. Wykorzystane są pola dodane wcześniej w V34.
