# Changelog V19 — import sprzętu i case z Excela

## Kod

Dodano:

- `apps/api/scripts/import-sprzet-case-excel.mjs`
- script w root `package.json`:
  - `pnpm import:sprzet`
- zależność root:
  - `xlsx`

## Baza danych

Nie dodano nowych tabel i nie zmieniono schematu Prisma.

Skrypt zapisuje dane do istniejących tabel:

- `kategorie`
- `modele`
- `egzemplarze`

## Mapowanie Excela

- `Kategoria` → `kategorie.nazwa`
- `Nazwa modelu` → `modele.nazwa`
- `Typ = Egzemplarz` → `modele.typ_sprzetu = sprzet`, rekord w `egzemplarze`
- `Typ = Ilościowe` → `modele.typ_sprzetu = sprzet`, rekordy w `egzemplarze`
- `Typ = Case` → `modele.typ_sprzetu = opakowanie`, egzemplarz case w `egzemplarze`
- `Kod kreskowy` → `egzemplarze.kod_kreskowy`, `qr_kod`, `zewnetrzny_kod_kreskowy`, `zewnetrzny_qr_kod`
- `Nr` → `egzemplarze.numer_egzemplarza` i `numer_urzadzenia`
- `Numer seryjny` → `egzemplarze.sn`
- wymiary/waga/wartość → pola modelu i egzemplarza

## Bezpieczeństwo importu

- skrypt ma `--dry-run`, żeby sprawdzić plik bez zapisu,
- skrypt domyślnie aktualizuje istniejące rekordy,
- można wyłączyć aktualizację przez `--no-update`,
- skrypt nie usuwa istniejących danych.
