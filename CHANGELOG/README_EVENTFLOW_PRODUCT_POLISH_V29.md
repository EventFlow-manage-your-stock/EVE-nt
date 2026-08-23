# EventFlow Product Polish V29

Patch przebudowuje zakładkę Sprzęt w wydarzeniu tak, żeby dodawanie sprzętu było czytelne, proste i zgodne z workflow eventowym.

## Najważniejsze zmiany

- Po wejściu w Sprzęt użytkownik widzi listę sprzętu już przypisanego do wydarzenia.
- Lista jest podzielona tak jak w ofertach: kategoria główna / podkategoria / model.
- Przycisk Dodaj / zmień sprzęt otwiera czytelny panel edycji ilości, a nie jeden zbity blok.
- Kategorie są rozdzielone na:
  - kategorie główne,
  - podkategorie wyświetlane dopiero po wyborze kategorii głównej.
- Dodawanie sprzętu działa po modelach i ilościach.
- Nie ma koszyka przy planowaniu.
- Zmiana ilości przy modelu jest bezpośrednią zmianą planu sprzętu wydarzenia.
- Wydanie i przyjęcie dalej działają tylko na egzemplarzach.
- Skan case dalej rozwija case do egzemplarzy w środku; case nie trafia jako pozycja WZ/PZ.

## Bez zmian w bazie

V29 nie dodaje nowych tabel ani pól. To poprawka UI/workflow w evencie.
