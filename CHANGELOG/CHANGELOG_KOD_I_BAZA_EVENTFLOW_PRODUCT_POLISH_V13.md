# CHANGELOG V13 — kod i baza

## Backend

### `apps/api/src/magazyn/magazyn.controller.ts`

- Dodano endpoint:
  - `GET /api/magazyn/skan?kod=...`
- Endpoint służy do skanowania kodu kreskowego, QR, SN albo numeru egzemplarza podczas wydań i przyjęć.

### `apps/api/src/magazyn/magazyn.service.ts`

- Dodano metodę `znajdzSprzetPoKodzie()`:
  - szuka egzemplarza po `kod_kreskowy`, `zewnetrzny_kod_kreskowy`, `zewnetrzny_qr_kod`, `qr_kod`, `sn`, `numer_urzadzenia`, `numer_egzemplarza`,
  - zwraca model, kategorię, magazyn, case i kod.
- Rozbudowano `getSprzetWydarzenia()`:
  - zwraca plan sprzętu z pozycji wynajmów wydarzenia,
  - zwraca dokumenty WZ/PZ,
  - zlicza ilości planowane, wydane i przyjęte,
  - grupuje sprzęt według kategorii.
- Rozszerzono dane dokumentów magazynowych o kategorie modeli/egzemplarzy, żeby PDF mógł drukować sekcje kategorii.

## Frontend

### `apps/web/app/dashboard/events/[id]/page.tsx`

- Przebudowano zakładkę **Sprzęt** w panelu wydarzenia:
  - podział na kategorie,
  - liczniki: zaplanowano / wydano / przyjęto / koszyk,
  - tryby: `Dodaj do eventu`, `Wydaj`, `Przyjmij`,
  - skanowanie kodu kreskowego/QR/SN,
  - ręczne wyszukiwanie modeli i egzemplarzy,
  - sprzęt dodatkowy spoza planu,
  - koszyk operacji z podziałem na kategorie,
  - generowanie WZ/PZ do PDF.

### `apps/web/app/dashboard/warehouse/receiving/page.tsx`

- Moduł wydań/przyjęć korzysta z endpointu skanowania `/api/magazyn/skan`.
- Pozycje dokumentu są pogrupowane według kategorii.
- Kolejny skan tego samego egzemplarza zwiększa ilość zamiast dodawać duplikat.

### `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`

- PDF dokumentu magazynowego ma teraz:
  - podsumowanie ilości,
  - liczbę kategorii,
  - liczbę pozycji,
  - podział pozycji według kategorii,
  - sekcję podpisów.

## Baza danych

- Brak nowych tabel.
- Brak nowych kolumn.
- Wykorzystane są tabele dodane w V12.
