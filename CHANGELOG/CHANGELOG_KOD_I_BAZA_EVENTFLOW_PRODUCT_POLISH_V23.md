# Changelog V23

## Kod frontend

Zmieniono `apps/web/app/dashboard/events/[id]/page.tsx`:

- przebudowano widok `EquipmentPanel` w trybie planowania,
- domyślnie pokazuje się lista sprzętu przypisanego do wydarzenia,
- dodano przycisk `Dodaj / zmień ilości`, który otwiera edytor modeli,
- edytor ma filtrowanie po kategorii i wyszukiwarkę modeli,
- ilość przy modelu startuje od `0`, jeśli model nie jest jeszcze przypisany,
- zmiana ilości aktualizuje docelowy plan, bez koszyka,
- dodano listę „po zmianach”, która pokazuje dokładnie co zostanie zapisane,
- tryby `Wydaj` i `Przyjmij` zostały zostawione jako osobna praca na egzemplarzach.

## Kod backend

Zmieniono `apps/api/src/magazyn/magazyn.service.ts`:

- `dodajSprzetDoWydarzenia` obsługuje `replace: true`,
- przy `replace: true` aktualny automatyczny plan sprzętu wydarzenia jest zastępowany nowymi pozycjami,
- plan zapisuje modele + ilości, bez egzemplarzy,
- egzemplarze nadal pojawiają się dopiero na WZ/PZ.

## Baza danych

Nie dodano nowych tabel ani pól.

