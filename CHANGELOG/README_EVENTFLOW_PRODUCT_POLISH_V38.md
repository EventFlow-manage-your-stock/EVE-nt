# EventFlow Product Polish V38

Patch punktowy naprawiający walidację Prisma po V37.

## Zakres

- Dodano odwrotną relację `Kontrahent.wynajmy` dla `Wynajem.kontrahent`.
- Usunięto błędną relację `Wynajem.sprzet_planowany`, bo plan sprzętu wydarzenia należy do `Wydarzenie`, a nie do `Wynajem`.
- Bez zmian w logice UI.
- Bez zmian w strukturze danych poza poprawką definicji Prisma.

## Po co

Po V37 `prisma generate` mogło zatrzymać się na błędach:

- brak opposite relation field dla `Wynajem.kontrahent`,
- brak opposite relation field dla `Wynajem.sprzet_planowany`.
