# Changelog V14 — kod i baza danych

## Frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`
- Rozbudowano zakładkę Sprzęt w panelu wydarzenia.
- Skanowanie case/opakowania dodaje do koszyka zawartość case, a nie sam case.
- Dodano komunikat informacyjny po rozwinięciu case.
- W koszyku dokumentu można edytować nazwę/numer egzemplarza widoczny na WZ/PZ.
- W trybach Wydaj/Przyjmij ręczna lista sprzętu ukrywa opakowania/case.
- Dodatkowo dodano brakujący import `DataTable`, żeby zakładka sprzętu nie wyrzucała błędu runtime.

### `apps/web/app/dashboard/warehouse/receiving/page.tsx`
- W module Magazyn → Wydania i przyjęcia skan case rozwija zawartość case do konkretnych egzemplarzy.
- Ręczne wyszukiwanie ukrywa opakowania/case jako pozycje dokumentu.
- W koszyku dokumentu można edytować nazwę/numer egzemplarza widoczny na PDF.
- Po zapisaniu dokumentu PDF otwiera się w nowej karcie.

### `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`
- Przebudowano PDF WZ/PZ pod wspólne wzornictwo z ofertami.
- Dodano układ: logo, dane dokumentu, wydarzenie/wynajem, podsumowanie, kategorie, modele i numery/nazwy egzemplarzy.
- Ukryto case/opakowania z PDF — widoczne są konkretne egzemplarze.

## Backend

### `apps/api/src/magazyn/magazyn.service.ts`
- `GET /api/magazyn/skan?kod=...` rozpoznaje case/opakowanie i zwraca `isCase: true` oraz `contents` z egzemplarzami wewnątrz.
- `POST /api/magazyn/dokumenty` defensywnie rozwija case na egzemplarze, gdyby case trafił bezpośrednio do payloadu.
- Dokumenty magazynowe zapisują konkretne egzemplarze, nie case.

## Baza danych

- Brak nowych tabel i migracji.
- Wykorzystano istniejącą relację self-reference egzemplarzy: `id_case`.
