# EventFlow v2 Patch 09 — case prefix 01

Zmiana:
- każdy kod/numer zaczynający się od `01` traktujemy jako case/opakowanie,
- case nie pojawia się w „Zeskanowane teraz”,
- case nie trafia na WZ/PZ,
- filtrowane są też nagłówki case typu `nr 13, 14, 15, 16` bez kodu kreskowego,
- dodany skrypt do wypięcia błędnych egzemplarzy `01...` z `id_case`.

Instalacja:

```bash
cd ~/Desktop/evf_piatek/EventFlow_v2
unzip -o ~/Downloads/EventFlow_v2_patch_09_case_prefix_01_fix.zip -d .
rsync -av EventFlow_v2_patch_09_case_prefix_01_fix/ .
node scripts/apply-eventflow-v2-patch-09.mjs
```

Diagnostyka bazy:

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
node apps/api/scripts/fix-case-prefix-01-content.mjs
```

Naprawa bazy:

```bash
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
node apps/api/scripts/fix-case-prefix-01-content.mjs --apply
```
