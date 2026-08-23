# EventFlow Product Polish V20

Patch V20 poprawia moduł dodawania sprzętu do wydarzeń i ofert.

## Najważniejsze zmiany

- przebudowany panel `Sprzęt` w szczegółach wydarzenia:
  - większy, czytelniejszy panel z trzema trybami: plan, wydanie WZ, przyjęcie PZ,
  - lista sprzętu wydarzenia podzielona na kategorie,
  - czytelne liczniki plan / WZ / PZ,
  - boczny panel dodawania/skanowania sprzętu z koszykiem,
  - wyszukiwanie po nazwie, kategorii, kodzie i numerze seryjnym,
  - skan case dalej dodaje tylko egzemplarze ze środka, nie sam case.

- przebudowane dodawanie sprzętu do grupy w ofercie:
  - wygodny picker modeli sprzętu,
  - kategorie po lewej,
  - kafelki sprzętu pośrodku,
  - formularz pozycji oferty po prawej,
  - natychmiastowy podgląd wartości netto,
  - łatwa zmiana sztuk, dni pracy, rabatu i ceny netto.

## Baza danych

Brak zmian w bazie danych.

## Komentarze w kodzie

Zmiany kontynuują linię poprawek `EVENTFLOW_PRODUCT_POLISH`. Ten patch dotyczy głównie UX/UI i nie zmienia relacji bazodanowych.
