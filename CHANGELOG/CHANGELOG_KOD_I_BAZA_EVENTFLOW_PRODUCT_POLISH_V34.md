# Changelog V34

## Backend

- `apps/api/src/magazyn/magazyn.service.ts`
  - `GET /api/magazyn/skan?kod=...` szuka teraz nie tylko egzemplarzy, ale też modeli ilościowych po `modele.kod_kreskowy`.
  - Jeśli skanowany jest model ilościowy, API zwraca `rowType: 'ilosciowy_model'` oraz stan magazynowy.
  - `createDokumentMagazynowy` pozwala zapisać pozycję bez `id_egzemplarza`, ale tylko dla modelu oznaczonego jako sprzęt ilościowy.
  - Case nadal rozwijany jest na egzemplarze wewnątrz.

## Frontend

- `apps/web/app/dashboard/events/[id]/page.tsx`
  - Po skanie modelu ilościowego system pyta o ilość sztuk.
  - Liczniki WZ/PZ uwzględniają ilości, a nie tylko liczbę pozycji.
  - Lista skanów pokazuje ilość i jednostkę dla sprzętu ilościowego.

## Baza danych / Prisma

- `apps/api/prisma/schema.prisma`
  - Dodano do `ModelSprzetu`:
    - `tryb_ewidencji` — `egzemplarze` albo `ilosciowe`,
    - `ilosc_magazynowa`,
    - `jednostka`.

## Import

- `apps/api/scripts/import-sprzet-case-excel.mjs`
  - Typ `Ilościowe` tworzy/aktualizuje model z `tryb_ewidencji = 'ilosciowe'` i ilością magazynową.
  - Nie tworzy już sztucznych egzemplarzy dla pozycji ilościowych.
