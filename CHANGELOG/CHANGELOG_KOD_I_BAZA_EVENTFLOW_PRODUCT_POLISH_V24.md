# Changelog V24 — moduł sprzętu wydarzenia

## Kod

Zmieniony plik:

- `apps/web/app/dashboard/events/[id]/page.tsx`

Zakres zmian:

- przebudowany komponent `EquipmentPanel`,
- usunięty koszyk z planowania sprzętu,
- dodany prosty widok planu po kategoriach,
- dodany panel edycji ilości modeli po kategoriach,
- rozdzielone tryby:
  - `Sprzęt` — modele + ilości,
  - `Wydanie WZ` — konkretne egzemplarze,
  - `Przyjęcie PZ` — konkretne egzemplarze,
- dodane liczniki po skanie: plan / wydano / przyjęto / brakuje,
- skan case rozwija zawartość do egzemplarzy, ale nie dodaje samego case na dokument.

## Baza danych

Brak zmian w schemacie bazy.

## Komentarze w kodzie

Nowe miejsca oznaczone komentarzem:

`EVENTFLOW_PRODUCT_POLISH_V24`
