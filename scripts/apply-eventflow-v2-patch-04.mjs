#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PATCH = 'EVENTFLOW_CASE_SCAN_FIX_V4';

function mustRead(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Nie znaleziono pliku: ${rel}. Uruchom skrypt z katalogu głównego EventFlow_v2.`);
  }
  return { p, text: fs.readFileSync(p, 'utf8') };
}

function backup(p) {
  const b = `${p}.bak_patch04_${Date.now()}`;
  fs.copyFileSync(p, b);
  console.log(`Backup: ${path.relative(root, b)}`);
}

function writeIfChanged(p, before, after) {
  if (before === after) {
    console.log(`Bez zmian: ${path.relative(root, p)}`);
    return;
  }
  backup(p);
  fs.writeFileSync(p, after);
  console.log(`Zmieniono: ${path.relative(root, p)}`);
}

function patchWebReceiving() {
  const rel = 'apps/web/app/dashboard/warehouse/receiving/page.tsx';
  const { p, text: before } = mustRead(rel);
  let text = before;

  const helper = `\n// ${PATCH}: case/opakowanie po skanie nie jest pozycją dokumentu; dodajemy tylko zawartość case.\nfunction eventflowCaseText(...values: any[]) { return values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean).join(' ').toLowerCase(); }\nfunction eventflowIsCaseOrPackagingItem(item: any) {\n  const typ = eventflowCaseText(item?.model?.typ_sprzetu, item?.typ_sprzetu, item?.typ, item?.rodzaj);\n  const nazwa = eventflowCaseText(item?.model?.nazwa, item?.nazwa_modelu, item?.nazwa);\n  const kod = eventflowCaseText(item?.kod, item?.kod_kreskowy, item?.qr_kod, item?.zewnetrzny_kod_kreskowy, item?.zewnetrzny_qr_kod, item?.sn);\n  return typ.includes('opakowanie') || typ === 'case' || typ.includes('skrzyn') || kod.startsWith('case-') || /^case(\\s|[-_#]|$)/.test(nazwa) || nazwa.includes('flight case') || nazwa.includes('transport case');\n}\nfunction eventflowCaseIds(item: any) { return new Set([item?.id, item?.id_egzemplarza].filter((v) => v !== null && v !== undefined).map((v) => String(v))); }\nfunction eventflowCaseCodes(item: any) { return new Set([item?.kod, item?.kod_kreskowy, item?.qr_kod, item?.zewnetrzny_kod_kreskowy, item?.zewnetrzny_qr_kod, item?.sn].filter(Boolean).map((v) => String(v).trim().toLowerCase())); }\nfunction eventflowUniqueCaseContents(contents: any[], caseRow: any) {\n  const caseIds = eventflowCaseIds(caseRow);\n  const caseCodes = eventflowCaseCodes(caseRow);\n  const seen = new Set();\n  return (Array.isArray(contents) ? contents : []).filter((child: any) => {\n    const childId = String(child?.id_egzemplarza || child?.id || '');\n    const childCode = String(child?.kod || child?.kod_kreskowy || child?.qr_kod || child?.zewnetrzny_kod_kreskowy || child?.zewnetrzny_qr_kod || child?.sn || '').trim().toLowerCase();\n    if (childId && caseIds.has(childId)) return false;\n    if (childCode && caseCodes.has(childCode)) return false;\n    if (eventflowIsCaseOrPackagingItem(child)) return false;\n    const key = childId || childCode || eventflowCaseText(child?.nazwa, child?.nazwa_modelu);\n    if (key && seen.has(key)) return false;\n    if (key) seen.add(key);\n    return true;\n  });\n}\n`;

  if (!text.includes(PATCH)) {
    const marker = 'function docTypeLabel';
    if (text.includes(marker)) {
      text = text.replace(marker, helper + marker);
    } else {
      const clientMarker = "'use client';";
      text = text.replace(clientMarker, clientMarker + helper);
    }
  }

  text = text.replace(
    /if\s*\(\s*item\?\.model\?\.typ_sprzetu\s*===\s*['"]opakowanie['"]\s*&&\s*item\?\.rowType\s*!==\s*['"]case['"]\s*\)\s*\{/g,
    "if (eventflowIsCaseOrPackagingItem(item) && item?.rowType !== 'case' && !item?.isCase) {"
  );

  text = text.replace(
    /const\s+contents\s*=\s*item\.contents\s*\|\|\s*item\.zawartosc_case\s*\|\|\s*\[\];/g,
    "const contents = eventflowUniqueCaseContents(item.contents || item.zawartosc_case || [], item);"
  );

  text = text.replace(
    /setNotice\(item\.message\s*\|\|\s*`Dodano \$\{contents\.length\} egzemplarzy z wnętrza case\.`\);/g,
    "setNotice(`Zeskanowano case. Do dokumentu dodano ${contents.length} egzemplarzy z wnętrza.`);"
  );

  writeIfChanged(p, before, text);
}

function patchApiMagazyn() {
  const rel = 'apps/api/src/magazyn/magazyn.service.ts';
  const { p, text: before } = mustRead(rel);
  let text = before;

  const helper = `\n  // ${PATCH}: case/opakowanie nie jest pozycją WZ/PZ; rozpakowujemy tylko sprzęt ze środka.\n  private isCaseOrPackagingRow(row: any): boolean {\n    const typ = [row?.model?.typ_sprzetu, row?.typ_sprzetu, row?.typ, row?.rodzaj, row?.rowType].filter(Boolean).join(' ').toLowerCase();\n    const nazwa = [row?.model?.nazwa, row?.nazwa_modelu, row?.nazwa].filter(Boolean).join(' ').toLowerCase();\n    const kod = [row?.kod, row?.kod_kreskowy, row?.qr_kod, row?.zewnetrzny_kod_kreskowy, row?.zewnetrzny_qr_kod, row?.sn].filter(Boolean).join(' ').trim().toLowerCase();\n    return row?.isCase === true || row?.rowType === 'case' || typ.includes('opakowanie') || typ === 'case' || typ.includes('skrzyn') || kod.startsWith('case-') || /^case(\\s|[-_#]|$)/.test(nazwa) || nazwa.includes('flight case') || nazwa.includes('transport case');\n  }\n`;

  if (!text.includes(PATCH)) {
    const marker = 'private nextDocumentNumber';
    if (!text.includes(marker)) {
      throw new Error('Nie znalazłem miejsca na helper w magazyn.service.ts');
    }
    text = text.replace(marker, helper + '  ' + marker);
  }

  text = text.replace(
    /\.filter\(\(e:\s*any\)\s*=>\s*e\.aktywny\s*!==\s*false\s*&&\s*e\.model\?\.typ_sprzetu\s*!==\s*['"]opakowanie['"]\)/g,
    ".filter((e: any) => e.aktywny !== false && e.id !== caseRow.id && !this.isCaseOrPackagingRow(e))"
  );

  text = text.replace(
    /const\s+isDirectCase\s*=\s*egzemplarz\.model\?\.typ_sprzetu\s*===\s*['"]opakowanie['"];?/g,
    'const isDirectCase = this.isCaseOrPackagingRow(egzemplarz);'
  );

  text = text.replace(
    /parentCase\.model\?\.typ_sprzetu\s*===\s*['"]opakowanie['"]/g,
    'this.isCaseOrPackagingRow(parentCase)'
  );

  text = text.replace(
    /const\s+isCase\s*=\s*egz\.model\?\.typ_sprzetu\s*===\s*['"]opakowanie['"];?/g,
    'const isCase = this.isCaseOrPackagingRow(egz);'
  );

  text = text.replace(
    /const\s+contents\s*=\s*\(egz\.zawartosc_case\s*\|\|\s*\[\]\)\.filter\(\(child:\s*any\)\s*=>\s*child\.model\?\.typ_sprzetu\s*!==\s*['"]opakowanie['"]\);/g,
    'const contents = (egz.zawartosc_case || []).filter((child: any) => child.id !== egz.id && !this.isCaseOrPackagingRow(child));'
  );

  text = text.replace(
    /if\s*\(egz\.model\?\.typ_sprzetu\s*===\s*['"]opakowanie['"]\)\s*\{/g,
    'if (this.isCaseOrPackagingRow(egz)) {'
  );

  writeIfChanged(p, before, text);
}

try {
  patchWebReceiving();
  patchApiMagazyn();
  console.log('\n✅ Patch 04 gotowy. Case nie będzie liczony jako pozycja dokumentu, tylko jego zawartość.');
} catch (err) {
  console.error('\n❌ Patch 04 nie został zastosowany:');
  console.error(err?.message || err);
  process.exit(1);
}
