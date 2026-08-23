# Changelog V40

## Kod
- `apps/api/src/magazyn/magazyn.service.ts` — walidacja obowiązkowego kodu modelu dla trybu `ilosciowe`, wyszukiwanie modeli po kodzie.
- `apps/web/app/dashboard/warehouse/models/page.tsx` — kod modelu widoczny tylko przy sprzęcie ilościowym, wymagany w formularzu dodawania.
- `apps/web/app/dashboard/warehouse/models/[id]/page.tsx` — kod modelu widoczny/wymagany tylko przy sprzęcie ilościowym.

## Baza
- Bez zmian w strukturze bazy. Pole `modele.kod_kreskowy` już istnieje.
