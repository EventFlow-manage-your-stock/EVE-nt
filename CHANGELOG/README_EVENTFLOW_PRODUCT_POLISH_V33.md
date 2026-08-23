# EventFlow Product Polish V33

Poprawka punktowa modułu wydawania/przyjmowania sprzętu po skanowaniu case.

## Zmiany

- Skan case w zakładce Sprzęt wydarzenia dodaje teraz hurtowo wszystkie egzemplarze znajdujące się w case.
- Case nadal nie trafia jako pozycja dokumentu WZ/PZ.
- Liczniki WZ/PZ przy modelach aktualizują się od razu o wszystkie egzemplarze z case.
- Przycisk `Skanuj` po prawej stronie pola działa jako aktywacja pola tekstowego, jeśli pole jest puste.
- Jeśli w polu jest kod, przycisk wykonuje skan.
- Po skanie pole tekstowe jest automatycznie czyszczone i focus wraca do pola, żeby skanować kolejną sztukę.
- Do patcha włączono też poprawkę typu `uwagi?: string | null | undefined` w backendzie, żeby nie wrócił błąd kompilacji z V32.

## Ważne założenie

Plan wydarzenia i oferta pracują po modelach i ilościach. WZ/PZ działa tylko po konkretnych egzemplarzach. Case jest tylko skrótem skanowania.
