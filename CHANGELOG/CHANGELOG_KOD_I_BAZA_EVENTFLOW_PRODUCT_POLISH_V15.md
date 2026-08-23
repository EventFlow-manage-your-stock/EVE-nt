# Changelog V15 — kod i baza danych

## Kod frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`
- Zmieniono zakładkę **Sprzęt** w panelu wydarzenia.
- Tryby `Wydaj` i `Przyjmij` przyjmują tylko egzemplarze sprzętu.
- Modele są widoczne w planowaniu, ale w WZ/PZ wymagany jest egzemplarz.
- Skan case/opakowania rozwija zawartość i dodaje egzemplarze ze środka.
- Duplikat skanu tego samego egzemplarza nie zwiększa ilości, tylko pokazuje komunikat.

### `apps/web/app/dashboard/warehouse/receiving/page.tsx`
- W module **Wydania i przyjęcia** ukryto dodawanie modeli do WZ/PZ.
- Usunięto możliwość dodawania pozycji ręcznej do dokumentów WZ/PZ.
- Lista ręczna pokazuje egzemplarze sprzętu bez opakowań.
- Ilość na WZ/PZ dla egzemplarza jest stała: 1 szt.

### `apps/web/app/dashboard/offers/[id]/page.tsx`
- Przepisano tabelę pozycji oferty na edycję inline.
- Dodano szybkie sterowanie sztukami, dniami pracy i rabatem.
- Dodano zapis i usuwanie pojedynczej pozycji.
- Dodano masowy rabat dla sekcji/grupy.
- Zachowano budżetowanie z poprzednich wersji.

## Kod backend

### `apps/api/src/magazyn/magazyn.service.ts`
- `createDokumentMagazynowy` odrzuca pozycje bez `id_egzemplarza` dla WZ/PZ.
- Zeskanowany case jest rozwijany na egzemplarze sprzętu; sam case nie zapisuje się jako pozycja dokumentu.
- Egzemplarze typu `opakowanie` są pomijane/odrzucane jako pozycje WZ/PZ.

### `apps/api/src/oferty/oferty.controller.ts`
- Dodano endpointy:
  - `PUT /api/oferty/:id/pozycje/:pozycjaId`
  - `DELETE /api/oferty/:id/pozycje/:pozycjaId`

### `apps/api/src/oferty/oferty.service.ts`
- Dodano `updatePozycja` i `deletePozycja`.
- Po zmianie ceny/sztuk/dni/rabatu/VAT pozycja jest przeliczana, a następnie przeliczana jest cała oferta.

## Baza danych

- Nie dodano nowych tabel.
- Nie dodano nowych kolumn.
- Prisma `db push` jest nadal bezpieczny względem struktury V14, o ile nie pokaże komunikatu o resecie bazy.
