# EventFlow Product Polish V34

Poprawka dla sprzętu ilościowego oraz skanowania case.

## Co zmieniono

- Sprzęt ilościowy bez egzemplarzy, np. balast 25 kg x 90 szt., jest obsługiwany jako model + ilość.
- Po zeskanowaniu kodu modelu ilościowego system pyta, ile sztuk wydać/przyjąć.
- WZ/PZ dla sprzętu ilościowego zapisuje pozycję jako model + ilość, bez egzemplarza.
- Case nadal działa jako skrót skanowania: po zeskanowaniu case system dodaje egzemplarze znajdujące się w środku.
- Case nie trafia jako pozycja na dokument WZ/PZ.
- Import Excela dla typu `Ilościowe` zapisuje model z ilością magazynową, zamiast tworzyć fałszywe egzemplarze.

## Zasada działania

- Plan wydarzenia / oferta: modele + ilości.
- Wydanie/przyjęcie zwykłego sprzętu: konkretne egzemplarze.
- Wydanie/przyjęcie case: zeskanowany case rozwija się na egzemplarze w środku.
- Wydanie/przyjęcie sprzętu ilościowego: model + ilość sztuk.
