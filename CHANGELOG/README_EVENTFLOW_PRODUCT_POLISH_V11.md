# EventFlow Product Polish V11

Patch V11 dodaje konfigurację statusów operacyjnych i porządkuje wyświetlanie ikon statusów.

## Co doszło

- Nowy moduł: `Ustawienia → Statusy operacyjne`.
- Możliwość dodawania, edycji, ukrywania/usuwania i zmiany kolejności:
  - głównych statusów wydarzeń,
  - statusów magazynowych wydarzeń,
  - statusów księgowych wydarzeń.
- Wygodny picker ikon statusów: gotowa lista ikon/emoji plus możliwość wpisania własnej.
- Ikona głównego statusu wydarzenia wyświetla się przy nazwie wydarzenia w listach, panelu i kalendarzu.
- Statusy magazynowe i księgowe dostały pola `ikona` w Prisma.
- Wpisy floty w kalendarzu mają ikonę auta `🚗`.

## Ważne

Patch jest kumulacyjny względem poprzednich wersji i jest przygotowany do nakładania na czysty projekt z GitHuba. Nie usuwa istniejącego kodu; nowe miejsca są opisane komentarzem `EVENTFLOW_PRODUCT_POLISH_V11`.
