# EventFlow v2 — Patch 11

Naprawia:

1. Sprzęt ilościowy w WZ/PZ:
   - skan kodu modelu ilościowego znowu otwiera pytanie o ilość,
   - checkbox przy sprzęcie ilościowym dalej dodaje brakującą ilość.

2. Racki:
   - rack pokazuje się na wydawce jako konkretny egzemplarz,
   - po zeskanowaniu racka system dodaje jedną pozycję racka,
   - rack nie rozpakowuje swojej zawartości jak case.

3. Case/opakowania:
   - case dalej nie pojawia się na liście dodawania sprzętu do wydarzenia/oferty,
   - case dalej służy jako skrót skanowania zawartości,
   - kody `01...` i `CASE-...` są traktowane jako case, ale rack ma pierwszeństwo.

## Instalacja

```bash
cd ~/Desktop/evf_piatek/EventFlow_v2
unzip -o ~/Downloads/EventFlow_v2_patch_11_quantity_rack_case_fix.zip -d .
node scripts/apply-eventflow-v2-patch-11.mjs
```
