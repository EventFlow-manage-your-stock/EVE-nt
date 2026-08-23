# CHANGELOG — EventFlow Product Polish V16

## Frontend

### `apps/web/app/dashboard/offers/[id]/page.tsx`

Dodano:

- stan `showSectionEdit` dla edycji grupy sprzętowej,
- stan `showEquipment` dla dodawania sprzętu z listy modeli,
- wyszukiwarkę `equipmentSearch`,
- modal **Dodaj sprzęt do grupy**,
- modal **Edytuj grupę**,
- przyciski w nagłówku każdej grupy:
  - `Edytuj nazwę`,
  - `Dodaj sprzęt`,
  - `Pozycja ręczna`,
  - `Usuń grupę`,
- funkcje:
  - `openEditSection`,
  - `saveSectionEdit`,
  - `deleteSection`,
  - `openAddEquipment`,
  - `pickEquipmentModel`,
  - `addEquipment`.

Zachowano istniejącą edycję pozycji inline: sztuki, dni pracy, rabat, VAT, cena i widoczność w PDF.

## Backend

### `apps/api/src/oferty/oferty.controller.ts`

Dodano endpoint:

```http
DELETE /api/oferty/:id/sekcje/:sekcjaId
```

### `apps/api/src/oferty/oferty.service.ts`

Dodano metodę:

```ts
deleteSekcja(id_oferty, id_sekcji, id_organizacji)
```

Działanie:

- sprawdza, czy grupa należy do aktualnej wersji oferty,
- ustawia `aktywny=false` i `data_usuniecia` na grupie,
- ustawia `aktywny=false` i `data_usuniecia` na pozycjach tej grupy,
- przelicza wartości oferty.

Zmieniono `findOne`, żeby zwracał tylko aktywne sekcje i aktywne pozycje.

## Baza danych

Brak nowych migracji. Patch używa istniejących pól soft-delete.
