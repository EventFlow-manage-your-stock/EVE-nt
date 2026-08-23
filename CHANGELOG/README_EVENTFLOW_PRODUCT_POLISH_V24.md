# EventFlow Product Polish V24

Przebudowa modułu **Sprzęt** w szczegółach wydarzenia.

## Główne założenie

- Planowanie sprzętu w wydarzeniu działa po **modelach i ilościach**.
- Wydanie i przyjęcie działa wyłącznie po **konkretnych egzemplarzach**.
- Case jest tylko skrótem skanowania; na dokument WZ/PZ trafiają egzemplarze ze środka, nie sam case.

## Co zmieniono

- Moduł sprzętu jest prostszy i bardziej podobny do workflow z NEW / pierwotnej wersji.
- Po wejściu w zakładkę Sprzęt użytkownik widzi od razu listę sprzętu przypisanego do wydarzenia z podziałem na kategorie.
- Plan sprzętu ma przycisk **Dodaj / zmień ilości**.
- Dodawanie nie ma koszyka: użytkownik wybiera kategorię i zmienia ilość przy modelu.
- WZ/PZ ma osobny tryb pracy ze skanerem.
- Po zeskanowaniu egzemplarza liczniki od razu pokazują ile jest wydane/przyjęte oraz ile jeszcze brakuje.
- Manualne wyszukiwanie w WZ/PZ pokazuje konkretne egzemplarze.
- PDF WZ/PZ dalej generuje się w nowej karcie.

