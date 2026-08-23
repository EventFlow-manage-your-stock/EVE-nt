# CHANGELOG — EventFlow Product Polish V11

## Kod — API

### `apps/api/src/slowniki/slowniki.controller.ts`
- Rozbudowano kontroler słowników o pełny CRUD statusów:
  - `GET/POST/PUT/DELETE /api/slowniki/statusy-wydarzenia`,
  - `GET/POST/PUT/DELETE /api/slowniki/statusy-magazynowe`,
  - `GET/POST/PUT/DELETE /api/slowniki/statusy-ksiegowe`,
  - endpointy zmiany kolejności: `*-kolejnosc`.
- Zostawiono alias `GET /api/slowniki/statusy-wydarzen`, żeby starsze odwołania nie rozjechały frontu.

### `apps/api/src/slowniki/slowniki.service.ts`
- Dodano wspólną logikę `listStatuses`, `createStatus`, `updateStatus`, `deleteStatus`, `reorderStatuses`.
- Statusy są soft-delete: `aktywny=false` i `data_usuniecia`, żeby nie zerwać historii wydarzeń.
- Każdy status ma `nazwa`, `kolor`, `ikona`, `kolejnosc`.

### `apps/api/src/kalendarz/kalendarz.service.ts`
- Wpisy związane z autami/flotą w kalendarzu mają ikonę auta `🚗`.

## Kod — Frontend

### `apps/web/app/dashboard/settings/statuses/page.tsx`
- Nowy ekran ustawień statusów operacyjnych.
- Trzy zakładki:
  - główne statusy wydarzeń,
  - statusy magazynowe,
  - statusy księgowe.
- Dodawanie, edycja, ukrywanie/usuwanie i przesuwanie kolejności.
- Podgląd statusu z kolorem i ikoną.

### `apps/web/components/StatusIconPicker.tsx`
- Nowy wygodny picker ikon statusu.
- Zawiera gotowe ikony dla wydarzeń, magazynu, księgowości i floty.
- Pozwala wkleić własny emoji/znak.

### `apps/web/app/dashboard/settings/page.tsx`
- Dodano kafelek `Statusy operacyjne`.

### `apps/web/app/dashboard/layout.tsx`
- Dodano pozycję menu `Ustawienia → Statusy operacyjne`.

### `apps/web/app/dashboard/events/[id]/page.tsx`
- Statusy magazynowe i księgowe w panelu wydarzenia pokazują ikonę.
- W górnym panelu wydarzenia dodano podgląd statusu magazynowego i księgowego jako kolorowe etykiety.

## Baza danych / Prisma

### `apps/api/prisma/schema.prisma`
- Dodano opcjonalne pole `ikona String? @db.VarChar(20)` do:
  - `StatusMagazynowy`,
  - `StatusKsiegowy`.
- `StatusWydarzenia` miał już pole `ikona`; V11 wykorzystuje je w pełnym module CRUD.

## Dlaczego tak

- Kolor paska w kalendarzu nadal pochodzi z typu wydarzenia.
- Status wydarzenia nie zmienia koloru paska — status jest pokazywany ikoną przy nazwie wydarzenia.
- Statusy magazynowe i księgowe są statusami pobocznymi i mogą mieć własną ikonę oraz kolor do paneli/etykiet.
