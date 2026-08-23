# EventFlow Product Polish V44

Poprawka dokumentu WZ/PZ:

- podpisy na wydruku są zawsze w dwóch kolumnach i nie rozpadają się przy drukowaniu,
- podpis wydającego i odbierającego mają czytelne linie podpisu,
- na dokumencie i stronie potwierdzenia widoczna jest łączna waga wydania/przyjęcia,
- waga liczona jest jako: sprzęt + unikalne case/opakowania użyte przy skanie case,
- backend zwraca parent-case dla egzemplarzy z dokumentu, żeby frontend mógł policzyć wagę case.

Bez zmian w bazie danych.
