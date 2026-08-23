# EventFlow Product Polish V19 — import sprzętu i case z Excela

Patch V19 dodaje skrypt importu sprzętu z Excela do bazy EventFlow.

## Plik wejściowy

Obsługiwane kolumny:

```text
Nazwa modelu | Nazwa | Typ | ilość | Nr | Kod kreskowy | Miejsce | Szerokość | Wysokość | Głębokość | Objętość | Waga | Kategoria | Numer seryjny | Wartość
```

Obsługiwane wartości `Typ`:

- `Egzemplarz` — tworzy/aktualizuje model sprzętu i konkretny egzemplarz.
- `Ilościowe` — tworzy model sprzętu i egzemplarze ilościowe.
- `Case` — tworzy model opakowania/case, egzemplarz case i opcjonalnie sprzęt znajdujący się w środku.

## Najważniejsza logika

- Kategorie tworzą się automatycznie po nazwie z kolumny `Kategoria`.
- Model sprzętu tworzony jest z `Nazwa modelu`.
- Egzemplarz tworzony jest z `Nazwa`, `Nr`, `Kod kreskowy`, `Numer seryjny`.
- Case/opakowanie tworzony jest jako model `typ_sprzetu = opakowanie`.
- Dla wiersza `Case` kolumna `Nazwa` jest nazwą case, a `Nazwa modelu` może zostać potraktowana jako sprzęt znajdujący się w case.
- Skrypt nie kasuje danych — domyślnie aktualizuje znalezione rekordy albo tworzy nowe.

## Tryby pozycji ilościowych

Domyślnie `Ilościowe` tworzy tyle egzemplarzy, ile wynika z kolumny `ilość`:

```bash
--ilosciowe-mode egzemplarze
```

Dla pozycji ilościowej z kodem `0000000002619` i ilością `16` skrypt utworzy egzemplarze z kodami:

```text
0000000002619-001
0000000002619-002
...
0000000002619-016
```

Alternatywnie można użyć trybu pseudo:

```bash
--ilosciowe-mode pseudo
```

Wtedy powstanie jeden egzemplarz opisujący pozycję ilościową, np. `ILOŚĆ:16`.

## Tryby case

Domyślnie case tworzy również zawartość case, jeśli `Nazwa modelu` różni się od `Nazwa`:

```bash
--case-content create
```

Możesz wyłączyć tworzenie zawartości case:

```bash
--case-content skip
```

## Test bez zapisu

```bash
pnpm import:sprzet -- --file ~/Desktop/sprzet.xlsx --org 1 --dry-run
```

## Import właściwy

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm import:sprzet -- --file ~/Desktop/sprzet.xlsx --org 1
```

## Import po subdomenie organizacji

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm import:sprzet -- --file ~/Desktop/sprzet.xlsx --subdomena pixel
```
