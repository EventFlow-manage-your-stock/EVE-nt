# CHANGELOG — EventFlow Product Polish V9

## Kod frontend

### Kalendarz

Plik:

- `apps/web/app/dashboard/calendar/page.tsx`

Zmiany:

- przebudowano renderowanie widoku miesiąca/tygodnia tak, aby wydarzenie trwające kilka dni było jednym paskiem rozpiętym przez kilka kolumn tygodnia,
- kolor paska wydarzenia przychodzi z API i dla wydarzeń oznacza kolor typu wydarzenia,
- status wydarzenia pozostaje ikoną przed nazwą,
- kliknięcie w pasek nadal prowadzi do szczegółów wydarzenia/wynajmu/urlopu,
- zachowano filtry wydarzeń, wynajmów, urlopów, floty i serwisu.

### Ustawienia typów wydarzeń

Dodano:

- `apps/web/app/dashboard/settings/event-types/page.tsx`

Zmiany:

- dodawanie typu wydarzenia,
- edycja nazwy i koloru,
- zmiana kolejności,
- ukrywanie typu przez soft delete.

Zmieniono:

- `apps/web/app/dashboard/settings/page.tsx` — dodano kafelek typów wydarzeń,
- `apps/web/app/dashboard/layout.tsx` — dodano link w menu ustawień.

## Kod backend

Zmieniono:

- `apps/api/src/slowniki/slowniki.controller.ts`
- `apps/api/src/slowniki/slowniki.service.ts`

Dodano endpointy:

- `POST /api/slowniki/typy-wydarzen`
- `PUT /api/slowniki/typy-wydarzen/:id`
- `DELETE /api/slowniki/typy-wydarzen/:id`
- `PUT /api/slowniki/typy-wydarzen-kolejnosc`

## Baza danych

Brak nowych tabel i brak wymuszonych migracji. Patch korzysta z istniejącego modelu/tabeli:

- `typy_wydarzen`

Używane pola:

- `nazwa`
- `kolor`
- `kolejnosc`
- `aktywny`
- `data_usuniecia`

Komentarze w kodzie oznaczone są jako `EVENTFLOW_PRODUCT_POLISH_V9`.
