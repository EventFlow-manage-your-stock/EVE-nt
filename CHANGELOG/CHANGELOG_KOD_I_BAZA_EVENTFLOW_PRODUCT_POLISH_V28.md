# Changelog V28 — kod i baza

## Kod

### Wydarzenia / Sprzęt

- Zmieniono picker sprzętu w zakładce wydarzenia `Sprzęt`.
- Kategorie są teraz pogrupowane jak w magazynie: kategoria główna → rozwijane podkategorie.
- Filtrowanie po kategorii głównej pokazuje modele z całej kategorii razem z podkategoriami.
- Filtrowanie po podkategorii zawęża listę do konkretnej podkategorii.

### Wynajmy

- Wynajem nie jest już pokazywany jako element wydarzenia.
- Usunięto zakładkę `Wynajmy` z panelu wydarzenia.
- Usunięto licznik wynajmów z nagłówka wydarzenia.
- Usunięto pole `Wydarzenie` z formularza dodawania i edycji wynajmu.
- Backend `WynajmyService` nie zapisuje już `id_wydarzenia` przy create/update.
- Kalendarz traktuje wynajmy jako osobne wpisy.

### Oferty

- Przy tworzeniu oferty z wynajmu nie jest już automatycznie ustawiane `id_wydarzenia`.
- Duplikacja oferty do wynajmu przypisuje kopię tylko do `id_wynajmu`.

## Baza danych

- `Wynajem.id_wydarzenia` oznaczono jako deprecated i pozostawiono tymczasowo dla bezpiecznego przejścia.
- Usunięto relację Prisma `Wydarzenie.wynajmy` oraz `Wynajem.wydarzenie`.
- Dodano skrypt `apps/api/scripts/odlacz-wynajmy-od-wydarzen.mjs`.
- Dodano migrację SQL: `UPDATE wynajmy SET id_wydarzenia = NULL WHERE id_wydarzenia IS NOT NULL;`.
