# EventFlow Product Polish V5

Patch V5 jest kumulacyjny względem V3/V4 i można go nakładać na czysty projekt z Gita.

## Najważniejsze poprawki

- Naprawiono błąd `Cannot GET /api/kalendarz?...` przez usunięcie podwójnego prefiksu `api` z kontrolerów NestJS.
- Kokpit: przycisk `Dodaj` otwiera ten sam modal szybkiego dodawania co kalendarz, bez przechodzenia do kalendarza.
- Kalendarz: dalej startuje domyślnie w widoku miesięcznym i korzysta ze wspólnego komponentu dodawania.
- Wydarzenia / wynajmy / urlopy: listy z filtrowaniem, sortowaniem, wyszukiwaniem i dodawaniem.
- Kontrahenci: przywrócony działający przycisk GUS/MF po NIP, z poprawioną trasą `/api/gus/:nip`.
- Kategorie sprzętu: poprawiona obsługa zapisu, podkategorii, kolejności i ukrywania przez soft-delete.
- Opakowania: dodano działające `Dodaj`, które tworzy model typu `opakowanie` i egzemplarz/case.
- Ceny: dodano prosty, działający widok pobierania i masowego zapisu cen modeli.
- Serwis: poprawione trasy, statusy serwisowe zgodne ze screenem, działające tworzenie zgłoszeń.
- Flota: poprawione trasy i zapis pojazdu; daty OC/przeglądu zostają jako wpisy informacyjne w kalendarzu floty.
- Oferty: przy dodawaniu można wybrać starą ofertę jako szablon; backend kopiuje sekcje i pozycje.

## Ważne

Nie usuwano starego kodu intencjonalnie. Miejsca zmienione świadomie są opisane komentarzami `EVENTFLOW_PRODUCT_POLISH_V5`.
