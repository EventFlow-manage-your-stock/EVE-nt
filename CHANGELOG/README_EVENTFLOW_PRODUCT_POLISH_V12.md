# EventFlow Product Polish V12

Patch V12 rozwija magazyn operacyjny i sprzęt wydarzenia.

## Zakres

- Opakowania/case pokazują podgląd egzemplarzy znajdujących się wewnątrz.
- W szczegółach opakowania można dodawać i usuwać egzemplarze z case.
- Modele mają przełącznik: sprzęt / opakowania / wszystkie.
- Egzemplarze mają przełącznik: sprzęt / opakowania/case / wszystkie.
- Opakowania mają przełącznik: egzemplarze opakowań / typy opakowań.
- Status magazynowy i księgowy wydarzenia pokazuje się na liście wydarzeń i w kalendarzu.
- Kalendarz pokazuje dodatkowe ikony statusu magazynowego i księgowego obok ikony statusu głównego.
- Dodano moduł `Wydania i przyjęcia` z wyszukiwaniem ręcznym, skanowaniem kodu i pozycjami dodatkowymi.
- Dodano dokumenty magazynowe WZ/PZ z potwierdzeniem do druku/zapisu PDF i polem podpisu.
- W panelu wydarzenia zakładka `Sprzęt` pozwala dodawać sprzęt do wydarzenia oraz generować wydanie/przyjęcie PDF.

## Ważne

Patch jest kumulacyjny względem V11 i nakłada się na czysty projekt z GitHuba tak samo jak poprzednie wersje.

Jeżeli Prisma `db push` zapyta o reset bazy albo utratę danych, przerwij i podeślij komunikat.
