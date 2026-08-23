# CHANGELOG — EventFlow Product Polish V18

## Frontend

### `apps/web/app/dashboard/calendar/page.tsx`

- Dodano stałe layoutu kalendarza:
  - `CALENDAR_BAR_TOP`,
  - `CALENDAR_BAR_ROW_HEIGHT`,
  - `CALENDAR_BAR_ROW_GAP`,
  - `CALENDAR_WEEK_MIN_HEIGHT`.
- Paski wydarzeń startują niżej, żeby nie nachodziły na oznaczenie dzisiejszego dnia.
- Usunięto sztuczne ograniczenie liczby wierszy kalendarza.
- Usunięto ucinanie `bars.slice(...)`.
- Wysokość tygodnia i komórek dni jest liczona dynamicznie z liczby pasków.

## Backend

### `apps/api/src/kalendarz/kalendarz.service.ts`

- Lista wynajmów w kalendarzu filtruje teraz `id_wydarzenia: null`.
- Wynajem powiązany z wydarzeniem nie tworzy dodatkowego paska w kalendarzu.
- Samodzielne wynajmy nadal są widoczne jako osobne wpisy.

## Baza danych

- Brak zmian strukturalnych.
- Brak migracji.
