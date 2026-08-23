# EventFlow v2 patch 12 — WZ/PZ: sprzęt ilościowy + rack + case

Naprawia logikę wydawki/przyjęcia na stronie wydarzenia:

- sprzęt ilościowy po skanie jest dodawany jako model + ilość,
- rack po skanie jest jedną konkretną pozycją,
- case nadal rozwija zawartość,
- kody case zaczynające się od `01` nie trafiają jako pozycje WZ/PZ,
- zawartość case z API jest dodatkowo filtrowana po stronie backendu.

Instalacja:

```bash
cd ~/Desktop/evf_piatek/EventFlow_v2
unzip -o ~/Downloads/EventFlow_v2_patch_12_wydawka_quantity_rack_fix.zip -d .
rsync -av EventFlow_v2_patch_12_wydawka_quantity_rack_fix/ .
node scripts/apply-eventflow-v2-patch-12.mjs
```

Potem:

```bash
cd ~/Desktop/evf_piatek/EventFlow_v2/apps/api
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" \
pnpm exec prisma generate --schema=prisma/schema.prisma
```
