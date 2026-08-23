# Changelog V32

## Backend

- `apps/api/src/oferty/oferty.service.ts`
  - Naprawiono synchronizację oferta ↔ wydarzenie.
  - Usunięto tworzenie technicznego wynajmu `SPRZET-EVENT`.
  - Synchronizacja zapisuje/odczytuje dane z `pozycje_sprzetu_wydarzen`.

- `apps/api/src/magazyn/magazyn.service.ts`
  - `getSprzetWydarzenia()` czyta plan sprzętu z dedykowanej tabeli.
  - `dodajSprzetDoWydarzenia()` zapisuje model + ilość do planu wydarzenia, bez tworzenia wynajmu.

- `apps/api/scripts/przenies-plan-sprzetu-z-wynajmow.mjs`
  - Przenosi stare dane z technicznych wynajmów `SPRZET-EVENT-*` do `pozycje_sprzetu_wydarzen`.

## Baza / Prisma

Dodano model:

```prisma
model PozycjaSprzetuWydarzenia
```

Tabela fizyczna:

```text
pozycje_sprzetu_wydarzen
```

Pola:

- `id`
- `id_organizacji`
- `id_wydarzenia`
- `id_modelu`
- `ilosc_planowana`
- `uwagi`
- `kolejnosc`
- standardowe pola aktywności i dat.

## Zachowanie systemu

- Oferta → wydarzenie: pozycje sprzętowe z oferty zastępują plan sprzętu wydarzenia.
- Wydarzenie → oferta: plan sprzętu wydarzenia tworzy sekcję `Sprzęt z wydarzenia`.
- Wynajmy nie są już używane do planowania sprzętu wydarzenia.
