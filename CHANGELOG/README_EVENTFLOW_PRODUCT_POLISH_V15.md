# EventFlow Product Polish V15

Patch poprawia dwa obszary zgłoszone po V14:

1. **Wydania/przyjęcia magazynowe**
   - WZ/PZ pokazują i zapisują wyłącznie konkretne egzemplarze sprzętu.
   - Modele nie mogą być pozycją dokumentu WZ/PZ.
   - Opakowanie/case nie jest pozycją dokumentu; po skanie case system rozwija zawartość i dodaje egzemplarze sprzętu ze środka.
   - W koszyku operacji można edytować nazwę/numer egzemplarza widoczne na PDF.
   - W module Magazyn → Wydania i przyjęcia ukryto dodawanie modeli i pozycji ręcznych do dokumentów WZ/PZ.

2. **Oferty**
   - Dodano wygodną edycję inline pozycji oferty: liczba sztuk, dni pracy, cena netto, rabat %, VAT, typ pozycji, opis i widoczność w PDF.
   - Dodano szybkie plus/minus dla sztuk, dni pracy i rabatu.
   - Dodano zapis pojedynczej pozycji bez przebudowy całej oferty.
   - Dodano usuwanie pozycji oferty.
   - Dodano szybkie rabatowanie całej grupy sprzętowej/sekcji.

Patch jest kumulacyjny względem V14.
