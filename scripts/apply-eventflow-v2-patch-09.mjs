#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const eventsPath = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');
const apiScriptSrc = path.join(root, 'EventFlow_v2_patch_09_case_prefix_01_fix/apps/api/scripts/fix-case-prefix-01-content.mjs');
const apiScriptDst = path.join(root, 'apps/api/scripts/fix-case-prefix-01-content.mjs');

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

if (!fs.existsSync(eventsPath)) fail(`Nie znaleziono ${eventsPath}`);
let text = fs.readFileSync(eventsPath, 'utf8');
const original = text;

const helper = `
  // EVENTFLOW_PATCH_09: kody zaczynające się od 01 traktujemy jako CASE/OPAKOWANIE.
  // Case służy tylko do rozwinięcia zawartości. Nie trafia do listy zeskanowanych ani na WZ/PZ.
  function normalizeCaseCodeValue(value: any) {
    return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  }
  function isCasePrefixCode(value: any) {
    const code = normalizeCaseCodeValue(value);
    return code.startsWith('01') && code.length >= 6;
  }
  function itemCodeCandidates(row: any): string[] {
    const egz = row?.egzemplarz || row || {};
    const model = row?.model || egz?.model || {};
    return [
      row?.kod,
      row?.code,
      row?.barcode,
      row?.kod_kreskowy,
      row?.zewnetrzny_kod_kreskowy,
      row?.qr_kod,
      row?.zewnetrzny_qr_kod,
      row?.sn,
      row?.numer_seryjny,
      row?.numer_egzemplarza,
      row?.numer_urzadzenia,
      row?.nr,
      row?.numer,
      egz?.kod,
      egz?.kod_kreskowy,
      egz?.zewnetrzny_kod_kreskowy,
      egz?.qr_kod,
      egz?.zewnetrzny_qr_kod,
      egz?.sn,
      egz?.numer_seryjny,
      egz?.numer_egzemplarza,
      egz?.numer_urzadzenia,
      model?.kod,
      model?.kod_kreskowy,
    ].filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map((v) => String(v));
  }
  function hasCasePrefixCode(row: any) {
    return itemCodeCandidates(row).some((value) => isCasePrefixCode(value));
  }
  function isSyntheticCaseHeaderRow(row: any) {
    const rawNumber = String(row?.nr || row?.numer || row?.numer_egzemplarza || row?.numer_urzadzenia || row?.nazwa_wiersza || row?.nazwa || '');
    const rawCode = String(row?.kod || row?.kod_kreskowy || row?.barcode || row?.qr_kod || row?.zewnetrzny_kod_kreskowy || row?.sn || '').trim();
    // Import case czasem zwraca nagłówek typu: "nr 13, 14, 15, 16" bez kodu kreskowego.
    return (!rawCode || rawCode === '-') && /\\b\\d+\\s*,\\s*\\d+/.test(rawNumber);
  }
  function isCaseLikeDocumentItem(row: any) {
    if (!row) return false;
    if (hasCasePrefixCode(row)) return true;
    if (isCase(row)) return true;
    if (isSyntheticCaseHeaderRow(row)) return true;
    const text = [
      row?.typ,
      row?.typ_sprzetu,
      row?.rowType,
      row?.rodzaj,
      row?.model?.typ_sprzetu,
      row?.egzemplarz?.model?.typ_sprzetu,
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes('case') || text.includes('opakowanie') || text.includes('skrzyn');
  }
  function filterCaseContentsForDocument(row: any) {
    const caseCodes = new Set(itemCodeCandidates(row).map(normalizeCaseCodeValue).filter(Boolean));
    return (row?.contents || row?.zawartosc_case || [])
      .filter((child: any) => isEquipmentInstance(child))
      .filter((child: any) => !isCaseLikeDocumentItem(child))
      .filter((child: any) => {
        const childCodes = itemCodeCandidates(child).map(normalizeCaseCodeValue).filter(Boolean);
        return !childCodes.some((code) => caseCodes.has(code));
      });
  }
`;

if (!text.includes('EVENTFLOW_PATCH_09')) {
  const anchor = "function numberOf(row: any) { const egz = row?.egzemplarz || row; return egz?.numer_egzemplarza || egz?.numer_urzadzenia || egz?.sn || egz?.kod_kreskowy || ''; }";
  if (text.includes(anchor)) {
    text = text.replace(anchor, anchor + helper);
  } else {
    const fallback = "function isQuantityOnly(row: any)";
    const idx = text.indexOf(fallback);
    if (idx === -1) fail('Nie znalazłem miejsca do wstawienia helperów case prefix 01.');
    text = text.slice(0, idx) + helper + text.slice(idx);
  }
}

// Najważniejsze: przy skanie case używamy centralnego filtra, który usuwa case oraz nagłówki case.
text = text.replace(
  /const contents = \(row\.contents \|\| row\.zawartosc_case \|\| \[\]\)\s*\.filter\(\(child: any\) => !isCase\(child\) && isEquipmentInstance\(child\)\);/g,
  'const contents = filterCaseContentsForDocument(row);'
);

// Dodatkowe zabezpieczenie: jeśli poprzedni patch już zmieniał to miejsce inaczej, nadpisz tylko pierwszy prosty wariant.
text = text.replace(
  /const contents = \(row\.contents \|\| row\.zawartosc_case \|\| \[\]\)\s*\.filter\(\(child: any\) => isEquipmentInstance\(child\)\)\s*\.filter\(\(child: any\) => !isCaseLikeDocumentItem\(child\)\);/g,
  'const contents = filterCaseContentsForDocument(row);'
);

// Nie pokazuj w ręcznym wyszukiwaniu egzemplarzy z kodem/numerem zaczynającym się od 01.
text = text.replace(
  ".filter((x: any) => x.model?.typ_sprzetu !== 'opakowanie')",
  ".filter((x: any) => x.model?.typ_sprzetu !== 'opakowanie' && !hasCasePrefixCode(x))"
);

// Przed tworzeniem WZ/PZ jeszcze raz wyrzuć case z payloadu.
if (!text.includes('const safeDocItems = docItems.filter((p: any) => !isCaseLikeDocumentItem(p));')) {
  text = text.replace(
    "async function createDocument(type: 'wydanie' | 'przyjecie') { if (!docItems.length) return alert('Najpierw zeskanuj albo wybierz egzemplarze sprzętu.'); setError(''); try {",
    "async function createDocument(type: 'wydanie' | 'przyjecie') { const safeDocItems = docItems.filter((p: any) => !isCaseLikeDocumentItem(p)); if (!safeDocItems.length) return alert('Najpierw zeskanuj albo wybierz egzemplarze sprzętu.'); setError(''); try {"
  );
}
text = text.replace(/pozycje: docItems\.map\(\(p\) =>/g, 'pozycje: safeDocItems.map((p) =>');

if (text === original) {
  console.log('⚠️ Nie wykryłem zmian w page.tsx — możliwe, że patch 09 już był nałożony.');
} else {
  const backup = `${eventsPath}.bak_patch09_${Date.now()}`;
  fs.writeFileSync(backup, original);
  fs.writeFileSync(eventsPath, text);
  console.log('✅ Poprawiono filtrowanie case 01 w events/[id]/page.tsx');
  console.log('Backup:', path.relative(root, backup));
}

if (fs.existsSync(apiScriptSrc)) {
  fs.mkdirSync(path.dirname(apiScriptDst), { recursive: true });
  fs.copyFileSync(apiScriptSrc, apiScriptDst);
  console.log('✅ Skopiowano skrypt diagnostyczno-naprawczy:', path.relative(root, apiScriptDst));
} else {
  console.log('⚠️ Nie znaleziono skryptu fix-case-prefix-01-content.mjs w folderze patcha.');
}

console.log('\nGotowe. Zrestartuj API i frontend.');
