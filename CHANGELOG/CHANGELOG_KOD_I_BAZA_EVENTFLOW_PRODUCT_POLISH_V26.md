# EventFlow Product Polish V26 — changelog

## Kod

Zmieniono:

- `apps/web/app/dashboard/warehouse/page.tsx`

## UI

- Zastąpiono płaską listę wszystkich kategorii strukturą: kategorie główne + rozwijane podkategorie.
- Dodano podświetlanie aktywnej kategorii głównej i podkategorii.
- Dodano licznik modeli per kategoria z uwzględnieniem dzieci.
- Przebudowano tabelę modeli na układ bliższy NEW: SKU/kod, zdjęcie, nazwa, typ, kategoria, stany, rezerwacje, cena, magazyn, akcje.
- Dodano miniaturę zdjęcia modelu, z obsługą URL albo base64/data URL.

## Baza danych

- Brak nowych tabel.
- Brak zmian w Prisma.
