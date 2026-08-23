# CHANGELOG V37

## Backend

- `apps/api/src/magazyn/magazyn.service.ts`
  - przebudowano `znajdzSprzetPoKodzie`, aby najpierw szukać case/opakowania po kodzie,
  - jeżeli ten sam kod jest na case i na egzemplarzu w środku, backend traktuje to jako skan case,
  - zwracane `contents` case zawierają wszystkie aktywne egzemplarze ze środka,
  - sprzęt ilościowy zwraca `kod` i `kod_kreskowy`,
  - modele ilościowe w `getModeleSprzetu` zwracają realny kod kreskowy modelu,
  - dokument WZ/PZ zmienia `ilosc_magazynowa` dla sprzętu ilościowego.

## Frontend

- `apps/web/app/dashboard/events/[id]/page.tsx`
  - na liście zeskanowanych pozycji sprzęt ilościowy pokazuje ilość i kod modelu.

## Schemat bazy

- bez zmian.
