# EventFlow Product Polish V14

Patch V14 dopracowuje wydania i przyjęcia sprzętu w wydarzeniu oraz w module magazynowym.

## Najważniejsze zmiany

- PDF WZ/PZ otwiera się w nowej karcie po zapisaniu dokumentu.
- PDF WZ/PZ ma wspólne wzornictwo z PDF ofert: logo, nagłówek, układ A4, pomarańczowe belki kategorii, tabela pozycji, podsumowanie i podpisy.
- Skanowanie case/opakowania nie dodaje case jako pozycji dokumentu.
- Po skanie case system rozwija jego zawartość i dodaje konkretne egzemplarze znajdujące się w środku.
- Na WZ/PZ widoczne są egzemplarze, a nie opakowania/case.
- Pozycje na PDF są prezentowane jako: kategoria → model → numery/nazwy egzemplarzy.
- Przy generowaniu WZ/PZ można edytować nazwę/numer egzemplarza widoczny na dokumencie.
- Ręczne wyszukiwanie do WZ/PZ nie pokazuje opakowań jako pozycji do wydania/przyjęcia.
- Backend defensywnie rozwija case również wtedy, gdy case trafi do `POST /api/magazyn/dokumenty` bezpośrednio.

## Baza danych

Nie dodano nowych tabel. Patch korzysta z istniejącej relacji `egzemplarze.id_case -> egzemplarze.id` i tabel `wydania_magazynowe` oraz `pozycje_wydan_magazynowych` dodanych wcześniej.
