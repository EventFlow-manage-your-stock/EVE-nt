# EventFlow Product Polish V25

Poprawka magazynu: widok modeli bardziej jak NEW / pierwotny system.

## Zakres

- Lista modeli ma teraz kolumny operacyjne: SKU/kod, zdjęcie, nazwa, typ, kategoria, stan, dostępność, rezerwacje, cena, uwagi, magazyn i akcje.
- Dodano wyraźne akcje: podgląd, edycja, usunięcie modelu.
- Dodano pełną edycję modelu po wejściu w szczegóły.
- Dodano możliwość załączenia zdjęcia modelu z dysku.
- Zdjęcie modelu jest widoczne na liście i w szczegółach.
- Kod kreskowy/QR nadal należy do egzemplarza, nie do modelu.

## Baza danych

- Pole `modele.zdjecie` zmienione z `VARCHAR(500)` na `TEXT`, żeby mogło przechować URL albo base64 data URL.
