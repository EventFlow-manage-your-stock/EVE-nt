# EventFlow Product Polish V17

Patch kumulacyjny oparty na V16.

## Co poprawia

- W wydarzeniach dodaje wybór **Oferta główna / zaakceptowana**.
- W wyborze oferty głównej wydarzenia pokazuje wyłącznie oferty przypisane do tego konkretnego wydarzenia.
- W wypożyczeniach/wynajmach wybór **Oferta główna / zaakceptowana** pokazuje wyłącznie oferty przypisane do tego konkretnego wynajmu.
- Duplikowanie oferty nie przypisuje już automatycznie kopii do starego wydarzenia/wynajmu bez pytania.
- Po kliknięciu **Duplikuj** system otwiera modal z wyborem, do którego wydarzenia albo wynajmu przypisać duplikat.
- Dodałem wspólny komponent `OfferDuplicateTargetModal`, używany w liście ofert, panelu oferty, panelu wydarzenia i panelu wynajmu.

## Zmiany w bazie

Dodano opcjonalne pole w `Wydarzenie`:

```prisma
id_oferty_glownej Int?
oferta_glowna Oferta? @relation("OfertaGlownaWydarzenia", fields: [id_oferty_glownej], references: [id])
```

oraz odwrotną relację w `Oferta`:

```prisma
wydarzenia_glowne Wydarzenie[] @relation("OfertaGlownaWydarzenia")
```

Pole służy tylko do wskazania głównej/zaakceptowanej oferty wydarzenia. Wszystkie oferty nadal zostają normalnie przypisane przez `Oferta.id_wydarzenia` albo `Oferta.id_wynajmu`.
