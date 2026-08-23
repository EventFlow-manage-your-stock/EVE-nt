# EventFlow Product Polish V4

Patch kumulacyjny do nałożenia na czysty projekt z GitHub. Zawiera poprawki z V3 oraz nową serię zmian V4 z listy ustaleń.

## Najważniejsze

- Logo EventFlow wróciło do lewego górnego rogu panelu.
- Pod logo pokazuje się informacja o zalogowanym użytkowniku.
- Kokpit: przycisk nazywa się po prostu `Dodaj`.
- Kalendarz startuje domyślnie w widoku miesięcznym i nie zostaje już na kółku ładowania po błędzie API.
- Moduły wydarzeń, kontrahentów, magazynu, serwisu, floty i ofert dostały listy z wyszukiwaniem/sortowaniem oraz dodawanie dopiero po przycisku `Dodaj`.
- Modele sprzętu nie pokazują kodu kreskowego; kody są po stronie egzemplarzy.
- Egzemplarze można dodać także z zakładki `Egzemplarze` przez wybór modelu.
- Generator naklejek otwiera osobną kartę A4 z QR/kodem kreskowym i przyciskiem `Drukuj / zapisz jako PDF`.
- Kategorie mają podkategorie, usuwanie i zmianę kolejności.
- Serwis ma statusy zgodne ze wzorem: zielony, żółty, czerwony, niebieski, zielony.
- Flota ma VIN, przebieg, przegląd, OC i kalendarz informacyjny.
- Oferty zostały przebudowane w kierunku NEW: nagłówek, podsumowanie, grupy sprzętowe/sekcje, pozycje, duplikacja oferty i duplikacja grupy.

## Ważne

Nie przeciągaj folderów w Finderze. Na macOS Finder potrafi zastąpić cały folder. Użyj `rsync` z pliku komend.
