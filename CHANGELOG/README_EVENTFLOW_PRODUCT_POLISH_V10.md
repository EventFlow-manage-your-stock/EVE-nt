# EventFlow Product Polish V10

Patch V10 porządkuje logikę otwierania i edycji rekordów w modułach tabelarycznych.

## Główna zmiana

Kliknięcie rekordu nie powinno już otwierać surowego drawera z JSON-em albo przypadkowego modala. Rekord otwiera pełny moduł szczegółów/edycji w stylu pierwotnego panelu wydarzenia z GitHuba: breadcrumb, górne akcje, metryki, formularz, boczne informacje i zakładki.

## Dodane widoki edycji

- Kontrahent: `/dashboard/crm/[id]`
- Kontakt: `/dashboard/crm/contacts/[id]`
- Egzemplarz: `/dashboard/warehouse/items/[id]`
- Kategoria: `/dashboard/warehouse/categories/[id]`
- Opakowanie/case: `/dashboard/warehouse/packages/[id]`
- Pojazd: `/dashboard/fleet/[id]`
- Zgłoszenie serwisowe: `/dashboard/service/[id]`
- Status serwisowy: `/dashboard/service/statuses/[id]`
- Typ wydarzenia: `/dashboard/settings/event-types/[id]`

Wydarzenia, wynajmy, urlopy i oferty zostają na swoich dedykowanych panelach.

## Uwaga

Nie usuwałem starej logiki dodawania. Modale dodawania zostają. Zmieniony jest przede wszystkim flow: lista → klik rekordu → pełny moduł szczegółów/edycji → zapis.
