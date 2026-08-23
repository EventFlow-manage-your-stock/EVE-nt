# Changelog V33

## Frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`

- Dodano `useRef` dla pola skanowania.
- Dodano `scanInputRef`.
- Zmieniono obsługę skanowania case:
  - wcześniej case wywoływał dodawanie egzemplarzy przez wiele pojedynczych aktualizacji stanu,
  - teraz zawartość case dodawana jest hurtowo jedną funkcją `addDocumentItemsBulk`, co stabilizuje liczniki i eliminuje pomijanie sztuk przy szybkim skanie.
- Przycisk `Skanuj`:
  - jeśli pole jest puste, fokusuje pole tekstowe,
  - jeśli pole ma kod, wykonuje skan,
  - po skanie przywraca focus do pola.

## Backend

### `apps/api/src/magazyn/magazyn.service.ts`

- Poprawiono typ mapy planu sprzętu wydarzenia:
  - `uwagi?: string` → `uwagi?: string | null | undefined`.

## Baza danych

Brak zmian w bazie danych.
