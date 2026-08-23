#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const eventPagePath = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');
const magazynServicePath = path.join(root, 'apps/api/src/magazyn/magazyn.service.ts');

function mustRead(file) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Nie znaleziono pliku: ${path.relative(root, file)}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log(`✅ Zapisano: ${path.relative(root, file)}`);
}

function replaceRequired(text, from, to, label) {
  if (!text.includes(from)) {
    console.warn(`⚠️ Nie znaleziono fragmentu: ${label}`);
    return text;
  }
  return text.replace(from, to);
}

function replaceRegex(text, regex, to, label) {
  if (!regex.test(text)) {
    console.warn(`⚠️ Nie znaleziono regex: ${label}`);
    return text;
  }
  return text.replace(regex, to);
}

// -----------------------------------------------------------------------------
// FRONTEND: apps/web/app/dashboard/events/[id]/page.tsx
// -----------------------------------------------------------------------------
let page = mustRead(eventPagePath);

const helperMarker = 'EVENTFLOW_PATCH_11_RACK_QTY_FIX';
const helperBlock = `
  // ${helperMarker}
  function efPatch11NormalizeCode(value: any) {
    return value === null || value === undefined ? '' : String(value).trim();
  }
  function efPatch11RowCodes(row: any) {
    const egz = row?.egzemplarz || row;
    return [
      row?.kod,
      row?.kod_kreskowy,
      row?.zewnetrzny_kod_kreskowy,
      row?.zewnetrzny_qr_kod,
      row?.qr_kod,
      row?.sn,
      row?.numer_egzemplarza,
      row?.numer_urzadzenia,
      egz?.kod,
      egz?.kod_kreskowy,
      egz?.zewnetrzny_kod_kreskowy,
      egz?.zewnetrzny_qr_kod,
      egz?.qr_kod,
      egz?.sn,
      egz?.numer_egzemplarza,
      egz?.numer_urzadzenia,
    ].map(efPatch11NormalizeCode).filter(Boolean);
  }
  function efPatch11IsCaseCode(value: any) {
    const code = efPatch11NormalizeCode(value);
    return /^01\\d+/.test(code) || /^CASE[-_]/i.test(code);
  }
  function efPatch11ModelText(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row;
    return [
      model?.typ_sprzetu,
      model?.tryb_ewidencji,
      model?.nazwa,
      model?.kategoria?.nazwa,
      row?.typ_sprzetu,
      row?.nazwa,
      row?.nazwa_modelu,
      row?.kategoria,
      row?.kategoria_nazwa,
      row?.egzemplarz?.nazwa,
    ].filter(Boolean).join(' ').toLowerCase();
  }
  function efPatch11IsRack(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row;
    const text = efPatch11ModelText(row);
    return model?.typ_sprzetu === 'rack' || /(^|\\s)rack(i|u|iem|ów)?($|\\s)/i.test(text) || text.includes('szafa rack');
  }
  function efPatch11HasCaseCode(row: any) {
    return !efPatch11IsRack(row) && efPatch11RowCodes(row).some(efPatch11IsCaseCode);
  }
`;

if (!page.includes(helperMarker)) {
  page = page.replace(
    /const \{ roots: equipmentCategoryRoots, byId: equipmentCategoryById \} = useMemo\(\(\) => buildCategoryTree\(equipmentCategories\), \[equipmentCategories\]\);/,
    (m) => `${m}${helperBlock}`,
  );
}

page = replaceRegex(
  page,
  /function isCase\(row: any\) \{[\s\S]*?\} function isEquipmentInstance\(row: any\) \{[\s\S]*?\} function isQuantityOnly\(row: any\) \{[\s\S]*?\}/,
  `function isCase(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row;
    const modelType = model?.typ_sprzetu || row?.typ_sprzetu;
    return !efPatch11IsRack(row) && (
      row?.isCase === true ||
      row?.rowType === 'case' ||
      row?.czy_case === true ||
      modelType === 'opakowanie' ||
      efPatch11HasCaseCode(row)
    );
  }
  function isEquipmentInstance(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row;
    const modelType = model?.typ_sprzetu;
    const hasInstance = Boolean(row?.id_egzemplarza || row?.egzemplarz || (row?.id && row?.rowType !== 'ilosciowy_model'));
    return hasInstance && !isQuantityOnly(row) && (efPatch11IsRack(row) || (!isCase(row) && modelType !== 'opakowanie'));
  }
  function isQuantityOnly(row: any) {
    const model = row?.model || row;
    return row?.rowType === 'ilosciowy_model' ||
      row?.quantityOnly === true ||
      row?.sprzet_ilosciowy === true ||
      row?.czy_ilosciowy === true ||
      row?.tryb_ewidencji === 'ilosciowe' ||
      row?.tryb_ewidencji === 'ilościowe' ||
      row?.typ_ewidencji === 'ilosciowe' ||
      row?.rodzaj_ewidencji === 'ilosciowe' ||
      row?.typ_sprzetu === 'ilosciowe' ||
      model?.sprzet_ilosciowy === true ||
      model?.czy_ilosciowy === true ||
      model?.quantityOnly === true ||
      model?.tryb_ewidencji === 'ilosciowe' ||
      model?.tryb_ewidencji === 'ilościowe' ||
      model?.typ_ewidencji === 'ilosciowe' ||
      model?.rodzaj_ewidencji === 'ilosciowe' ||
      model?.typ_sprzetu === 'ilosciowe';
  }`,
  'funkcje isCase/isEquipmentInstance/isQuantityOnly',
);

// Ukryj case/opakowania na liście modeli planu, ale zostaw racki.
page = page.replaceAll(
  `.filter((m: any) => m.typ_sprzetu !== 'opakowanie')`,
  `.filter((m: any) => !isCase(m) || efPatch11IsRack(m))`,
);

// Na WZ/PZ w ręcznej liście pokaż konkretne egzemplarze; ukryj case, ale zostaw racki jako pojedynczą pozycję.
page = page.replaceAll(
  `.filter((x: any) => x.model?.typ_sprzetu !== 'opakowanie')`,
  `.filter((x: any) => efPatch11IsRack(x) || (!isCase(x) && x.model?.typ_sprzetu !== 'opakowanie'))`,
);

// Rack nie może rozpakować się jak case. Ma wejść jako jedna pozycja dokumentu.
if (!page.includes('EVENTFLOW_PATCH_11_RACK_SINGLE_SCAN')) {
  page = page.replace(
    `function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') { setError(''); setNotice(''); if (isCase(row)) {`,
    `function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') { setError(''); setNotice('');
    // EVENTFLOW_PATCH_11_RACK_SINGLE_SCAN
    if (efPatch11IsRack(row)) {
      if (!isEquipmentInstance(row)) {
        setError('Rack musi być konkretnym egzemplarzem do wydania/przyjęcia.');
        return;
      }
      addDocumentItemsBulk([row], source);
      return;
    }
    if (isCase(row)) {`,
  );
}

// Czytelniejszy komunikat po patchu.
page = page.replace(
  `Wydanie/przyjęcie działa na egzemplarzach, case rozwija się na zawartość, a sprzęt ilościowy zapisujemy jako model + ilość.`,
  `WZ/PZ może zawierać konkretne egzemplarze, rack jako jedną pozycję albo sprzęt ilościowy jako model + ilość. Dla zwykłego sprzętu zeskanuj egzemplarz albo case.`,
);

write(eventPagePath, page);

// -----------------------------------------------------------------------------
// BACKEND: apps/api/src/magazyn/magazyn.service.ts
// -----------------------------------------------------------------------------
let service = mustRead(magazynServicePath);

const backendMarker = 'EVENTFLOW_PATCH_11_RACK_CASE_HELPERS';
if (!service.includes(backendMarker)) {
  service = service.replace(
    `private cleanBoolean(val: any): boolean { return val === true || val === 'true' || val === 1 || val === '1'; }`,
    `private cleanBoolean(val: any): boolean { return val === true || val === 'true' || val === 1 || val === '1'; }
  // ${backendMarker}
  private isRackLikeModel(model: any): boolean {
    const text = [model?.typ_sprzetu, model?.nazwa, model?.kategoria?.nazwa].filter(Boolean).join(' ').toLowerCase();
    return model?.typ_sprzetu === 'rack' || /(^|\\s)rack(i|u|iem|ów)?($|\\s)/i.test(text) || text.includes('szafa rack');
  }
  private isCaseLikeModel(model: any): boolean {
    return !this.isRackLikeModel(model) && (model?.typ_sprzetu === 'opakowanie' || model?.czy_case === true);
  }`,
  );
}

service = service.replaceAll(
  `.filter((e: any) => e.aktywny !== false && e.model?.typ_sprzetu !== 'opakowanie')`,
  `.filter((e: any) => e.aktywny !== false && !this.isCaseLikeModel(e.model))`,
);

service = service.replaceAll(
  `const isDirectCase = egzemplarz.model?.typ_sprzetu === 'opakowanie';`,
  `const isDirectCase = this.isCaseLikeModel(egzemplarz.model);`,
);

service = service.replaceAll(
  `if (parentCase.model?.typ_sprzetu === 'opakowanie') { return makeCasePayload(parentCase, 'parent_case_code_matched'); }`,
  `if (this.isCaseLikeModel(parentCase.model)) { return makeCasePayload(parentCase, 'parent_case_code_matched'); }`,
);

service = service.replaceAll(
  `if (egzemplarz.model?.typ_sprzetu === 'rack') {`,
  `if (this.isRackLikeModel(egzemplarz.model)) {`,
);

service = service.replaceAll(
  `} else if (parentCase && parentCase.model?.typ_sprzetu === 'rack') {`,
  `} else if (parentCase && this.isRackLikeModel(parentCase.model)) {`,
);

service = service.replaceAll(
  `const isCase = egz.model?.typ_sprzetu === 'opakowanie';`,
  `const isCase = this.isCaseLikeModel(egz.model);`,
);

service = service.replaceAll(
  `.filter((child: any) => child.model?.typ_sprzetu !== 'opakowanie');`,
  `.filter((child: any) => !this.isCaseLikeModel(child.model));`,
);

service = service.replaceAll(
  `if (egz.model?.typ_sprzetu === 'opakowanie') { throw new BadRequestException('Opakowanie/case nie może być pozycją dokumentu WZ/PZ.'); }`,
  `if (this.isCaseLikeModel(egz.model)) { throw new BadRequestException('Opakowanie/case nie może być pozycją dokumentu WZ/PZ.'); }`,
);

// Sprzęt ilościowy może być rozpoznany po różnych polach, nie tylko tryb_ewidencji.
service = service.replaceAll(
  `if (modelIlosciowy && (modelIlosciowy.tryb_ewidencji === 'ilosciowe' || modelIlosciowy.typ_sprzetu === 'ilosciowe')) {`,
  `if (modelIlosciowy && (modelIlosciowy.tryb_ewidencji === 'ilosciowe' || modelIlosciowy.tryb_ewidencji === 'ilościowe' || modelIlosciowy.typ_sprzetu === 'ilosciowe' || (modelIlosciowy as any).sprzet_ilosciowy === true || (modelIlosciowy as any).czy_ilosciowy === true)) {`,
);

write(magazynServicePath, service);

console.log('\n✅ Patch 11 gotowy.');
console.log('Zrestartuj API i frontend. Potem sprawdź:');
console.log('- Nogi Alustage / sprzęt ilościowy: skan kodu modelu lub checkbox przy pozycji planu.');
console.log('- Rack: pokazuje się na WZ/PZ jako jedna konkretna pozycja i nie rozpakowuje zawartości.');
console.log('- Case: dalej rozpakowuje zawartość, ale sam case nie trafia na dokument.');
