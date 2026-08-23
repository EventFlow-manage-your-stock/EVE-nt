# EventFlow Product Polish V42

Poprawka PDF/drukowania dokumentów WZ/PZ.

## Zmiany
- Strony `/dashboard/warehouse/documents/[id]/pdf` nie dziedziczą już bocznego menu dashboardu.
- Print preview pokazuje wyłącznie dokument magazynowy, bez sidebaru i menu systemu.
- Dokument ma wymiar A4, czyste tło i układ przygotowany do druku/zapisu jako PDF.
- Przycisk `Drukuj` na stronie potwierdzenia otwiera PDF z parametrem `?drukuj=1` i automatycznie uruchamia okno drukowania po wczytaniu danych.
- Przycisk `PDF do druku` nadal otwiera podgląd dokumentu bez automatycznego print dialogu.

Bez zmian w bazie danych.
