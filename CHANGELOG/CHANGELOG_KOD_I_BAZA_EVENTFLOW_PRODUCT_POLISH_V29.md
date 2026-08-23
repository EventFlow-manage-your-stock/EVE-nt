# Changelog V29

## Kod

Zmieniono:

- `apps/web/app/dashboard/events/[id]/page.tsx`

### Zakładka Sprzęt w wydarzeniu

- Przebudowano układ na prostszy i bardziej czytelny.
- Lista sprzętu przypisanego do wydarzenia jest widoczna od razu po wejściu w zakładkę.
- Sprzęt jest pogrupowany po ścieżce kategorii, np. `Multimedia / Projektory`.
- Panel `Dodaj / zmień sprzęt` jest oddzielony od listy aktualnego sprzętu.
- Dodano osobne przełączanie:
  - kategoria główna,
  - podkategoria.
- Edycja planu odbywa się bez koszyka: ilość przy modelu jest wartością docelową w wydarzeniu.
- Zachowano zasadę: plan = modele + ilości, WZ/PZ = egzemplarze.

## Baza danych

Brak zmian w bazie danych.
