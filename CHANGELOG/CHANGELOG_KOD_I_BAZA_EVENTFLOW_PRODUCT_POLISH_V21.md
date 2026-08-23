# CHANGELOG V21 — sprzęt modelowo, wydania egzemplarzowo

## Kod frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`

- Dodano state:
  - `modelCategory`,
  - `modelQty`.
- Dodano listę kategorii modeli sprzętu.
- Dodano przeglądanie modeli według kategorii.
- W trybie planowania wydarzenia user dodaje sprzęt jako model + ilość.
- W trybach wydania/przyjęcia wyszukiwarka pokazuje wyłącznie egzemplarze sprzętu.
- Dodano komunikat, że wydanie odbywa się przez skan konkretnych egzemplarzy.

### `apps/web/app/dashboard/offers/[id]/page.tsx`

- Dodano `equipmentQuickQty`.
- Dodano szybkie dodawanie modeli do oferty bez konieczności wypełniania formularza po prawej.
- W kartach modeli dodano pole ilości i przycisk `Dodaj szt.`.
- Zachowano możliwość wyboru modelu i ręcznej edycji parametrów pozycji w panelu bocznym.

## Baza danych

- Bez zmian w strukturze bazy.
- Brak nowych migracji.

## Założenie produktowe utrwalone w kodzie

- Event/oferta: model + ilość.
- WZ/PZ: konkretne egzemplarze.
- Case: skrót do zeskanowania zawartości, nie pozycja dokumentu.

