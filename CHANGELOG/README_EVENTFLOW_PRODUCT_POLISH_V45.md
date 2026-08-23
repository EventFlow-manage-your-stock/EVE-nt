# EventFlow Product Polish V45

Poprawka logiki case na WZ/PZ.

## Co zmieniono

- Case/opakowanie zeskanowane przy WZ/PZ nie trafia jako pozycja listy sprzętu.
- Na liście dokumentu widać tylko realny sprzęt ze środka case.
- Waga case jest doliczana do łącznej wagi dokumentu, ale sam case pozostaje niewidoczny w tabeli sprzętu.
- Techniczny marker skanu case jest ukrywany w podglądzie i PDF, więc klient nie widzi wpisów typu `Zeskanowano case` w uwagach.
- Skan case w zakładce Sprzęt wydarzenia oraz w Magazyn → Wydania i przyjęcia przekazuje informację, z którego case pochodzi sprzęt.

## Baza danych

Bez zmian w bazie. Nie wykonywać `db push`.
