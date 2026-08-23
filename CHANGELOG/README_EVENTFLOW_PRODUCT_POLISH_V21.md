# EventFlow Product Polish V21

Patch V21 poprawia najważniejszy workflow sprzętowy w wydarzeniach i ofertach.

## Najważniejsza zasada

Planowanie i oferta pracują na **modelach sprzętu oraz ilościach**.

Wydanie i przyjęcie magazynowe pracują wyłącznie na **konkretnych egzemplarzach**.

Czyli user może łatwo dodać do wydarzenia/oferty np. `Monitor 75" × 3`, ale przy WZ/PZ musi zeskanować lub ręcznie wybrać konkretne egzemplarze.

## Zmiany w UI wydarzenia

- W zakładce `Sprzęt` zostaje pasek trybów: `Dodaj do eventu`, `Wydaj`, `Przyjmij`.
- W trybie `Dodaj do eventu` panel po prawej pokazuje modele sprzętu, nie egzemplarze.
- Dodano wygodne przechodzenie po kategoriach.
- Przy każdym modelu jest pole ilości, np. `3`, i przycisk `Dodaj szt.`.
- Do koszyka planu trafia model + ilość.
- W trybach `Wydaj` i `Przyjmij` panel nadal pokazuje/skanuje tylko konkretne egzemplarze sprzętu.
- Case można skanować operacyjnie, ale dokument pokazuje tylko egzemplarze ze środka.

## Zmiany w UI oferty

- Picker sprzętu w ofercie pracuje na modelach.
- Dodano szybkie dodawanie: wpisujesz ilość przy modelu i klikasz `Dodaj szt.`.
- Nadal można kliknąć model i dopracować cenę, rabat, dni pracy oraz nazwę pozycji w prawym panelu.
- Komunikaty w UI jasno mówią, że egzemplarze wybierane są dopiero przy WZ/PZ.

## Baza danych

Brak nowych tabel i migracji. Patch zmienia logikę frontendową pracy z istniejącymi endpointami.

