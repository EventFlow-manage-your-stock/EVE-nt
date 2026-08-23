# EventFlow Product Polish V32

Poprawka synchronizacji sprzętu między ofertą i wydarzeniem.

Najważniejsza zmiana: plan sprzętu wydarzenia nie jest już zapisywany jako techniczny wynajem `SPRZET-EVENT`. Wynajem i wydarzenie są osobnymi bytami. Wydanie sprzętu do wydarzenia nie tworzy wynajmu.

## Co zmieniono

- Dodano dedykowaną tabelę `pozycje_sprzetu_wydarzen` dla planu sprzętu wydarzenia.
- `Wyślij ofertę do wydarzenia` zapisuje modele + ilości do planu sprzętu wydarzenia.
- `Zaciągnij sprzęt z wydarzenia` tworzy/odświeża sekcję `Sprzęt z wydarzenia` w ofercie.
- Zakładka sprzętu w wydarzeniu czyta plan z nowej tabeli, a nie z wynajmów.
- Dodano skrypt migracyjny, który przenosi stare techniczne wynajmy `SPRZET-EVENT-*` do nowej tabeli i dezaktywuje te techniczne wynajmy.

## Ważne

WZ/PZ nadal pracuje na konkretnych egzemplarzach. Oferta i plan wydarzenia pracują na modelach + ilościach.
