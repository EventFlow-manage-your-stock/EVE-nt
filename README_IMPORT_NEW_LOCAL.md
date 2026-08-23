# NEW -> EVE-NT | lokalny import testowy

## Co robi

Importer jest przygotowany pod aktualny `apps/api/prisma/schema.prisma`.

Domyślnie:

1. usuwa wszystkie wydarzenia i dane zależne,
2. zachowuje `typy_wydarzen` i `statusy_wydarzen`,
3. czyści magazyn/sprzęt,
4. zachowuje `kategorie`,
5. zeruje wszystkie wpisy `uzytkownicy_role` w organizacji,
6. importuje wszystkich userów,
7. wszystkim userom ustawia hasło `zaq1@WSX`,
8. NIE tworzy żadnych uprawnień/roli,
9. importuje magazyny, modele, egzemplarze i CASE/RACK,
10. importuje wydarzenia + szczegóły + harmonogram + plan sprzętu.

## Ważne

To jest skrypt DESTRUKCYJNY dla lokalnej bazy testowej.

Ma blokadę bezpieczeństwa: domyślnie uruchomi się tylko dla DATABASE_URL
wskazującego na localhost / 127.0.0.1 / postgres / wms_postgres.

Nie używaj `--allow-nonlocal` na produkcji.

## Gdzie wkleić pliki

W repo utwórz:

apps/api/import/new/

Do tego katalogu możesz wrzucić całe katalogi eksportu.
Importer sam rekurencyjnie znajdzie:

- NEW_uzytkownicy.xlsx
- NEW_sprzet_do_EVE_NT_PRISMA.xlsx
- NEW_wydarzenia.xlsx

Np.:

apps/api/import/new/
├── users/
│   └── NEW_uzytkownicy.xlsx
├── gear/
│   ├── NEW_sprzet_do_EVE_NT_PRISMA.xlsx
│   └── images/
└── events/
    └── NEW_wydarzenia.xlsx

## Instalacja skryptu

Skopiuj:

import-new-test-local.mjs

do:

apps/api/scripts/import-new-test-local.mjs

## Uruchomienie

Z katalogu `apps/api`:

pnpm prisma generate

node scripts/import-new-test-local.mjs \
  --data-dir ./import/new

Jeśli masz więcej niż jedną organizację:

node scripts/import-new-test-local.mjs \
  --data-dir ./import/new \
  --org-id 1

## Hasło

Domyślnie:

zaq1@WSX

Można zmienić:

--password INNE_HASLO

## Przydatne opcje

Tylko userzy:

--skip-gear --skip-events

Bez wydarzeń:

--skip-events

Bez sprzętu:

--skip-gear

Nie czyść danych przed importem:

--no-reset

## Dane użytkownika nieobecne w aktualnym schema.prisma

Aktualny `Uzytkownik` ma bezpośrednio:
- imie
- nazwisko
- email
- telefon
- haslo
- avatar
- aktywny
- data_ostatniego_logowania

Importer sprawdza fizyczne kolumny tabeli `uzytkownicy`.
Jeżeli lokalna baza ma już dodatkowe kolumny takie jak:
- data_urodzenia
- pesel
- nr_dokumentu
- miejscowosc
- itd.

to wypełni je automatycznie.

Jeśli tych kolumn nie ma, dane NIE giną:
zostają zapisane do:
IMPORT_USERS_REPORT.json

## Eventy – obecny testowy zakres importu

Importowane:
- wydarzenie
- typ (mapowanie do istniejącego)
- status (mapowanie do istniejącego)
- status księgowy
- klient
- EventManager
- miejsce ręczne
- opis
- szczegóły / uwagi
- data start/koniec
- harmonogram
- plan sprzętu

Na tym etapie nie są jeszcze tworzone jako rekordy DB:
- PDF-y ofert
- wersje ofert
- załączniki
- ekipa z surowego arkusza
- flota z surowego arkusza
- sprzęt zewnętrzny

Importer zapisze raport niedopasowanych typów/statusów/modeli.
