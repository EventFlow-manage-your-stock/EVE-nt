# EventFlow Product Polish V9

Patch V9 dodaje edycję typów wydarzeń oraz poprawia kalendarz wielodniowy.

## Najważniejsze zmiany

- Dodano ekran `Ustawienia -> Typy wydarzeń`.
- Typy wydarzeń można dodawać, edytować, ukrywać i zmieniać ich kolejność.
- Kolor typu wydarzenia jest źródłem prawdy dla koloru paska w kalendarzu.
- Kalendarz renderuje wydarzenia wielodniowe jako jeden wspólny pasek przechodzący przez kilka dni tygodnia, podobnie jak w pierwotnym projekcie i kalendarzu Google.
- Status wydarzenia w kalendarzu dalej jest pokazywany jako sama ikona przed nazwą.

## Uwagi

Nie dodano nowych tabel w bazie. Wykorzystane zostały istniejące pola modelu `TypWydarzenia`: `nazwa`, `kolor`, `kolejnosc`, `aktywny`.
