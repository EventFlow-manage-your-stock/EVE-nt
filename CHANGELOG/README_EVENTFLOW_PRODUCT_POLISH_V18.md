# EventFlow Product Polish V18

Poprawka kalendarza operacyjnego po testach widoku miesięcznego.

## Zmiany

- Wynajmy powiązane z wydarzeniem nie tworzą już osobnych pomarańczowych pasków w kalendarzu.
- W kalendarzu pozostają widoczne tylko samodzielne wynajmy/wypożyczenia bez przypisanego wydarzenia.
- Poprawiono pozycję pasków względem dzisiejszego dnia — paski zaczynają się niżej i nie nachodzą na podświetloną liczbę dnia.
- Tydzień/kafel dnia rozszerza się dynamicznie do liczby wydarzeń. Nie ma limitu 10 rzędów ani ucinania pasków.
- Paski wielodniowe nadal łączą się w jeden pasek przechodzący przez kilka dni.

## Baza danych

Brak nowych tabel i brak migracji. Zmieniono wyłącznie logikę API kalendarza oraz widok frontendowy.
