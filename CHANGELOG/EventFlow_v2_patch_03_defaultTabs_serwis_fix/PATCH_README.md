# EventFlow_v2 patch 03 — defaultTabs / serwis fix

Naprawia błąd Next.js:

`Export defaultTabs doesn't exist in target module`

Błąd pojawiał się po wejściu w `/dashboard/service/[id]`, bo strona importuje `defaultTabs` z `apps/web/components/EntityEditorPage.tsx`, a komponent go nie eksportował.

## Instalacja

```bash
cd ~/Desktop/evf_piatek/EventFlow_v2
unzip -o ~/Downloads/EventFlow_v2_patch_03_defaultTabs_serwis_fix.zip -d .
node scripts/apply-eventflow-v2-patch-03.mjs
rm -rf apps/web/.next
NEXT_PUBLIC_API_URL="http://localhost:3002/api" pnpm --filter web dev
```
