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

const helper = `
  function normalizeScanValue(value: any) {
    return String(value ?? '').trim().toLowerCase().replace(/\\s+/g, '');
  }

  function scanValuesOf(row: any) {
    const egz = row?.egzemplarz || row;
    const model = row?.model || row?.egzemplarz?.model || egz?.model || {};
    return [
      row?.kod,
      row?.kod_kreskowy,
      row?.zewnetrzny_kod_kreskowy,
      row?.zewnetrzny_qr_kod,
      row?.qr_kod,
      row?.sn,
      row?.numer_seryjny,
      row?.numer_egzemplarza,
      row?.numer_urzadzenia,
      row?.barcode,
      row?.code,
      egz?.kod,
      egz?.kod_kreskowy,
      egz?.zewnetrzny_kod_kreskowy,
      egz?.zewnetrzny_qr_kod,
      egz?.qr_kod,
      egz?.sn,
      egz?.numer_seryjny,
      egz?.numer_egzemplarza,
      egz?.numer_urzadzenia,
      model?.kod,
      model?.kod_kreskowy,
      numberOf(row),
    ]
      .map(normalizeScanValue)
      .filter(Boolean);
  }

  function matchesAnyScanValue(row: any, codes: Set<string>) {
    if (!codes.size) return false;
    return scanValuesOf(row).some((value) => codes.has(value));
  }
`;

if (!text.includes('function normalizeScanValue(value: any)')) {
  const needle = "function numberOf(row: any) { const egz = row?.egzemplarz || row; return egz?.numer_egzemplarza || egz?.numer_urzadzenia || egz?.sn || egz?.kod_kreskowy || ''; }";
  if (text.includes(needle)) {
    text = text.replace(needle, needle + helper);
    changed = true;
  } else {
    const re = /function numberOf\(row: any\) \{[\s\S]*?\}\s*const modelCountByCategory/;
    const match = text.match(re);
    if (!match) {
      console.error('Nie udało się znaleźć funkcji numberOf w page.tsx. Podeślij fragment EquipmentPanel.');
      process.exit(1);
    }
    text = text.replace(match[0], match[0].replace('const modelCountByCategory', helper + ' const modelCountByCategory'));
    changed = true;
  }
}

// addDocumentItem musi znać surowy zeskanowany kod, żeby odfiltrować element case z zawartości.
text = text.replace(
  "function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual')",
  "function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual', scannedCode: string = '')"
);

// Jeżeli wcześniejszy patch dodał już parametr, powyższe nic nie zmieni — OK.

const oldContents = "const contents = (row.contents || row.zawartosc_case || []) .filter((child: any) => !isCase(child) && isEquipmentInstance(child));";
const newContents = `const scannedCaseCodes = new Set(scanValuesOf(row));
      if (scannedCode) scannedCaseCodes.add(normalizeScanValue(scannedCode));
      const rawCaseContents = row.contents || row.zawartosc_case || [];
      const contents = rawCaseContents
        .filter((child: any) => !isCase(child) && isEquipmentInstance(child))
        .filter((child: any) => !matchesAnyScanValue(child, scannedCaseCodes));`;

if (text.includes(oldContents)) {
  text = text.replace(oldContents, newContents);
  changed = true;
} else if (!text.includes('const scannedCaseCodes = new Set(scanValuesOf(row));')) {
  const re = /const contents = \(row\.contents \|\| row\.zawartosc_case \|\| \[\]\)\s*\.filter\(\(child: any\) => !isCase\(child\) && isEquipmentInstance\(child\)\);/;
  if (re.test(text)) {
    text = text.replace(re, newContents);
    changed = true;
  } else {
    console.warn('Uwaga: nie znalazłem starego filtra contents. Być może plik był już mocno zmieniony.');
  }
}

// Przekazanie realnie zeskanowanego kodu do addDocumentItem.
if (text.includes("addDocumentItem(response.data, 'scan');")) {
  text = text.replace("addDocumentItem(response.data, 'scan');", "addDocumentItem(response.data, 'scan', code);");
  changed = true;
}

// Dodatkowa asekuracja: nie wysyłaj na WZ/PZ pozycji oznaczonych jako case albo bez egzemplarza/modelu.
if (text.includes("pozycje: docItems.map((p) => ({ ...p, ilosc: Number(p.ilosc || 1), status: type === 'wydanie' ? 'wydany' : 'przyjety' }))")) {
  text = text.replace(
    "pozycje: docItems.map((p) => ({ ...p, ilosc: Number(p.ilosc || 1), status: type === 'wydanie' ? 'wydany' : 'przyjety' }))",
    "pozycje: docItems.filter((p) => !isCase(p) && (p.id_egzemplarza || p.id_modelu)).map((p) => ({ ...p, ilosc: Number(p.ilosc || 1), status: type === 'wydanie' ? 'wydany' : 'przyjety' }))"
  );
  changed = true;
}

fs.writeFileSync(pagePath, text);
console.log('✅ Patch 08 zastosowany w:', pagePath);
console.log('   - skan case filtruje po realnym kodzie skanowania');
console.log('   - element z numerem/kodem case nie trafi do „Zeskanowane teraz”');
console.log('   - WZ/PZ nie przyjmie pozycji case');

const fixScriptSource = path.join(root, 'apps/api/scripts/fix-case-code-content.mjs');
if (fs.existsSync(fixScriptSource)) {
  console.log('✅ Skrypt diagnostyczno-naprawczy jest dostępny:', fixScriptSource);
}

if (!changed) {
  console.log('ℹ️ Plik wyglądał już na częściowo poprawiony, ale zapisano go ponownie.');
}
