# EventFlow Product Polish V6

Patch poprawkowy po testach V5. Nakładaj go tak samo jak wcześniejsze paczki — najlepiej przez `rsync`, bez przeciągania folderów w Finderze.

## Najważniejsze zmiany

- Kalendarz przebudowany wizualnie w stronę układu z NEW / pierwotnego EventFlow:
  - domyślny widok miesięczny,
  - wąskie, kolorowe i klikalne paski,
  - status pokazywany tylko jako ikona przed nazwą,
  - wyraźne podświetlenie dzisiejszego dnia,
  - pastelowe kafelki dla minionych dni trwającego aktualnie wydarzenia,
  - łatwe filtrowanie: wydarzenia, wynajmy, nieobecności, serwis, flota,
  - wyszukiwarka wpisów.
- Naprawiony zapis edycji wydarzenia.
- Serwis ma dwa widoki: „Nasz widok” jako tablica statusów oraz „Lista”.
- Statusy serwisowe można edytować, przesuwać i usuwać.
- Naprawione dodawanie pojazdu we flocie — frontend używa właściwego endpointu `/api/flota/pojazdy`.
- W ofertach działa przycisk PDF — otwiera drukowalny widok w nowej karcie.
- W ofertach dodano mechanizm budżetu klienta:
  - budżet obniża proporcjonalnie tylko pozycje sprzętowe,
  - obsługa, nocleg, transport i usługi pozostają bez zmian,
  - można zaznaczyć grupy/sekcje, których ceny nie wolno zmieniać.

## Zasada zmian

Nie usuwałem napisanego wcześniej kodu na twardo. Nowe zmiany są oznaczane komentarzem `EVENTFLOW_PRODUCT_POLISH_V6`, a ukrywanie/zmiana zachowania jest robiona możliwie zachowawczo.
