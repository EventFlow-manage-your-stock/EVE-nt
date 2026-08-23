# EventFlow Product Polish V31

Poprawka dla modułu ofert:

- Dodano przycisk **Zapisz wszystkie zmiany** w widoku oferty.
- Przy masowej edycji cen, sztuk, dni pracy, rabatów, VAT, widoczności PDF itd. system zbiera zmiany i zapisuje je jednym kliknięciem.
- Pojedyncze zapisy pozycji nadal działają jak wcześniej.
- Usunięto komunikat `Synchronizacja zapisana w logice backendu`.
- Synchronizacja **Oferta → Wydarzenie** realnie przepisuje sprzęt z oferty do planu sprzętu wydarzenia.
- Synchronizacja **Wydarzenie → Oferta** realnie zaciąga plan sprzętu wydarzenia do sekcji `Sprzęt z wydarzenia` w ofercie.

Zasada pozostaje bez zmian:

- oferta / plan wydarzenia = modele + ilości,
- WZ/PZ = konkretne egzemplarze.

