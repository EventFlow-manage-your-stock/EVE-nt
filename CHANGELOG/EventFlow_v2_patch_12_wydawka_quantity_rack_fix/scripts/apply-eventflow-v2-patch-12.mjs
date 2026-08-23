#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');
const apiPath = path.join(root, 'apps/api/src/magazyn/magazyn.service.ts');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Nie znaleziono pliku: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, text) {
  fs.writeFileSync(file, text);
  console.log('✅ zapisano:', path.relative(root, file));
}
function backup(file) {
  const bak = `${file}.patch12.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

function patchEventPage() {
  let text = read(pagePath);
  backup(pagePath);
  const original = text;

  const helpers = `
function normalizeScanCodeValue(value: any) {
  return String(value || '').trim().replace(/\s+/g, '');
}
function scanCodeCandidates(row: any) {
  const egz = row?.egzemplarz || row;
  const model = row?.model || row?.egzemplarz?.model || {};
  return [
    row?.kod,
    row?.kod_kreskowy,
    row?.zewnetrzny_kod_kreskowy,
    row?.zewnetrzny_qr_kod,
    row?.qr_kod,
    row?.sn,
    egz?.kod,
    egz?.kod_kreskowy,
    egz?.zewnetrzny_kod_kreskowy,
    egz?.zewnetrzny_qr_kod,
    egz?.qr_kod,
    egz?.sn,
    model?.kod,
    model?.kod_kreskowy,
  ].filter(Boolean).map(normalizeScanCodeValue).filter(Boolean);
}
function hasCaseBarcodePrefix(row: any) {
  return scanCodeCandidates(row).some((code: string) => /^01\d+/.test(code));
}
function isRackLike(row: any) {
  const model = row?.model || row?.egzemplarz?.model || row || {};
  const text = [
    row?.rowType,
    row?.typ_sprzetu,
    row?.typ,
    row?.rodzaj,
    row?.nazwa,
    row?.nazwa_modelu,
    row?.kategoria,
    row?.kategoria_nazwa,
    model?.typ_sprzetu,
    model?.typ,
    model?.rodzaj,
    model?.nazwa,
    model?.kategoria?.nazwa,
  ].filter(Boolean).join(' ').toLowerCase();
  return /(^|[^a-ząćęłńóśźż])rack([^a-ząćęłńóśźż]|$)/i.test(text) || text.includes('racki') || text.includes('szafa rack');
}
function isCase(row: any) {
  const modelType = row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu;
  if (isRackLike(row)) return false;
  return row?.isCase === true || row?.rowType === 'case' || modelType === 'opakowanie' || row?.czy_case === true || hasCaseBarcodePrefix(row);
}
function isQuantityOnly(row: any) {
  const value = row?.tryb_ewidencji || row?.typ_ewidencji || row?.rodzaj_ewidencji || row?.model?.tryb_ewidencji || row?.model?.typ_ewidencji || row?.model?.rodzaj_ewidencji;
  return Boolean(
    row?.rowType === 'ilosciowy_model' ||
    row?.rowType === 'ilościowy_model' ||
    row?.rowType === 'ilosciowy' ||
    row?.quantityOnly === true ||
    row?.sprzet_ilosciowy === true ||
    row?.czy_ilosciowy === true ||
    row?.model?.sprzet_ilosciowy === true ||
    row?.model?.czy_ilosciowy === true ||
    value === 'ilosciowe' ||
    value === 'ilościowe' ||
    value === 'quantity'
  );
}
function isEquipmentInstance(row: any) {
  const modelType = row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu;
  const hasInstance = Boolean(row?.id_egzemplarza || row?.egzemplarz || (row?.id && !isQuantityOnly(row)));
  return hasInstance && modelType !== 'opakowanie' && !isCase(row) && !isQuantityOnly(row);
}`;

  // Replace the old helper cluster. This intentionally stops before modelIdOf, preserving the rest of the component.
  const helperPattern = /function isCase\(row: any\) \{[\s\S]*?function modelIdOf\(row: any\) \{/;
  if (helperPattern.test(text)) {
    text = text.replace(helperPattern, `${helpers} function modelIdOf(row: any) {`);
  } else {
    const marker = 'const { roots: equipmentCategoryRoots, byId: equipmentCategoryById } = useMemo(() => buildCategoryTree(equipmentCategories), [equipmentCategories]);';
    if (!text.includes('function normalizeScanCodeValue')) {
      text = text.replace(marker, marker + helpers);
    }
  }

  // Replace addDocumentItem so rack is handled as one physical item, quantity goes through model+amount, and only case expands contents.
  const addDocumentItem = `function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {
  setError('');
  setNotice('');

  if (isQuantityOnly(row)) {
    addQuantityDocumentItem(row, source);
    return;
  }

  if (isRackLike(row) && isEquipmentInstance(row)) {
    addDocumentItemsBulk([{ ...row, rowType: 'egzemplarz' }], source, source === 'scan' ? 'Zeskanowano rack' : 'Dodano rack');
    return;
  }

  if (isCase(row)) {
    const scannedCodes = new Set(scanCodeCandidates(row));
    const contents = (row.contents || row.zawartosc_case || [])
      .filter((child: any) => {
        if (!child) return false;
        if (isQuantityOnly(child)) return false;
        if (isCase(child)) return false;
        const childCodes = scanCodeCandidates(child);
        if (childCodes.some((code: string) => scannedCodes.has(code))) return false;
        return isEquipmentInstance(child);
      });
    if (!contents.length) {
      setError('Ten case jest pusty albo nie ma aktywnych egzemplarzy sprzętu w środku. Case nie trafia na dokument.');
      return;
    }
    const label = row.nazwa || row.nazwa_modelu || row.kod || row.kod_kreskowy || \`case #\${row.id || row.id_egzemplarza || ''}\`;
    addDocumentItemsBulk(contents, 'scan', \`Zeskanowano case \${label}\`, caseScanMeta(row));
    return;
  }

  if (!isEquipmentInstance(row)) {
    setError('WZ/PZ może zawierać konkretny egzemplarz, rack jako jedną pozycję albo sprzęt ilościowy jako model + ilość. Case rozwija się na zawartość i sam nie trafia na dokument.');
    return;
  }

  addDocumentItemsBulk([row], source);
}`;

  const addPattern = /function addDocumentItem\(row: any, source: 'scan' \| 'manual' = 'manual'\) \{[\s\S]*?\} function focusScanInput\(\) \{/;
  if (addPattern.test(text)) {
    text = text.replace(addPattern, `${addDocumentItem} function focusScanInput() {`);
  } else if (!text.includes('WZ/PZ może zawierać konkretny egzemplarz, rack jako jedną pozycję')) {
    console.warn('⚠️ Nie znalazłem funkcji addDocumentItem do pełnej podmiany. Plik może być mocno zmieniony.');
  }

  // Make the scanned list label clearer for quantity and rack.
  text = text.replace(
    "{p.kategoria} · {isQuantityOnly(p) ? `${p.ilosc || 1} ${p.jednostka || 'szt.'}${p.kod ? ` · kod ${p.kod}` : ''}` : (p.kod || '-')}",
    "{p.kategoria} · {isQuantityOnly(p) ? `${p.ilosc || 1} ${p.jednostka || 'szt.'}${p.kod ? ` · kod ${p.kod}` : ''}` : `${isRackLike(p) ? 'rack · ' : ''}${p.kod || '-'}` }"
  );

  if (text !== original) write(pagePath, text);
  else console.log('ℹ️ Brak zmian w page.tsx — wygląda na już poprawiony albo inny układ pliku.');
}

function patchMagazynService() {
  if (!fs.existsSync(apiPath)) return;
  let text = read(apiPath);
  backup(apiPath);
  const original = text;

  // Make case contents on API side ignore children whose barcode starts with 01, unless they are rack-like.
  if (!text.includes('PATCH12_isRackLikeForScan')) {
    const method = `

  private PATCH12_text(value: any): string {
    return String(value || '').trim();
  }

  private PATCH12_code(value: any): string {
    return String(value || '').trim().replace(/\\s+/g, '');
  }

  private PATCH12_codes(row: any): string[] {
    const model = row?.model || {};
    return [row?.kod, row?.kod_kreskowy, row?.zewnetrzny_kod_kreskowy, row?.zewnetrzny_qr_kod, row?.qr_kod, row?.sn, model?.kod, model?.kod_kreskowy]
      .filter(Boolean)
      .map((v: any) => this.PATCH12_code(v))
      .filter(Boolean);
  }

  private PATCH12_isRackLikeForScan(row: any): boolean {
    const model = row?.model || {};
    const text = [row?.typ_sprzetu, row?.typ, row?.rodzaj, row?.nazwa, model?.typ_sprzetu, model?.typ, model?.rodzaj, model?.nazwa, model?.kategoria?.nazwa]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /(^|[^a-ząćęłńóśźż])rack([^a-ząćęłńóśźż]|$)/i.test(text) || text.includes('racki') || text.includes('szafa rack');
  }

  private PATCH12_isCaseCode(row: any): boolean {
    if (this.PATCH12_isRackLikeForScan(row)) return false;
    return this.PATCH12_codes(row).some((code) => /^01\\d+/.test(code));
  }
`;
    const idx = text.lastIndexOf('\n}');
    if (idx > -1) text = text.slice(0, idx) + method + text.slice(idx);
  }

  // Harden existing makeCasePayload content filter: remove opakowanie/case prefix 01, but keep rack as a real item.
  text = text.replace(
    ".filter((e: any) => e.aktywny !== false && e.model?.typ_sprzetu !== 'opakowanie')",
    ".filter((e: any) => e.aktywny !== false && (this.PATCH12_isRackLikeForScan(e) || (e.model?.typ_sprzetu !== 'opakowanie' && !this.PATCH12_isCaseCode(e))))"
  );

  // Ensure model quantity scan payload has all fields frontend expects. Works if current code already has the 'Podaj ilość sztuk' branch.
  text = text.replace(
    "message: `Zeskanowano sprzęt ilościowy.",
    "quantityOnly: true, sprzet_ilosciowy: true, czy_ilosciowy: true, message: `Zeskanowano sprzęt ilościowy."
  );

  if (text !== original) write(apiPath, text);
  else console.log('ℹ️ Brak zmian w magazyn.service.ts — wygląda na już poprawiony albo inny układ pliku.');
}

try {
  patchEventPage();
  patchMagazynService();
  console.log('\n✅ Patch 12 zakończony.');
  console.log('Teraz uruchom prisma generate, API i frontend od nowa.');
} catch (err) {
  console.error('\n❌ Patch 12 nie został zastosowany:');
  console.error(err);
  process.exit(1);
}
