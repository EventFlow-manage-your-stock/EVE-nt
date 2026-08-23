# EventFlow Product Polish V41

Patch porządkuje finalizację WZ/PZ po kliknięciu `Wydaj` / `Przyjmij` oraz podmienia logo na turkusowy brandpack EventFlow.

## Zakres

- Naprawa błędu 500 przy otwieraniu dokumentu magazynowego po wystawieniu WZ/PZ.
- Nowy ekran potwierdzenia dokumentu: `Pomyślnie wydano sprzęt` / `Pomyślnie przyjęto sprzęt`.
- Ekran pokazuje numer dokumentu, datę, wystawiającego, powiązanie z wydarzeniem/wynajmem, odbierającego i listę sprzętu.
- Z ekranu można otworzyć PDF do druku/pobrania dla klienta.
- PDF ma domyślny podpis wydającego zgodny z zalogowanym użytkownikiem, czyli osobą tworzącą dokument.
- Dla wynajmu backend wymaga pola `osoba_odbierajaca` przy wydaniu.
- Dla wydarzenia wystarczy informacja, z czyjego konta wyszedł sprzęt.
- Logo systemu podmienione na właściwy brandpack `05 Turkusowy`.

## Baza danych

Bez migracji i bez `db push`.
