# EventFlow Product Polish V37

Poprawka punktowa dla skanowania case i sprzętu ilościowego.

## Zakres

- Skan case/opakowania ma pierwszeństwo przed skanem pojedynczego egzemplarza, jeżeli kod występuje w obu miejscach.
- Case rozwija się do pełnej zawartości i dodaje wszystkie egzemplarze ze środka na WZ/PZ.
- Case nadal nie jest pozycją dokumentu.
- Sprzęt ilościowy pokazuje kod modelu w listach i po skanie.
- WZ zmniejsza stan sprzętu ilościowego, PZ zwiększa stan sprzętu ilościowego.

## Baza danych

Bez zmian w schemacie Prisma.
