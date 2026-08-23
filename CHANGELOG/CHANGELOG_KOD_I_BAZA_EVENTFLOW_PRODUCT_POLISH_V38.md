# Changelog V38

## Prisma

- `apps/api/prisma/schema.prisma`
  - dodano `Kontrahent.wynajmy Wynajem[]`,
  - usunięto niepoprawne `Wynajem.sprzet_planowany PozycjaSprzetuWydarzenia[]`.

## Baza

- Nie wymaga `db push`, ponieważ patch naprawia relacje w schema Prisma.
