# EventFlow v2 patch 07 — skan case: pomijanie już rozliczonych egzemplarzy

Naprawia sytuację, w której skan case dodawał do aktualnego dokumentu egzemplarz, który był już wcześniej wydany/przyjęty w historii wydarzenia.

Dodatkowo dodaje skrypt diagnostyczny `apps/api/scripts/debug-case-scan.mjs`, żeby sprawdzić faktyczną zawartość case w bazie.
