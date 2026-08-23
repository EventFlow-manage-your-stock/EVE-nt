# CHANGELOG EventFlow Product Polish V17

## Backend

### `apps/api/src/oferty/oferty.controller.ts`

- Endpoint `POST /api/oferty/:id/duplikuj` przyjmuje teraz body z docelowym przypisaniem:
  - `id_wydarzenia`,
  - `id_wynajmu`.

### `apps/api/src/oferty/oferty.service.ts`

- `duplikujOferte(...)` przyjmuje `dto`.
- Duplikat może zostać przypisany do wskazanego wydarzenia albo wynajmu.
- Komentarz `EVENTFLOW_PRODUCT_POLISH_V17` wyjaśnia zmianę, żeby nie było niejasności w kodzie.

### `apps/api/src/wydarzenia/wydarzenia.service.ts`

- `findOne` i `findAll` pobierają `oferta_glowna`.
- `create` i `update` zapisują `id_oferty_glownej`.

### `apps/api/prisma/schema.prisma`

- Dodano relację oferta główna / zaakceptowana dla wydarzenia:
  - `Wydarzenie.id_oferty_glownej`,
  - `Wydarzenie.oferta_glowna`,
  - `Oferta.wydarzenia_glowne`.

## Frontend

### `apps/web/components/OfferDuplicateTargetModal.tsx`

- Nowy wspólny modal duplikacji oferty.
- Użytkownik wybiera, czy duplikat przypisać do wydarzenia czy wynajmu.
- Modal pobiera listę wydarzeń i wynajmów z API.

### `apps/web/app/dashboard/events/[id]/page.tsx`

- Dodano wybór **Oferta główna / zaakceptowana**.
- Lista w tym polu pokazuje tylko oferty przypisane do danego wydarzenia.
- Duplikowanie oferty w panelu wydarzenia otwiera modal wyboru docelowego wydarzenia/wynajmu.

### `apps/web/app/dashboard/rentals/[id]/page.tsx`

- Wybór **Oferta główna / zaakceptowana** korzysta tylko z ofert przypisanych do aktualnego wynajmu.
- Duplikowanie oferty w panelu wynajmu otwiera modal wyboru docelowego wydarzenia/wynajmu.

### `apps/web/app/dashboard/offers/page.tsx`

- Duplikowanie z listy ofert otwiera modal wyboru docelowego wydarzenia/wynajmu.

### `apps/web/app/dashboard/offers/[id]/page.tsx`

- Duplikowanie z panelu szczegółów oferty otwiera modal wyboru docelowego wydarzenia/wynajmu.
