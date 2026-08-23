# Changelog V10 — kod i baza

## Kod frontend

- Dodano wspólny komponent `apps/web/components/EntityEditorPage.tsx`.
- Dodano pełne strony edycji rekordów dla CRM, magazynu, floty, serwisu i ustawień.
- Zmieniono listy tak, żeby rekordy otwierały właściwy moduł edycji:
  - kontakty,
  - egzemplarze,
  - opakowania,
  - kategorie,
  - flota,
  - serwis,
  - urlopy.
- Zachowano istniejące modale dodawania rekordów.
- Komentarze oznaczono `EVENTFLOW_PRODUCT_POLISH_V10`.

## Kod backend

Dodano brakujące endpointy szczegółów potrzebne do pełnych ekranów edycji:

- `GET /api/crm/kontakty/:id`
- `GET /api/magazyn/kategorie/plasko`
- `GET /api/magazyn/kategorie/:id`
- `GET /api/magazyn/opakowania/:id`
- `GET /api/flota/pojazdy/:id`
- `GET /api/serwis/statusy/:id`
- `GET /api/slowniki/typy-wydarzen/:id`

Rozszerzono też aktualizację kontaktu o możliwość zmiany kontrahenta.

## Baza danych

Brak nowych tabel. Patch używa obecnego schematu z V9.
