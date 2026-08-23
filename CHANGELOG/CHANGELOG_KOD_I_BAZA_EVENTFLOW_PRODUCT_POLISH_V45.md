# CHANGELOG V45

## Backend

- `apps/api/src/magazyn/magazyn.service.ts`
  - Dodano niewidoczny marker `__EVENTFLOW_CASE_SCAN` do pozycji utworzonych ze skanu case.
  - Marker służy wyłącznie do doliczania wagi case i nie jest pokazywany klientowi.
  - Case nadal nie jest zapisywany jako pozycja WZ/PZ.

## Frontend

- `apps/web/app/dashboard/events/[id]/page.tsx`
  - Skan case dodaje wyłącznie sprzęt ze środka.
  - Pozycje sprzętu niosą metadane case potrzebne do liczenia wagi.

- `apps/web/app/dashboard/warehouse/receiving/page.tsx`
  - Analogicznie dla ręcznych WZ/PZ z magazynu.

- `apps/web/app/dashboard/warehouse/documents/[id]/page.tsx`
  - Ukrywa techniczne uwagi case.
  - Liczy wagę case tylko wtedy, gdy pozycja faktycznie pochodzi ze skanu case.

- `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`
  - To samo w PDF/drukowaniu.

## Baza

Brak migracji i brak zmian w schemacie.
