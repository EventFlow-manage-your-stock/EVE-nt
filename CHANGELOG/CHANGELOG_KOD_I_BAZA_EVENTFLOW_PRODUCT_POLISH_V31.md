# CHANGELOG V31 — kod i baza danych

## Kod frontend

### `apps/web/app/dashboard/offers/[id]/page.tsx`

Dodano:

- `dirtyItems` — lokalny stan zmian pozycji oferty,
- `Zapisz wszystkie zmiany` w górnych akcjach i nad tabelą grup,
- zielony komunikat sukcesu po zapisie/synchronizacji,
- przekazywanie zmian z wierszy oferty do rodzica,
- realne komunikaty po synchronizacji zamiast `alert()`.

Zmiana UX:

- użytkownik może edytować wiele pozycji naraz i dopiero potem kliknąć **Zapisz wszystkie zmiany**,
- dalej może zapisywać pojedyncze pozycje przyciskiem w wierszu.

## Kod backend

### `apps/api/src/oferty/oferty.service.ts`

Zmieniono metodę:

- `synchronizujZWydarzeniem(...)`

Był placeholder zapisujący tylko log. Teraz robi realną synchronizację:

### Kierunek `offer-to-event`

- pobiera pozycje sprzętowe z aktualnej wersji oferty,
- wymaga, żeby oferta była przypisana do wydarzenia,
- tworzy/aktualizuje techniczny plan sprzętu wydarzenia,
- zastępuje aktualny plan sprzętu pozycjami z oferty,
- zapisuje log zmian.

### Kierunek `event-to-offer`

- pobiera plan sprzętu wydarzenia,
- tworzy albo aktualizuje sekcję `Sprzęt z wydarzenia`,
- zastępuje pozycje w tej sekcji aktualnym planem sprzętu,
- przelicza ofertę po synchronizacji.

## Baza danych

Brak nowych tabel i migracji.

Uwaga: aktualny techniczny plan sprzętu wydarzenia nadal korzysta z istniejącej struktury danych planu wydarzenia. Nie jest to wynajem biznesowy i nie powinien być pokazywany jako normalny wynajem w UI.
