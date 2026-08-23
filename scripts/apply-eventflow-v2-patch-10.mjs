#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const eventsPath = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');
const offerPath = path.join(root, 'apps/web/app/dashboard/offers/[id]/page.tsx');
const magazynServicePath = path.join(root, 'apps/api/src/magazyn/magazyn.service.ts');

function exists(file) { return fs.existsSync(file); }
function rel(file) { return path.relative(root, file); }
function backup(file, suffix) {
  const out = `${file}.bak_${suffix}_${Date.now()}`;
  fs.copyFileSync(file, out);
  return out;
}
function writeIfChanged(file, original, text, label) {
  if (text !== original) {
    const b = backup(file, 'patch10');
    fs.writeFileSync(file, text, 'utf8');
    console.log(`✅ ${label}: ${rel(file)}`);
    console.log(`   backup: ${rel(b)}`);
    return true;
  }
  console.log(`ℹ️ Bez zmian / już było: ${rel(file)}`);
  return false;
}
function replaceAllExact(text, search, replacement, label, stats) {
  if (text.includes(search)) {
    const count = text.split(search).length - 1;
    text = text.split(search).join(replacement);
    stats.push(`✅ ${label}: ${count}`);
  } else {
    stats.push(`ℹ️ pominięto: ${label}`);
  }
  return text;
}
function replaceRegex(text, regex, replacement, label, stats) {
  const next = text.replace(regex, replacement);
  if (next !== text) stats.push(`✅ ${label}`);
  else stats.push(`ℹ️ pominięto: ${label}`);
  return next;
}
function insertAfter(text, anchor, block, marker, label, stats) {
  if (text.includes(marker)) {
    stats.push(`ℹ️ już jest: ${label}`);
    return text;
  }
  const idx = text.indexOf(anchor);
  if (idx < 0) {
    stats.push(`⚠️ nie znaleziono miejsca: ${label}`);
    return text;
  }
  const pos = idx + anchor.length;
  stats.push(`✅ dodano: ${label}`);
  return text.slice(0, pos) + block + text.slice(pos);
}

function patchEvents() {
  if (!exists(eventsPath)) {
    console.log(`⚠️ Nie znaleziono ${rel(eventsPath)}`);
    return false;
  }
  let text = fs.readFileSync(eventsPath, 'utf8');
  const original = text;
  const stats = [];

  const helperBlock = `

  // EVENTFLOW_PATCH_10: wspólne reguły sprzętu do planu i WZ/PZ.
  // Plan/oferta: pokazujemy modele sprzętu i racki. Nie pokazujemy case/opakowań.
  // WZ/PZ: pokazujemy konkretne egzemplarze; sprzęt ilościowy działa po skanie kodu modelu.
  function ef10Text(...values: any[]) {
    return values.filter(Boolean).map((v) => String(v)).join(' ').toLowerCase();
  }
  function ef10CodeValues(row: any): string[] {
    const egz = row?.egzemplarz || row || {};
    const model = row?.model || egz?.model || row || {};
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
      row?.numer,
      row?.nr,
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
  function ef10NormalizeCode(value: any) {
    return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  }
  function ef10HasCasePrefixCode(row: any) {
    return ef10CodeValues(row).some((value) => {
      const code = ef10NormalizeCode(value);
      return code.startsWith('01') && code.length >= 6;
    });
  }
  function ef10RackLike(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row || {};
    const text = ef10Text(
      row?.nazwa,
      row?.nazwa_modelu,
      row?.kategoria,
      row?.kategoria_nazwa,
      row?.typ_sprzetu,
      model?.nazwa,
      model?.kategoria?.nazwa,
      model?.typ_sprzetu,
    );
    return /\\brack\\b|racki|szafa rack|rackowa|case rack|rack 19|19\"|19 cal/.test(text);
  }
  function ef10CaseLike(row: any) {
    if (!row) return false;
    if (ef10RackLike(row)) return false;
    const model = row?.model || row?.egzemplarz?.model || row || {};
    const typeText = ef10Text(row?.rowType, row?.typ, row?.rodzaj, row?.typ_sprzetu, model?.typ, model?.rodzaj, model?.typ_sprzetu);
    const nameText = ef10Text(row?.nazwa, row?.nazwa_modelu, row?.opis, row?.kategoria, row?.kategoria_nazwa, model?.nazwa, model?.kategoria?.nazwa);
    return Boolean(
      row?.isCase === true ||
      row?.czy_case === true ||
      row?.case === true ||
      ef10HasCasePrefixCode(row) ||
      typeText.includes('case') ||
      typeText.includes('opakowanie') ||
      typeText.includes('skrzyn') ||
      nameText.includes('case') ||
      nameText.includes('flightcase') ||
      nameText.includes('flight case') ||
      nameText.includes('opakowanie') ||
      nameText.includes('skrzyn') ||
      nameText.includes('waliz') ||
      nameText.includes('torba')
    );
  }
  function ef10PlanningModelVisible(model: any) {
    return ef10RackLike(model) || !ef10CaseLike(model);
  }
  function ef10InstanceId(row: any) {
    const egz = row?.egzemplarz || row || {};
    const id = Number(row?.id_egzemplarza || row?.egzemplarz_id || egz?.id_egzemplarza || egz?.id || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }
  function ef10IssueInstanceVisible(row: any) {
    return Boolean(ef10InstanceId(row)) && !ef10CaseLike(row) && !isQuantityOnly(row);
  }
  function ef10DocumentPositionAllowed(row: any) {
    if (!row || ef10CaseLike(row)) return false;
    if (isQuantityOnly(row)) return Number(modelIdOf(row) || row?.id_modelu || row?.model?.id || row?.id || 0) > 0;
    return ef10InstanceId(row) > 0;
  }
`;

  const numberOfAnchor = "function numberOf(row: any) { const egz = row?.egzemplarz || row; return egz?.numer_egzemplarza || egz?.numer_urzadzenia || egz?.sn || egz?.kod_kreskowy || ''; }";
  if (text.includes(numberOfAnchor)) {
    text = insertAfter(text, numberOfAnchor, helperBlock, 'EVENTFLOW_PATCH_10', 'helpery sprzętu w wydarzeniu', stats);
  } else if (!text.includes('EVENTFLOW_PATCH_10')) {
    const fallback = 'const modelCountByCategory = useMemo(() => {';
    const idx = text.indexOf(fallback);
    if (idx >= 0) {
      text = text.slice(0, idx) + helperBlock + '\n  ' + text.slice(idx);
      stats.push('✅ dodano helpery przed modelCountByCategory');
    } else {
      stats.push('⚠️ nie znalazłem miejsca na helpery w events/[id]/page.tsx');
    }
  }

  // Rozszerz rozpoznawanie sprzętu ilościowego.
  text = replaceRegex(
    text,
    /function isQuantityOnly\(row: any\) \{[\s\S]*?\n\s*\}/,
    `function isQuantityOnly(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row || {};
    const text = ef10Text(row?.rowType, row?.tryb_ewidencji, row?.typ_sprzetu, row?.typ, model?.tryb_ewidencji, model?.typ_sprzetu, model?.typ);
    return Boolean(
      row?.rowType === 'ilosciowy_model' ||
      row?.quantityOnly === true ||
      row?.sprzet_ilosciowy === true ||
      model?.sprzet_ilosciowy === true ||
      text.includes('ilosciowe') ||
      text.includes('ilościowe') ||
      text.includes('sprzet_ilosciowy') ||
      text.includes('sprzęt_ilościowy')
    );
  }`,
    'rozszerzono isQuantityOnly',
    stats
  );

  // Plan ma widzieć modele sprzętu + racki, bez case/opakowań.
  text = replaceAllExact(text, ".filter((m: any) => m.typ_sprzetu !== 'opakowanie')", ".filter((m: any) => ef10PlanningModelVisible(m))", 'filtry modeli w planie wydarzenia', stats);
  text = replaceAllExact(text, ".filter((m: any) => m.typ_sprzetu !== 'opakowanie' && !hasCasePrefixCode(m))", ".filter((m: any) => ef10PlanningModelVisible(m))", 'filtry modeli po patchu 09', stats);

  // WZ/PZ: ręczna lista tylko konkretne egzemplarze, nie modele/case.
  text = replaceRegex(
    text,
    /return items\s*\n\s*\.filter\(\(x: any\) => x\.model\?\.typ_sprzetu !== 'opakowanie'(?:\s*&&\s*!hasCasePrefixCode\(x\))?\)/,
    "return items\n      .filter((x: any) => ef10IssueInstanceVisible(x))",
    'WZ/PZ ręcznie pokazuje tylko konkretne egzemplarze',
    stats
  );
  text = replaceRegex(
    text,
    /return items\s*\.filter\(\(x: any\) => x\.model\?\.typ_sprzetu !== 'opakowanie'(?:\s*&&\s*!hasCasePrefixCode\(x\))?\)/,
    "return items.filter((x: any) => ef10IssueInstanceVisible(x))",
    'WZ/PZ ręcznie pokazuje tylko konkretne egzemplarze inline',
    stats
  );

  // Payload dokumentu: konkretny egzemplarz albo sprzęt ilościowy, nigdy case / zwykły model.
  text = replaceRegex(
    text,
    /const safeDocItems = docItems\.filter\(\(p: any\) => [^;]+\);/,
    "const safeDocItems = docItems.filter((p: any) => ef10DocumentPositionAllowed(p));",
    'safeDocItems używa reguł patch 10',
    stats
  );
  text = replaceRegex(
    text,
    /const cleanDocItems = docItems\.filter\(\(p: any\) => [^;]+\);/,
    "const cleanDocItems = docItems.filter((p: any) => ef10DocumentPositionAllowed(p));",
    'cleanDocItems używa reguł patch 10',
    stats
  );
  text = replaceAllExact(
    text,
    "if (!docItems.length) return alert('Najpierw zeskanuj albo wybierz egzemplarze sprzętu.');",
    "const validDocItems = docItems.filter((p: any) => ef10DocumentPositionAllowed(p)); if (!validDocItems.length) return alert('WZ/PZ może zawierać konkretne egzemplarze albo sprzęt ilościowy. Dla zwykłego sprzętu zeskanuj egzemplarz albo case.');",
    'walidacja pustego dokumentu',
    stats
  );
  text = replaceAllExact(text, 'pozycje: docItems.map((p) =>', 'pozycje: validDocItems.map((p) =>', 'payload docItems -> validDocItems', stats);
  text = replaceAllExact(text, 'pozycje: safeDocItems.map((p) =>', 'pozycje: safeDocItems.map((p) =>', 'payload safeDocItems bez zmian', stats);
  text = replaceAllExact(text, 'pozycje: cleanDocItems.map((p) =>', 'pozycje: cleanDocItems.map((p) =>', 'payload cleanDocItems bez zmian', stats);

  // Komunikaty, żeby user widział właściwą zasadę.
  text = text.replaceAll(
    'Plan edytujesz po modelach i ilościach. Wydanie oraz przyjęcie działają na konkretnych egzemplarzach po skanie.',
    'Plan edytujesz po modelach i ilościach. Case/opakowania są ukryte. Wydanie/przyjęcie pokazuje konkretne egzemplarze, a sprzęt ilościowy dodajesz skanem kodu modelu.'
  );
  text = text.replaceAll(
    'Zapisano plan sprzętu wydarzenia. Wydanie robisz później przez skanowanie konkretnych egzemplarzy.',
    'Zapisano plan sprzętu wydarzenia. Wydanie robisz później przez skanowanie egzemplarzy/case albo kodu sprzętu ilościowego.'
  );

  if (text !== original) {
    const changed = writeIfChanged(eventsPath, original, text, 'Poprawiono wydarzenia/sprzęt/WZ-PZ');
    stats.forEach((s) => console.log('   ' + s));
    return changed;
  }
  stats.forEach((s) => console.log('   ' + s));
  return writeIfChanged(eventsPath, original, text, 'Poprawiono wydarzenia/sprzęt/WZ-PZ');
}

function patchOffer() {
  if (!exists(offerPath)) {
    console.log(`⚠️ Nie znaleziono ${rel(offerPath)}`);
    return false;
  }
  let text = fs.readFileSync(offerPath, 'utf8');
  const original = text;
  const stats = [];

  const helper = `

  // EVENTFLOW_PATCH_10: w ofercie wybieramy modele sprzętu i racki, ale nie case/opakowania.
  function ef10OfferText(...values: any[]) {
    return values.filter(Boolean).map((v) => String(v)).join(' ').toLowerCase();
  }
  function ef10OfferCodes(row: any): string[] {
    return [row?.kod, row?.kod_kreskowy, row?.barcode, row?.qr_kod, row?.sn, row?.numer, row?.nr]
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      .map((v) => String(v));
  }
  function ef10OfferHasCasePrefix(row: any) {
    return ef10OfferCodes(row).some((v) => String(v).replace(/[^0-9A-Za-z]/g, '').startsWith('01'));
  }
  function ef10OfferRackLike(row: any) {
    const text = ef10OfferText(row?.nazwa, row?.kategoria_nazwa, row?.kategoria?.nazwa, row?.typ_sprzetu);
    return /\\brack\\b|racki|szafa rack|rackowa|case rack|rack 19|19\"|19 cal/.test(text);
  }
  function ef10OfferCaseLike(row: any) {
    if (!row) return false;
    if (ef10OfferRackLike(row)) return false;
    const text = ef10OfferText(row?.nazwa, row?.kategoria_nazwa, row?.kategoria?.nazwa, row?.typ_sprzetu, row?.typ, row?.rodzaj, row?.opis);
    return Boolean(
      ef10OfferHasCasePrefix(row) ||
      text.includes('opakowanie') ||
      text.includes('case') ||
      text.includes('flightcase') ||
      text.includes('flight case') ||
      text.includes('skrzyn') ||
      text.includes('waliz') ||
      text.includes('torba')
    );
  }
  function ef10ShouldShowOfferModel(model: any) {
    return ef10OfferRackLike(model) || !ef10OfferCaseLike(model);
  }
`;

  const anchor = "const activeEquipmentRootObj = equipmentRoot !== 'all' ? equipmentCategoryById.get(equipmentRoot) : null;";
  text = insertAfter(text, anchor, helper, 'EVENTFLOW_PATCH_10', 'helpery oferty dla ukrywania case', stats);

  text = replaceAllExact(text, "if (categoryId === 'all') return models.length;", "if (categoryId === 'all') return models.filter((m: any) => ef10ShouldShowOfferModel(m)).length;", 'licznik wszystkich modeli w ofercie', stats);
  text = replaceAllExact(text, "return models.filter((m: any) => ids.has(modelCategoryId(m))).length;", "return models.filter((m: any) => ef10ShouldShowOfferModel(m) && ids.has(modelCategoryId(m))).length;", 'licznik kategorii w ofercie', stats);
  text = replaceAllExact(text, "Wszystkie <span className=\"opacity-60\">{models.length}</span>", "Wszystkie <span className=\"opacity-60\">{models.filter((m: any) => ef10ShouldShowOfferModel(m)).length}</span>", 'badge wszystkie w ofercie', stats);

  const beforeEquipmentModels = text;
  text = text.replace(
    /return\s+models\s*\.filter\(\(m: any\) => \{/,
    "return models.filter((m: any) => ef10ShouldShowOfferModel(m)).filter((m: any) => {"
  );
  if (text !== beforeEquipmentModels) stats.push('✅ equipmentModels filtruje case');
  else stats.push('ℹ️ pominięto equipmentModels filtruje case');

  text = replaceAllExact(text, "{models.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}", "{models.filter((m: any) => ef10ShouldShowOfferModel(m)).map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}", 'select ręczny modeli w ofercie filtruje case', stats);
  text = replaceAllExact(text, "const m = models.find((x: any) => String(x.id) === e.target.value);", "const m = models.filter((x: any) => ef10ShouldShowOfferModel(x)).find((x: any) => String(x.id) === e.target.value);", 'select ręczny nie wybierze case', stats);

  const changed = writeIfChanged(offerPath, original, text, 'Poprawiono ofertę/listę modeli');
  stats.forEach((s) => console.log('   ' + s));
  return changed;
}

function patchMagazynService() {
  if (!exists(magazynServicePath)) {
    console.log(`⚠️ Nie znaleziono ${rel(magazynServicePath)}`);
    return false;
  }
  let text = fs.readFileSync(magazynServicePath, 'utf8');
  const original = text;
  const stats = [];

  // Upewnij się, że BadRequestException jest zaimportowany.
  if (!text.includes('BadRequestException')) {
    text = text.replace("import { Injectable, NotFoundException } from '@nestjs/common';", "import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';");
    stats.push('✅ dodano BadRequestException do importu');
  }

  const modelHelper = `

  // EVENTFLOW_PATCH_10: sprzęt ilościowy może być oznaczony flagą, trybem, typem albo mieć stan ilościowy i brak egzemplarzy.
  private isModelSprzetIlosciowy(model: any): boolean {
    if (!model) return false;
    const text = [model.tryb_ewidencji, model.typ_sprzetu, model.typ, model.rodzaj].filter(Boolean).join(' ').toLowerCase();
    const hasNoInstances = Array.isArray(model.egzemplarze) && model.egzemplarze.length === 0;
    const hasQuantityStock = Number(model.ilosc_magazynowa || 0) > 0 || Number(model.stan_ilosciowy || 0) > 0;
    return Boolean(
      model.sprzet_ilosciowy === true ||
      model.czy_ilosciowy === true ||
      text.includes('ilosciowe') ||
      text.includes('ilościowe') ||
      text.includes('sprzet_ilosciowy') ||
      text.includes('sprzęt_ilościowy') ||
      (hasNoInstances && hasQuantityStock)
    );
  }
`;
  const helperAnchorRegex = /private isSprzetIlosciowy\(dto: any\): boolean \{[\s\S]*?\n\s*\}/;
  const helperMatch = text.match(helperAnchorRegex);
  if (!text.includes('EVENTFLOW_PATCH_10: sprzęt ilościowy')) {
    if (helperMatch) {
      const pos = helperMatch.index + helperMatch[0].length;
      text = text.slice(0, pos) + modelHelper + text.slice(pos);
      stats.push('✅ dodano isModelSprzetIlosciowy');
    } else {
      stats.push('⚠️ nie znaleziono isSprzetIlosciowy do wstawienia helpera');
    }
  } else {
    stats.push('ℹ️ isModelSprzetIlosciowy już istnieje');
  }

  // Skan modelu i createDokumentMagazynowy: pobierz przykładowy egzemplarz modelu,
  // żeby rozpoznać model ilościowy również po zasadzie: stan ilościowy + brak egzemplarzy.
  stats.push('ℹ️ skan modelu ilościowego zostaje bez zmian');
  text = replaceRegex(
    text,
    /(const modelIlosciowy = id_modelu \? await tx\.modelSprzetu\.findFirst\(\{[\s\S]*?include:\s*)\{\s*kategoria:\s*true\s*\}([\s\S]*?\n\s*\}\) : null;)/,
    "$1{ kategoria: true, egzemplarze: { where: { aktywny: true }, take: 1 } }$2",
    'createDokumentMagazynowy include egzemplarze',
    stats
  );

  // Jeżeli skrypt znajdzie klasyczny warunek ilościowy, podmień na centralny helper.
  text = replaceRegex(
    text,
    /if \(modelIlosciowy && \([^)]*modelIlosciowy\.tryb_ewidencji[^\n]*\)\) \{/,
    "if (modelIlosciowy && this.isModelSprzetIlosciowy(modelIlosciowy)) {",
    'createDokumentMagazynowy akceptuje sprzęt ilościowy po helperze',
    stats
  );
  text = replaceRegex(
    text,
    /if \(modelIlosciowy && \(modelIlosciowy\.tryb_ewidencji === 'ilosciowe' \|\| modelIlosciowy\.typ_sprzetu === 'ilosciowe'\)\) \{/,
    "if (modelIlosciowy && this.isModelSprzetIlosciowy(modelIlosciowy)) {",
    'createDokumentMagazynowy akceptuje stary warunek ilościowy',
    stats
  );

  // Dodatkowy fallback, jeśli powyższy regex nie złapał przez inny format.
  text = text.replaceAll(
    "modelIlosciowy.tryb_ewidencji === 'ilosciowe' || modelIlosciowy.typ_sprzetu === 'ilosciowe'",
    "this.isModelSprzetIlosciowy(modelIlosciowy)"
  );

  // Popraw komunikat, aby był zgodny z UX.
  text = text.replaceAll(
    'WZ/PZ może zawierać konkretne egzemplarze albo sprzęt ilościowy. Dla zwykłego sprzętu zeskanuj egzemplarz albo case.',
    'WZ/PZ może zawierać konkretne egzemplarze albo sprzęt ilościowy. Dla zwykłego sprzętu zeskanuj egzemplarz albo case. Dla sprzętu ilościowego zeskanuj kod modelu i podaj liczbę sztuk.'
  );

  const changed = writeIfChanged(magazynServicePath, original, text, 'Poprawiono backend WZ/PZ dla sprzętu ilościowego');
  stats.forEach((s) => console.log('   ' + s));
  return changed;
}

console.log('\n=== EventFlow v2 patch 10: sprzęt ilościowy + ukrywanie case ===\n');
let changed = false;
changed = patchEvents() || changed;
changed = patchOffer() || changed;
changed = patchMagazynService() || changed;

console.log('\nGotowe.');
if (!changed) {
  console.log('Nie wykryto zmian albo patch był już nałożony.');
}
console.log('\nPo patchu zrestartuj API i frontend.');
