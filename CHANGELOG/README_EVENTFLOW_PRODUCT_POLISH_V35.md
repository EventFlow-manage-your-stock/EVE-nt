# EventFlow Product Polish V35

Poprawka pod tryb ewidencji modelu sprzętu.

## Co dodano

- W dodawaniu modelu i edycji modelu pojawia się checkbox **Sprzęt ilościowy**.
- Jeśli checkbox jest zaznaczony, model jest liczony na sztuki, bez tworzenia egzemplarzy z numerem/SN.
- Jeśli checkbox jest odznaczony, model działa klasycznie: sprzęt ma fizyczne egzemplarze z własnym numerem, kodem i numerem seryjnym.
- Dla sprzętu ilościowego można podać:
  - stan ilościowy,
  - jednostkę,
  - kod kreskowy modelu do skanowania.
- Lista modeli pokazuje sprzęt ilościowy inaczej niż sprzęt z egzemplarzami.
- Backend zapisuje `tryb_ewidencji`, `ilosc_magazynowa`, `jednostka` i kod modelu tylko wtedy, gdy model jest ilościowy.

## Bez zmian w bazie

V34 dodał już pola:

- `tryb_ewidencji`,
- `ilosc_magazynowa`,
- `jednostka`.

V35 używa tych pól i nie dodaje nowych tabel.
