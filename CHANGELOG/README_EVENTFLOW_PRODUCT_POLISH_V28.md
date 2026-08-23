# EventFlow Product Polish V28

Zmiany:

- Zakładka **Sprzęt** w wydarzeniu używa teraz drzewa kategorii: kategorie główne + rozwijane podkategorie, tak jak w widoku magazynu.
- W planowaniu sprzętu nadal pracujemy na modelach i ilościach.
- Wydanie/przyjęcie nadal pracuje wyłącznie na konkretnych egzemplarzach.
- Wynajem/wypożyczenie został uporządkowany jako osobny byt.
- Wydanie sprzętu do wydarzenia nie tworzy wynajmu i nie jest z nim utożsamiane.
- W panelu wydarzenia usunięto zakładkę/licznik wynajmów.
- W module wynajmów usunięto przypisywanie wynajmu do wydarzenia.
- Oferty nadal mogą być przypisane do wydarzenia albo do wynajmu, ale wynajem nie przenosi już automatycznie wydarzenia.
- Dodano skrypt `fix:wynajmy-separate`, który czyści stare powiązania `wynajmy.id_wydarzenia`.

Baza:

- Kolumna `wynajmy.id_wydarzenia` zostaje tymczasowo jako pole techniczne/deprecated, żeby nie robić ryzykownego dropa danych.
- Relacja systemowa wynajem → wydarzenie nie jest już używana.
- Skrypt migracyjny ustawia stare `id_wydarzenia` w wynajmach na `NULL`.
