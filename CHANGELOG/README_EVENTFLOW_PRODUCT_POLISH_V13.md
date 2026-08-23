# EventFlow Product Polish V13

Patch V13 rozwija operacyjny moduł sprzętu w wydarzeniu oraz moduł wydań/przyjęć.

## Najważniejsze zmiany

- Zakładka **Sprzęt** w szczegółach wydarzenia pokazuje sprzęt przypisany do wydarzenia pogrupowany według kategorii.
- Sprzęt przypisany do wydarzenia jest liczony jako plan operacyjny, a wydania i przyjęcia zliczają realnie zeskanowane/wydane/przyjęte egzemplarze.
- Po kliknięciu **Wydaj** albo **Przyjmij** operator może skanować kody kreskowe / QR / SN. Każdy skan zwiększa ilość w koszyku operacji.
- Można też wyszukiwać ręcznie modele/egzemplarze i dobrać sprzęt dodatkowy spoza planu.
- Dokument WZ/PZ generuje drukowalny PDF z podziałem na kategorie, podsumowaniem ilości i miejscem na podpis.
- Moduł **Magazyn → Wydania i przyjęcia** korzysta z backendowego endpointu skanowania i również grupuje pozycje dokumentu według kategorii.

## Baza danych

Nie dodano nowych tabel. V13 wykorzystuje tabele z V12:

- `wydania_magazynowe`,
- `pozycje_wydan_magazynowych`,
- `wynajmy`,
- `pozycje_wynajmu`,
- `modele_sprzetu`,
- `egzemplarze`,
- `kategorie`.

## Ważne

Jeżeli `prisma db push` zapyta o reset bazy albo utratę danych, przerwij `CTRL+C` i sprawdź komunikat przed potwierdzeniem.
