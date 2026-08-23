# EventFlow Product Polish V8

Patch V8 przywraca panel szczegółów wydarzenia w stylu pierwotnej wersji z GitHuba i dopina relację ofert do wydarzeń oraz wynajmów.

## Najważniejsze

- Klik w wydarzenie z listy albo kalendarza otwiera panel wydarzenia, a nie prosty formularz.
- Panel wydarzenia ma nagłówek, dane wydarzenia, managera, harmonogram oraz zakładki: szczegóły, sprzęt, oferty, wynajmy, ekipa, flota, historia itd.
- Wydarzenie może mieć wiele ofert. W zakładce Oferty można dodać nową ofertę, otworzyć istniejącą, wygenerować PDF albo zduplikować ofertę.
- Wynajem ma osobny panel szczegółów pod `/dashboard/rentals/[id]`.
- Wynajem może mieć wiele ofert roboczych oraz jedną ofertę główną/zaakceptowaną.
- Klik w wynajem z kalendarza prowadzi do panelu wynajmu.
- Klik w urlop z kalendarza prowadzi do panelu urlopu.

## Uwaga

Nie usuwałem starego kodu. Nowe/zmienione miejsca mają komentarze `EVENTFLOW_PRODUCT_POLISH_V8`.
