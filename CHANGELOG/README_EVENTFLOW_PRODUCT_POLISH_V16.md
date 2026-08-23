# EventFlow Product Polish V16

Patch poprawia moduł ofert po uwagach z testów V15.

## Najważniejsze zmiany

- W grupach sprzętowych oferty dodano osobny przycisk **Dodaj sprzęt**.
- Dodawanie sprzętu otwiera wygodny modal z wyszukiwarką modeli sprzętu, informacją o kategorii, dostępności i cenie podstawowej.
- Zostawiono osobny przycisk **Pozycja ręczna** dla usług, transportu, noclegu i niestandardowych pozycji.
- Dodano edycję nazwy/opisu/koloru/kolejności/budżetu grupy sprzętowej.
- Dodano usuwanie grupy sprzętowej po potwierdzeniu.
- Usuwanie grupy jest miękkie: grupa i jej pozycje dostają `aktywny=false`, nie są kasowane fizycznie z bazy.
- Lista oferty filtruje nieaktywne grupy i pozycje.

## Baza danych

Nie dodano nowych tabel ani kolumn. Patch wykorzystuje istniejące pola:

- `sekcje_oferty.aktywny`
- `sekcje_oferty.data_usuniecia`
- `pozycje_oferty.aktywny`
- `pozycje_oferty.data_usuniecia`

