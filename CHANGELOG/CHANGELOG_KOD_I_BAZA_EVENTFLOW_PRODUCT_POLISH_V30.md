# CHANGELOG — EventFlow Product Polish V30

## Kod

### `apps/web/components/SimpleModal.tsx`

- Dodano opcjonalny parametr `className`, żeby można było tworzyć większe modale bez psucia istniejących okien.
- Domyślny rozmiar modala pozostaje `max-w-3xl`, więc pozostałe moduły działają jak wcześniej.

### `apps/web/app/dashboard/offers/[id]/page.tsx`

- Przebudowano modal `Dodaj sprzęt do grupy`.
- Okno dostało większą szerokość `max-w-[1500px]`.
- Dodano hierarchiczny picker kategorii:
  - kategorie główne,
  - podkategorie zależne od wybranej kategorii głównej.
- Lista modeli jest czytelna i przewijalna.
- Dodano miniaturę zdjęcia modelu, kategorię, dostępność i cenę.
- Zachowano szybkie dodanie modelu z ilością.
- Zachowano panel pozycji oferty z możliwością ustawienia nazwy, sztuk, dni pracy, rabatu, ceny netto i opisu.

## Baza danych

Brak zmian w bazie danych.
