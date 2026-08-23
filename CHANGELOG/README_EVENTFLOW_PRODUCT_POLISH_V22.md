# EventFlow Product Polish V22

Patch dopracowuje panel sprzętu w wydarzeniu i picker sprzętu w ofercie.

Najważniejsze założenie utrzymane w systemie:

- planowanie wydarzenia/oferty odbywa się na modelach i ilościach,
- wydanie oraz przyjęcie odbywa się na konkretnych egzemplarzach,
- case/opakowanie może być skanowane jako skrót operacyjny, ale na dokument WZ/PZ trafiają tylko egzemplarze sprzętu.

## Zmiany

- Panel sprzętu w wydarzeniu jest scalony do jednego pionowego widoku w trybie planowania.
- Domyślna ilość przy modelach wynosi `0`, nie `1`.
- Zmiana ilości modelu z `0` na `1+` automatycznie dodaje model do koszyka planu pod spodem.
- Zmiana ilości z powrotem na `0` usuwa model z koszyka.
- Koszyk po zapisie planu czyści się razem z wartościami ilości przy modelach.
- Picker sprzętu w ofercie również startuje od ilości `0`, żeby przypadkiem nie dodawać pozycji.

## Baza danych

Bez zmian w schemacie bazy danych.
