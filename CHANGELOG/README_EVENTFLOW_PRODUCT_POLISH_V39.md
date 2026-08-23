# EventFlow Product Polish V39

Punktowa poprawka kompilacji API po V37/V38.

## Co poprawia

- usuwa przypadkowo wklejone bloki aktualizacji stanu ilościowego z metod: usuwanie modelu, tworzenie/edycja/usuwanie egzemplarza,
- zostawia aktualizację stanu ilościowego wyłącznie w `createDokumentMagazynowy`, gdzie istnieją `typ` i `expandedPozycje`,
- nie zmienia bazy danych.

## Ważne

Nie uruchamiaj `db push` dla tej poprawki. Wystarczy `prisma generate` i restart API.
