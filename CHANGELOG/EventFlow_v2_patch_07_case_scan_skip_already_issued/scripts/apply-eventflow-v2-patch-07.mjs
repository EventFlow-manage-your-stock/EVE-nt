#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');

if (!fs.existsSync(pagePath)) {
  console.error('Nie znaleziono pliku:', pagePath);
  process.exit(1);
}

let text = fs.readFileSync(pagePath, 'utf8');
let changed = false;

function replaceOnce(search, replacement, label) {
  if (text.includes(search)) {
    text = text.replace(search, replacement);
    changed = true;
    console.log('✅', label);
  } else {
    console.log('ℹ️ Pominięto / już zmienione:', label);
  }
}

const helpers = `function instanceIdOf(row: any) {
  const egz = row?.egzemplarz || row;
  const id = Number(row?.id_egzemplarza || row?.egzemplarz_id || egz?.id_egzemplarza || egz?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}
function alreadyProcessedInstanceIdsForCurrentMode() {
  const ids = new Set<number>();
  (data.pozycje_dokumentow || []).forEach((p: any) => {
    const id = instanceIdOf(p);
    if (!id) return;
    if (mode === 'wydanie' && p.zrodlo === 'wydanie') ids.add(id);
    if (mode === 'przyjecie' && p.zrodlo === 'przyjecie') ids.add(id);
  });
  return ids;
}
`;

if (!text.includes('function alreadyProcessedInstanceIdsForCurrentMode()')) {
  replaceOnce(
    `function normalizeDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {`,
    `${helpers}function normalizeDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {`,
    'dodano helpery instanceIdOf/alreadyProcessedInstanceIdsForCurrentMode'
  );
}

replaceOnce(
  `id_egzemplarza: row.id_egzemplarza || egz.id,`,
  `id_egzemplarza: instanceIdOf(row),`,
  'normalizeDocumentItem używa stabilnego instanceIdOf'
);

replaceOnce(
  `const existingIds = new Set(prev.map((p: any) => Number(p.id_egzemplarza)).filter(Boolean)); const toAdd: any[] = []; for (const item of normalized) { const id = Number(item.id_egzemplarza); if (!id || existingIds.has(id)) continue; existingIds.add(id); toAdd.push(item); } const skipped = normalized.length - toAdd.length;`,
  `const existingIds = new Set(prev.map((p: any) => instanceIdOf(p)).filter(Boolean)); const alreadyProcessedIds = alreadyProcessedInstanceIdsForCurrentMode(); const toAdd: any[] = []; let skippedCurrent = 0; let skippedHistory = 0; for (const item of normalized) { const id = instanceIdOf(item); if (!id) continue; if (existingIds.has(id)) { skippedCurrent++; continue; } if (alreadyProcessedIds.has(id)) { skippedHistory++; continue; } existingIds.add(id); toAdd.push(item); } const skipped = normalized.length - toAdd.length; const skipInfo = [skippedCurrent ? \`duplikaty w aktualnym skanie: \${skippedCurrent}\` : '', skippedHistory ? \`już wcześniej rozliczone: \${skippedHistory}\` : ''].filter(Boolean).join(', ');`,
  'addDocumentItemsBulk pomija aktualne duplikaty oraz sprzęt już wydany/przyjęty wcześniej'
);

replaceOnce(
  `setNotice(sourceLabel ? \`${sourceLabel}: wszystkie egzemplarze z tego skanu są już na aktualnym dokumencie.\` : 'Ten sprzęt jest już zeskanowany na aktualnym dokumencie.'); return prev;`,
  `setNotice(sourceLabel ? \`${sourceLabel}: nie dodano nowych egzemplarzy${'${'}skipInfo ? \` (${ '${'}skipInfo})\` : ''}.\` : \`Ten sprzęt jest już zeskanowany albo wcześniej rozliczony${'${'}skipInfo ? \` (${ '${'}skipInfo})\` : ''}.\`); return prev;`,
  'komunikat gdy skan nic nie dodał pokazuje powód'
);

// Powyższy replacement z zagnieżdżonym template literalem jest trudny do zapisu jako literal.
// Jeśli nie wszedł idealnie, poprawiamy prostszym regexem poniżej.
text = text.replace(
  /setNotice\(sourceLabel \? `\$\{sourceLabel\}: nie dodano nowych egzemplarzy\$\{skipInfo \? ` \(\$\{skipInfo\}\)` : ''\}\.` : `Ten sprzęt jest już zeskanowany albo wcześniej rozliczony\$\{skipInfo \? ` \(\$\{skipInfo\}\)` : ''\}\.`\); return prev;/g,
  "setNotice(sourceLabel ? `${sourceLabel}: nie dodano nowych egzemplarzy${skipInfo ? ` (${skipInfo})` : ''}.` : `Ten sprzęt jest już zeskanowany albo wcześniej rozliczony${skipInfo ? ` (${skipInfo})` : ''}.`); return prev;"
);

replaceOnce(
  `skipped ? \`, pominięto duplikaty: ${'${'}skipped}\` : ''`,
  `skipInfo ? \`, ${'${'}skipInfo}\` : ''`,
  'notice case używa skipInfo'
);

// Drugi taki sam fragment może wystąpić w komunikacie dla pojedynczego skanu.
if (text.includes("skipped ? `, pominięto duplikaty: ${skipped}` : ''")) {
  text = text.replaceAll("skipped ? `, pominięto duplikaty: ${skipped}` : ''", "skipInfo ? `, ${skipInfo}` : ''");
  changed = true;
  console.log('✅ podmieniono pozostałe komunikaty duplikatów');
}

replaceOnce(
  `pozycje: docItems.map((p) => ({ ...p, ilosc: Number(p.ilosc || 1), status: type === 'wydanie' ? 'wydany' : 'przyjety' })),`,
  `pozycje: docItems.filter((p: any) => !isCase(p) && (isQuantityOnly(p) || instanceIdOf(p) || Number(p.id_modelu))).map((p) => ({ ...p, ilosc: Number(p.ilosc || 1), status: type === 'wydanie' ? 'wydany' : 'przyjety' })),`,
  'createDocument nie wysyła case ani pustych pozycji'
);

if (changed) {
  fs.writeFileSync(pagePath, text, 'utf8');
  console.log('\n✅ Patch 07 zastosowany:', pagePath);
} else {
  console.log('\nℹ️ Patch 07 nie znalazł nic do zmiany albo był już zastosowany.');
}
