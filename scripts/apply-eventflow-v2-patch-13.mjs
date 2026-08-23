#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const webFile = path.join(root, 'apps/web/app/dashboard/events/[id]/page.tsx');
const apiFile = path.join(root, 'apps/api/src/magazyn/magazyn.service.ts');
const controllerFile = path.join(root, 'apps/api/src/magazyn/magazyn.controller.ts');

function backup(file) {
  if (!fs.existsSync(file)) throw new Error(`Nie znaleziono pliku: ${file}`);
  const backupPath = `${file}.bak_patch13_${Date.now()}`;
  fs.copyFileSync(file, backupPath);
  console.log(`backup: ${path.relative(root, backupPath)}`);
}

function replaceBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`Nie znaleziono startMarker: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Nie znaleziono endMarker po ${startMarker}: ${endMarker}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function patchWeb() {
  backup(webFile);
  let text = fs.readFileSync(webFile, 'utf8');

  const helperBlock = `function normScanCode(value: any) { return String(value ?? '').trim(); }
  function allCodesOf(row: any): string[] {
    const egz = row?.egzemplarz || row;
    const model = row?.model || row?.egzemplarz?.model || row;
    return [
      row?.kod,
      row?.kod_kreskowy,
      row?.barcode,
      row?.qr_kod,
      row?.sn,
      row?.numer_egzemplarza,
      row?.numer_urzadzenia,
      egz?.kod_kreskowy,
      egz?.zewnetrzny_kod_kreskowy,
      egz?.zewnetrzny_qr_kod,
      egz?.qr_kod,
      egz?.sn,
      egz?.numer_egzemplarza,
      egz?.numer_urzadzenia,
      model?.kod_kreskowy,
      model?.kod,
    ].filter(Boolean).map(normScanCode);
  }
  function hasCodeStartingWith01(row: any) {
    return allCodesOf(row).some((code) => /^01\d+/.test(code));
  }
  function isRackLike(row: any) {
    const model = row?.model || row?.egzemplarz?.model || row;
    const values = [
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
      model?.kategoria?.sciezka,
      model?.kategoria?.ścieżka,
    ].filter(Boolean).map((v) => String(v).toLowerCase());
    return values.some((v) => v === 'rack' || v.includes('rack') || v.includes('raki') || v.includes('szafa rack'));
  }
  function isCase(row: any) {
    if (!row) return false;
    if (isRackLike(row)) return false;
    const modelType = row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu;
    return row?.isCase || row?.rowType === 'case' || modelType === 'opakowanie' || row?.czy_case === true || hasCodeStartingWith01(row);
  }
  function isQuantityOnly(row: any) {
    const model = row?.model || row;
    return Boolean(
      row?.rowType === 'ilosciowy_model' ||
      row?.quantityOnly === true ||
      row?.sprzet_ilosciowy === true ||
      row?.czy_ilosciowy === true ||
      row?.tryb_ewidencji === 'ilosciowe' ||
      row?.typ_ewidencji === 'ilosciowe' ||
      row?.rodzaj_ewidencji === 'ilosciowe' ||
      model?.sprzet_ilosciowy === true ||
      model?.czy_ilosciowy === true ||
      model?.tryb_ewidencji === 'ilosciowe' ||
      model?.typ_ewidencji === 'ilosciowe' ||
      model?.rodzaj_ewidencji === 'ilosciowe' ||
      model?.typ_sprzetu === 'ilosciowe'
    );
  }
  function isEquipmentInstance(row: any) {
    const modelType = row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu;
    const hasInstance = Boolean(row?.id_egzemplarza || row?.egzemplarz || row?.id);
    return hasInstance && !isQuantityOnly(row) && (isRackLike(row) || (modelType !== 'opakowanie' && !isCase(row)));
  }
  function modelIdOf(row: any) { return row?.id_modelu || row?.model?.id || row?.egzemplarz?.id_modelu || row?.egzemplarz?.model?.id || null; }
  function modelNameOf(row: any) { return row?.nazwa_modelu || row?.model?.nazwa || row?.egzemplarz?.model?.nazwa || row?.nazwa || row?.egzemplarz?.nazwa || 'Sprzęt'; }
  function modelCategoryIdOf(row: any) { return row?.id_kategorii || row?.model?.id_kategorii || row?.model?.kategoria?.id || row?.egzemplarz?.model?.id_kategorii || row?.egzemplarz?.model?.kategoria?.id || modelCategoryId(row?.model || row); }
  function categoryOf(row: any) {
    const id = modelCategoryIdOf(row);
    if (id && equipmentCategoryById.has(String(id))) return categoryPath(String(id), equipmentCategoryById);
    return row?.kategoria || row?.kategoria_nazwa || row?.model?.kategoria?.nazwa || row?.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii';
  }
  function numberOf(row: any) { const egz = row?.egzemplarz || row; return egz?.numer_egzemplarza || egz?.numer_urzadzenia || egz?.sn || egz?.kod_kreskowy || ''; }
  `;

  text = replaceBetween(text, 'function isCase(row: any)', 'const modelCountByCategory', helperBlock + 'const modelCountByCategory');

  const docFns = `function caseScanMeta(row: any) {
    if (!row) return null;
    return { id: row.id || row.id_egzemplarza, nazwa: row.nazwa || row.nazwa_modelu || 'Case', kod: allCodesOf(row)[0] || '' };
  }
  function normalizeDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {
    if (isQuantityOnly(row)) {
      return {
        source,
        rowType: 'ilosciowy_model',
        quantityOnly: true,
        id_modelu: row.id_modelu || row.model?.id || row.id,
        id_egzemplarza: null,
        nazwa: row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy',
        nazwa_modelu: row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy',
        numer_egzemplarza: '',
        kategoria: categoryOf(row),
        kod: row.kod || row.kod_kreskowy || row.model?.kod_kreskowy || row.model?.kod || '',
        ilosc: Number(row.ilosc || 1),
        jednostka: row.jednostka || row.model?.jednostka || 'szt.',
        uwagi: row.uwagi || 'Sprzęt ilościowy bez egzemplarzy',
      };
    }
    const egz = row.egzemplarz || row;
    const model = row.model || row.egzemplarz?.model;
    const instanceNo = numberOf(row);
    const baseName = model?.nazwa || row.nazwa_modelu || egz.model?.nazwa || row.nazwa || 'Sprzęt';
    return {
      source,
      rowType: isRackLike(row) ? 'rack' : 'egzemplarz',
      rack: isRackLike(row),
      id_modelu: row.id_modelu || model?.id || egz.id_modelu,
      id_egzemplarza: row.id_egzemplarza || egz.id,
      nazwa: [isRackLike(row) ? `[RACK] ${baseName}` : baseName, egz.nazwa && egz.nazwa !== model?.nazwa ? egz.nazwa : null, instanceNo ? `nr ${instanceNo}` : null].filter(Boolean).join(' · '),
      nazwa_modelu: baseName,
      numer_egzemplarza: instanceNo,
      kategoria: categoryOf(row),
      kod: row.kod || egz.kod_kreskowy || egz.zewnetrzny_kod_kreskowy || egz.zewnetrzny_qr_kod || egz.qr_kod || egz.sn || '',
      ilosc: 1,
      uwagi: row.uwagi || (isRackLike(row) ? 'Rack wydany jako jedna pozycja bez rozwijania zawartości.' : ''),
    };
  }
  function addDocumentItemsBulk(rows: any[], source: 'scan' | 'manual' = 'manual', sourceLabel = '', scannedCase: any = null) {
    const normalized = rows
      .filter((row: any) => isEquipmentInstance(row) && !isCase(row) && !isQuantityOnly(row))
      .map((row: any) => {
        const item = normalizeDocumentItem(row, source);
        const meta = scannedCase || row.system_case_scan || row.case_scan || null;
        return meta ? { ...item, system_case_scan: meta, id_zeskanowanego_case: meta.id, nazwa_zeskanowanego_case: meta.nazwa } : item;
      })
      .filter((item: any) => item.id_egzemplarza && item.id_modelu);
    if (!normalized.length) {
      setError('Nie znaleziono aktywnych egzemplarzy sprzętu do dodania na dokument.');
      return;
    }
    setDocItems((prev) => {
      const existingIds = new Set(prev.map((p: any) => Number(p.id_egzemplarza)).filter(Boolean));
      const toAdd: any[] = [];
      for (const item of normalized) {
        const id = Number(item.id_egzemplarza);
        if (!id || existingIds.has(id)) continue;
        existingIds.add(id);
        toAdd.push(item);
      }
      const skipped = normalized.length - toAdd.length;
      if (!toAdd.length) {
        setNotice(sourceLabel ? `${sourceLabel}: wszystkie pozycje z tego skanu są już na aktualnym dokumencie.` : 'Ten sprzęt jest już zeskanowany na aktualnym dokumencie.');
        return prev;
      }
      const rackCount = toAdd.filter((x: any) => x.rack || x.rowType === 'rack').length;
      setNotice(sourceLabel ? `${sourceLabel}: dodano ${toAdd.length} poz.${rackCount ? ' Rack jako jedna pozycja.' : ' Case nie trafia na dokument.'}` : `Dodano ${toAdd.length} poz.${skipped ? `, pominięto duplikaty: ${skipped}` : ''}.`);
      return [...prev, ...toAdd];
    });
  }
  function addQuantityDocumentItem(row: any, source: 'scan' | 'manual' = 'scan') {
    const modelId = Number(row.id_modelu || row.model?.id || row.id);
    if (!modelId) {
      setError('Nie udało się rozpoznać modelu ilościowego.');
      return;
    }
    const name = row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy';
    const available = Number(row.ilosc_dostepna || row.ilosc_magazynowa || row.model?.ilosc_magazynowa || 0);
    const unit = row.jednostka || row.model?.jednostka || 'szt.';
    const answer = window.prompt(`Ile sztuk wydać/przyjąć?\n${name}${available ? `\nDostępnie w magazynie: ${available} ${unit}` : ''}`, '1');
    if (answer === null) {
      setNotice('Anulowano dodawanie sprzętu ilościowego.');
      return;
    }
    const requested = Number(String(answer).replace(',', '.'));
    const suggested = Math.max(0, available ? Math.min(available, requested) : requested);
    if (!Number.isFinite(suggested) || suggested <= 0) {
      setError('Podaj ilość większą od 0.');
      return;
    }
    const item = normalizeDocumentItem({ ...row, rowType: 'ilosciowy_model', quantityOnly: true, id_modelu: modelId, id: modelId, ilosc: suggested, jednostka: unit }, source);
    setDocItems((prev) => {
      const idx = prev.findIndex((p: any) => isQuantityOnly(p) && Number(p.id_modelu) === modelId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ilosc: Number(next[idx].ilosc || 0) + suggested };
        return next;
      }
      return [...prev, item];
    });
    setNotice(`Dodano ${suggested} ${unit} · ${name}.`);
  }
  function quantityRowSelected(row: any) { const modelId = Number(row?.id_modelu); if (!modelId) return false; return docItems.some((p: any) => isQuantityOnly(p) && Number(p.id_modelu) === modelId); }
  function toggleQuantityRowWithoutScan(row: any, checked: boolean) {
    setError('');
    setNotice('');
    const modelId = Number(row?.id_modelu);
    if (!modelId) { setError('Nie udało się rozpoznać modelu ilościowego.'); return; }
    if (!checked) {
      setDocItems((prev) => prev.filter((p: any) => !(isQuantityOnly(p) && Number(p.id_modelu) === modelId)));
      setNotice(`Usunięto ${row.nazwa || 'sprzęt ilościowy'} z aktualnego dokumentu.`);
      return;
    }
    const amount = missingAfterScan(row);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice(`${row.nazwa || 'Ten model'} nie ma już brakujących sztuk do ${mode === 'wydanie' ? 'wydania' : 'przyjęcia'}.`); return; }
    const model = modelById.get(String(modelId)) || {};
    const unit = row.jednostka || model.jednostka || 'szt.';
    const item = normalizeDocumentItem({ ...model, rowType: 'ilosciowy_model', quantityOnly: true, id: modelId, id_modelu: modelId, nazwa: row.nazwa || model.nazwa, nazwa_modelu: row.nazwa || model.nazwa, kategoria: row.kategoria, kod: row.kod || model.kod_kreskowy || model.kod || '', ilosc: amount, jednostka: unit, uwagi: `${mode === 'wydanie' ? 'Wydanie' : 'Przyjęcie'} sprzętu ilościowego bez skanowania`, }, 'manual');
    setDocItems((prev) => {
      const withoutThisModel = prev.filter((p: any) => !(isQuantityOnly(p) && Number(p.id_modelu) === modelId));
      return [...withoutThisModel, { ...item, source: 'checkbox' }];
    });
    setNotice(`${mode === 'wydanie' ? 'Dodano do wydania' : 'Dodano do przyjęcia'} ${amount} ${unit} · ${row.nazwa || model.nazwa || 'sprzęt ilościowy'}.`);
  }
  function findQuantityModelByScannedCode(code: string) {
    const normalized = normScanCode(code);
    if (!normalized) return null;
    return (models || []).find((model: any) => isQuantityOnlyModel(model) && allCodesOf(model).some((c) => normScanCode(c) === normalized));
  }
  function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {
    setError('');
    setNotice('');
    if (isQuantityOnly(row)) { addQuantityDocumentItem(row, source); return; }
    if (isRackLike(row)) { addDocumentItemsBulk([row], source, 'Zeskanowano rack'); return; }
    if (isCase(row)) {
      const contents = (row.contents || row.zawartosc_case || [])
        .filter((child: any) => !isCase(child) && !isQuantityOnly(child) && isEquipmentInstance(child));
      if (!contents.length) { setError('Ten case jest pusty albo nie ma aktywnych egzemplarzy sprzętu w środku. Case nie trafia na dokument.'); return; }
      const label = row.nazwa || row.nazwa_modelu || row.kod || allCodesOf(row)[0] || `case #${row.id || row.id_egzemplarza || ''}`;
      addDocumentItemsBulk(contents, 'scan', `Zeskanowano case ${label}`, caseScanMeta(row));
      return;
    }
    if (!isEquipmentInstance(row)) { setError('Wydanie/przyjęcie działa na egzemplarzach, rack jest jedną pozycją, case rozwija zawartość, a sprzęt ilościowy zapisujemy jako model + ilość.'); return; }
    addDocumentItemsBulk([row], source);
  }
  `;

  text = replaceBetween(text, 'function caseScanMeta(row: any)', 'function focusScanInput()', docFns + 'function focusScanInput()');

  // Frontend scan fallback: first check quantity model in loaded models, then API.
  const oldScanStart = 'async function scan() { const code = scanCode.trim(); if (!code) { focusScanInput(); setNotice(\'Wpisz albo zeskanuj kod w polu tekstowym i naciśnij Enter.\'); return; } try {';
  const newScanStart = `async function scan() { const code = scanCode.trim(); if (!code) { focusScanInput(); setNotice('Wpisz albo zeskanuj kod w polu tekstowym i naciśnij Enter.'); return; }
    const quantityModel = findQuantityModelByScannedCode(code);
    if (quantityModel) {
      addQuantityDocumentItem({ ...quantityModel, rowType: 'ilosciowy_model', quantityOnly: true, id_modelu: quantityModel.id, nazwa_modelu: quantityModel.nazwa, kod: quantityModel.kod_kreskowy || quantityModel.kod || code }, 'scan');
      setScanCode('');
      setTimeout(focusScanInput, 0);
      return;
    }
    try {`;
  if (text.includes(oldScanStart)) {
    text = text.replace(oldScanStart, newScanStart);
  } else if (!text.includes('const quantityModel = findQuantityModelByScannedCode(code);')) {
    console.warn('Nie udało się automatycznie wstrzyknąć fallbacku scan() po dokładnym markerze — pomijam, reszta patcha zostaje.');
  }

  fs.writeFileSync(webFile, text);
  console.log('patched: apps/web/app/dashboard/events/[id]/page.tsx');
}

function insertBeforeLastClassBrace(text, method) {
  if (text.includes('znajdzSprzetDlaWydawkiPoKodzie(')) return text;
  const idx = text.lastIndexOf('\n}');
  if (idx === -1) throw new Error('Nie znaleziono końca klasy w magazyn.service.ts');
  return text.slice(0, idx) + method + text.slice(idx);
}

function patchApi() {
  backup(apiFile);
  let text = fs.readFileSync(apiFile, 'utf8');

  // Rack should not expand as a case even when it lives in opakowanie-like structures.
  text = text.replace(/const isDirectCase = egzemplarz\.model\?\.typ_sprzetu === 'opakowanie';/g, "const isDirectCase = egzemplarz.model?.typ_sprzetu === 'opakowanie' && !this.isRackLikeModel(egzemplarz.model);");
  text = text.replace(/if \(parentCase\.model\?\.typ_sprzetu === 'opakowanie'\) \{/g, "if (parentCase.model?.typ_sprzetu === 'opakowanie' && !this.isRackLikeModel(parentCase.model)) {");
  text = text.replace(/const isCase = egz\.model\?\.typ_sprzetu === 'opakowanie';/g, "const isCase = egz.model?.typ_sprzetu === 'opakowanie' && !this.isRackLikeModel(egz.model);");

  const serviceMethod = `

  async znajdzSprzetDlaWydawkiPoKodzie(kod: string, id_organizacji: number) {
    const code = String(kod || '').trim();
    if (!code) throw new BadRequestException('Podaj kod sprzętu do skanowania.');

    // 1) Najpierw sprawdzamy modele ilościowe — np. nogi Alustage.
    // Używamy kilku prób, bo różne wersje schematu mają różne nazwy pola kodu.
    const modelDelegate: any = (this.prisma.extendedClient as any).modelSprzetu;
    const modelWhereCandidates = [
      { kod_kreskowy: code },
      { kod: code },
      { qr_kod: code },
      { sn: code },
    ];

    for (const codeWhere of modelWhereCandidates) {
      try {
        const model = await modelDelegate.findFirst({
          where: {
            id_organizacji,
            aktywny: true,
            ...codeWhere,
          },
          include: { kategoria: true },
        });

        if (model && this.isQuantityLikeModel(model)) {
          return {
            rowType: 'ilosciowy_model',
            quantityOnly: true,
            id: model.id,
            id_modelu: model.id,
            id_egzemplarza: null,
            nazwa: model.nazwa,
            nazwa_modelu: model.nazwa,
            typ_sprzetu: model.typ_sprzetu,
            tryb_ewidencji: model.tryb_ewidencji,
            sprzet_ilosciowy: true,
            kod: model.kod_kreskowy || model.kod || code,
            kod_kreskowy: model.kod_kreskowy || model.kod || code,
            ilosc_dostepna: Number(model.ilosc_magazynowa || 0),
            ilosc_magazynowa: Number(model.ilosc_magazynowa || 0),
            jednostka: model.jednostka || 'szt.',
            kategoria: model.kategoria?.nazwa || 'Bez kategorii',
            model,
          };
        }
      } catch (_) {
        // Pole nie istnieje w tej wersji schematu — próbujemy kolejne.
      }
    }

    // 2) Reszta skanów idzie starą logiką: egzemplarz, case albo rack.
    const found = await this.znajdzSprzetPoKodzie(code, id_organizacji);

    // Rack ma zawsze wracać jako jedna pozycja, bez contents.
    if (this.isRackLikeModel(found?.model || found?.egzemplarz?.model || found)) {
      return {
        ...found,
        rowType: 'rack',
        rack: true,
        isCase: false,
        contents: [],
        zawartosc_case: [],
        nazwa: found?.nazwa?.startsWith?.('[RACK]') ? found.nazwa : `[RACK] ${found?.nazwa || found?.model?.nazwa || 'Rack'}`,
      };
    }

    return found;
  }

  private isQuantityLikeModel(model: any): boolean {
    return Boolean(
      model?.sprzet_ilosciowy === true ||
      model?.czy_ilosciowy === true ||
      model?.quantityOnly === true ||
      model?.tryb_ewidencji === 'ilosciowe' ||
      model?.typ_ewidencji === 'ilosciowe' ||
      model?.rodzaj_ewidencji === 'ilosciowe' ||
      model?.typ_sprzetu === 'ilosciowe'
    );
  }
`;

  text = insertBeforeLastClassBrace(text, serviceMethod);
  fs.writeFileSync(apiFile, text);
  console.log('patched: apps/api/src/magazyn/magazyn.service.ts');

  backup(controllerFile);
  let controller = fs.readFileSync(controllerFile, 'utf8');
  const oldEndpoint = "@Get('skan') async skanujSprzet(@Query('kod') kod: string, @Req() req: Request) { return this.magazynService.znajdzSprzetPoKodzie(kod, Number((req.user as any).id_organizacji)); }";
  const newEndpoint = "@Get('skan') async skanujSprzet(@Query('kod') kod: string, @Req() req: Request) { return this.magazynService.znajdzSprzetDlaWydawkiPoKodzie(kod, Number((req.user as any).id_organizacji)); }";
  if (controller.includes(oldEndpoint)) {
    controller = controller.replace(oldEndpoint, newEndpoint);
  } else if (!controller.includes('znajdzSprzetDlaWydawkiPoKodzie')) {
    throw new Error('Nie udało się znaleźć endpointu @Get(\'skan\') w magazyn.controller.ts');
  }
  fs.writeFileSync(controllerFile, controller);
  console.log('patched: apps/api/src/magazyn/magazyn.controller.ts');
}

try {
  patchWeb();
  patchApi();
  console.log('\n✅ Patch 13 założony. Teraz odpal prisma generate i restart API/frontu.');
} catch (err) {
  console.error('\n❌ Patch 13 nie został w pełni założony:');
  console.error(err);
  process.exit(1);
}
