# EventFlow Product Polish V7

Patch kumulacyjny względem V6. Nakładać na czysty projekt z Gita tak samo jak wcześniejsze paczki.

## Najważniejsze poprawki

1. Klik w rekord w tabelach otwiera panel szczegółów rekordu. Tam, gdzie podpięto endpoint zapisu, dostępny jest zapis zmian.
2. Serwis jest domyślnie ukryty w kalendarzu, ale nadal można go włączyć filtrem.
3. Kalendarz ma węższe paski i łączone segmenty wpisów wielodniowych: początek ma zaokrąglenie lewe, środek jest prosty, koniec ma zaokrąglenie prawe.
4. Wypożyczenia i urlopy z list są klikalne przez panel szczegółów, a z kalendarza przechodzą do odpowiednich modułów.
5. Magazyn wewnętrzny dostał odporny widok bez błędu `item.cena_podstawowa.toFixed is not a function`.
6. Generator kodów kreskowych/QR wygląda jak lista etykiet do druku: jedna pod drugą, bez ramek dookoła każdej etykiety.
7. Dodawanie opakowania ma kod kreskowy i QR tak samo jak egzemplarz: domyślnie takie same, z checkboxem rozróżnienia.
8. Przeglądy, OC i serwisy floty trafiają do kalendarza floty i do kalendarza ogólnego jako wpisy informacyjne.
9. W ofercie można zmieniać kolor grupy sprzętowej z poziomu widoku oferty.

## Uwagi

- Nie usuwam starego kodu modułów. Zmiany oznaczane są komentarzami `EVENTFLOW_PRODUCT_POLISH_V7`.
- Ten patch nie dodaje nowych tabel. Korzysta ze schematu V6.
