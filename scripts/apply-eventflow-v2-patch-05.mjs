#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Nie znaleziono pliku: ${rel}. Uruchom skrypt z katalogu głównego EventFlow_v2.`);
  }
  return { p, text: fs.readFileSync(p, 'utf8') };
}

function write(p, text) {
  fs.writeFileSync(p, text);
}

function backupFile(filePath) {
  const backup = `${filePath}.patch05.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(filePath, backup);
  }
}

function replaceOrThrow(text, search, replacement, label) {
  if (!text.includes(search)) {
    throw new Error(`Nie znalazłem fragmentu do podmiany: ${label}`);
  }
  return text.replace(search, replacement);
}

function replaceRegexOrThrow(text, regex, replacement, label) {
  if (!regex.test(text)) {
    throw new Error(`Nie znalazłem fragmentu do podmiany regex: ${label}`);
  }
  return text.replace(regex, replacement);
}

console.log('\n=== EventFlow patch 05: case scan count deep fix ===\n');

//
// 1) Frontend: wydarzenie -> zakładka Sprzęt
//
{
  const rel = 'apps/web/app/dashboard/events/[id]/page.tsx';
  const { p, text: original } = read(rel);
  backupFile(p);

  let text = original;

  if (!text.includes('EVENTFLOW_PATCH_05_CASE_SCAN_GUARD')) {
    const oldIsCase = `function isCase(row: any) { const modelType = row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu; return row?.isCase || row?.rowType === 'case' || modelType === 'opakowanie' || row?.czy_case === true; }`;
    const newIsCase = `// EVENTFLOW_PATCH_05_CASE_SCAN_GUARD
function isCase(row: any) {
  const modelType = String(row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu || row?.model_typ_sprzetu || '').toLowerCase();
  const typeText = String(row?.rowType || row?.typ || row?.rodzaj || '').toLowerCase();
  const nameText = String(row?.nazwa_modelu || row?.model?.nazwa || row?.egzemplarz?.model?.nazwa || row?.nazwa || '').toLowerCase();
  const rowId = Number(row?.id_egzemplarza || row?.egzemplarz?.id || row?.id || 0);
  const scannedCaseId = Number(row?.id_zeskanowanego_case || row?.system_case_scan?.id || row?.case_scan?.id || 0);

  return Boolean(
    row?.isCase === true ||
    row?.czy_case === true ||
    row?.czy_opakowanie === true ||
    row?.rowType === 'case' ||
    modelType === 'opakowanie' ||
    modelType === 'case' ||
    modelType === 'skrzynia' ||
    modelType.includes('opakow') ||
    typeText.includes('case') ||
    typeText.includes('opakow') ||
    nameText.startsWith('case ') ||
    nameText.includes(' case ') ||
    nameText.includes('skrzyn') ||
    (rowId && scannedCaseId && rowId === scannedCaseId)
  );
}
function isScannedCaseItself(row: any, scannedCase: any = null) {
  const caseId = Number(scannedCase?.id || row?.id_zeskanowanego_case || row?.system_case_scan?.id || row?.case_scan?.id || 0);
  const rowId = Number(row?.id_egzemplarza || row?.egzemplarz?.id || row?.id || 0);
  return Boolean(caseId && rowId && caseId === rowId);
}`;

    if (text.includes(oldIsCase)) {
      text = text.replace(oldIsCase, newIsCase);
    } else {
      // Fallback dla wersji po wcześniejszych patchach: podmień całą funkcję isCase.
      text = replaceRegexOrThrow(
        text,
        /function isCase\(row: any\) \{[\s\S]*?\} function isEquipmentInstance/,
        `${newIsCase} function isEquipmentInstance`,
        'frontend isCase'
      );
    }

    text = text.replace(
      `.filter((row: any) => isEquipmentInstance(row) && !isCase(row))`,
      `.filter((row: any) => isEquipmentInstance(row) && !isCase(row) && !isScannedCaseItself(row, scannedCase))`
    );

    text = text.replace(
      `.filter((child: any) => !isCase(child) && isEquipmentInstance(child));`,
      `.filter((child: any) => !isScannedCaseItself(child, caseScanMeta(row)) && !isCase(child) && isEquipmentInstance(child));`
    );

    text = text.replace(
      `setNotice(sourceLabel ? \`${'${sourceLabel}'}: dodano ${'${toAdd.length}'} egz.`,
      `setNotice(sourceLabel ? \`${'${sourceLabel}'}: dodano ${'${toAdd.filter((item: any) => !isScannedCaseItself(item, scannedCase)).length}'} egz.`
    );

    write(p, text);
    console.log(`✅ Poprawiono front: ${rel}`);
  } else {
    console.log(`ℹ️  Front już zawiera patch 05: ${rel}`);
  }
}

//
// 2) Backend: scan endpoint + tworzenie WZ/PZ nie może rozpakowywać case'a jako pozycji
//
{
  const rel = 'apps/api/src/magazyn/magazyn.service.ts';
  const { p, text: original } = read(rel);
  backupFile(p);

  let text = original;

  if (!text.includes('EVENTFLOW_PATCH_05_BACKEND_CASE_FILTER')) {
    // Filtr w makeCasePayload() — to jest odpowiedź z /api/magazyn/skan?kod=CASE...
    const oldMakeCaseFilter = `(caseRow.zawartosc_case || []) .filter((e: any) => e.aktywny !== false && e.model?.typ_sprzetu !== 'opakowanie') .map((child: any) => ({`;
    const newMakeCaseFilter = `(caseRow.zawartosc_case || []) .filter((e: any) => {
      // EVENTFLOW_PATCH_05_BACKEND_CASE_FILTER
      const childId = Number(e?.id || e?.id_egzemplarza || 0);
      const caseId = Number(caseRow?.id || caseRow?.id_egzemplarza || 0);
      const typ = String(e?.model?.typ_sprzetu || e?.typ_sprzetu || '').toLowerCase();
      return e?.aktywny !== false
        && (!childId || !caseId || childId !== caseId)
        && typ !== 'opakowanie'
        && typ !== 'case'
        && typ !== 'skrzynia'
        && !typ.includes('opakow');
    }) .map((child: any) => ({`;

    text = replaceOrThrow(text, oldMakeCaseFilter, newMakeCaseFilter, 'backend makeCasePayload filter');

    // Filtr w createDokumentMagazynowy(), gdyby jednak frontend wysłał case jako pozycję.
    const oldCreateFilter = `const contents = (egz.zawartosc_case || []).filter((child: any) => child.model?.typ_sprzetu !== 'opakowanie');`;
    const newCreateFilter = `const contents = (egz.zawartosc_case || []).filter((child: any) => {
          // EVENTFLOW_PATCH_05_BACKEND_CASE_FILTER_CREATE_DOC
          const childId = Number(child?.id || child?.id_egzemplarza || 0);
          const caseId = Number(egz?.id || egz?.id_egzemplarza || 0);
          const typ = String(child?.model?.typ_sprzetu || child?.typ_sprzetu || '').toLowerCase();
          return (!childId || !caseId || childId !== caseId)
            && typ !== 'opakowanie'
            && typ !== 'case'
            && typ !== 'skrzynia'
            && !typ.includes('opakow');
        });`;

    text = replaceOrThrow(text, oldCreateFilter, newCreateFilter, 'backend create document case filter');

    write(p, text);
    console.log(`✅ Poprawiono backend: ${rel}`);
  } else {
    console.log(`ℹ️  Backend już zawiera patch 05: ${rel}`);
  }
}

console.log('\n✅ Patch 05 zaaplikowany.');
console.log('👉 Dodatkowo uruchom cleanup self-linków case:');
console.log('   DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" node apps/api/scripts/fix-case-self-links.mjs\n');
