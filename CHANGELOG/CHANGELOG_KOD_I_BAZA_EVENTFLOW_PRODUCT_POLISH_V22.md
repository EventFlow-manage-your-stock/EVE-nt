# CHANGELOG EventFlow Product Polish V22

## Kod

### apps/web/app/dashboard/events/[id]/page.tsx

- Zmieniono domyślne ilości modeli w panelu sprzętu z `1` na `0`.
- Dodano funkcję `setPlannedModelQuantity`, która synchronizuje pole ilości modelu z koszykiem planu.
- Ilość `0` oznacza brak sprzętu w planie.
- Ilość `1+` dodaje lub aktualizuje pozycję w koszyku.
- Tryb planowania sprzętu jest prezentowany jako jeden pionowy widok: aktualna lista sprzętu, picker modeli, koszyk do zapisania.
- Po zapisie planu czyszczony jest koszyk oraz wartości ilości przy modelach.

### apps/web/app/dashboard/offers/[id]/page.tsx

- Picker modeli w ofercie startuje od ilości `0`.
- Próba dodania sprzętu z ilością `0` pokazuje błąd, zamiast tworzyć przypadkową pozycję.
- Wybrany model z ilością `1+` jest wizualnie podświetlany.

## Baza danych

Brak zmian.
