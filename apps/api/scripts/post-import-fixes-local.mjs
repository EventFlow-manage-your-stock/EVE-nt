#!/usr/bin/env node
/**
 * EVE-NT LOCAL POST-IMPORT FIX v1
 *
 * 1. Czyści nazwy CASE/RACK z "1/1szt Waga: 29.1kg."
 * 2. Kopiuje zdjęcia modeli do apps/web/public/imported-warehouse-images/
 *    i ustawia ModelSprzetu.zdjecie na ABSOLUTNĄ ścieżkę URL /imported-warehouse-images/...
 * 3. Importuje ceny z NEW_ceny_modeli.xlsx do CenaModelu bez duplikatów.
 * 4. Usuwa kontrahentów/kontakty danej organizacji (bez kasowania wydarzeń),
 *    importuje NEW + StageTeam, scala duplikaty i próbuje ponownie podpiąć
 *    kontrahentów/kontakty do istniejących wydarzeń.
 *
 * Uruchamiaj z apps/api.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const prisma = new PrismaClient();

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const n = process.argv[i + 1];
  if (!n || n.startsWith('--')) return true;
  return n;
}

const opts = {
  dataDir: path.resolve(String(arg('data-dir', './import/new'))),
  gearXlsx: arg('gear-xlsx') ? path.resolve(String(arg('gear-xlsx'))) : null,
  pricesXlsx: arg('prices') ? path.resolve(String(arg('prices'))) : null,
  stageteamXlsx: arg('stageteam') ? path.resolve(String(arg('stageteam'))) : null,
  newCrmXlsx: arg('new-crm') ? path.resolve(String(arg('new-crm'))) : null,
  orgId: arg('org-id') ? Number(arg('org-id')) : null,
  allowNonlocal: Boolean(arg('allow-nonlocal', false)),
  skipGearFix: Boolean(arg('skip-gear-fix', false)),
  skipPrices: Boolean(arg('skip-prices', false)),
  skipCrm: Boolean(arg('skip-crm', false)),
};

function text(v) {
  return String(v ?? '').trim();
}

function norm(v) {
  return text(v)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' i ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(v) {
  return text(v).replace(/\D/g, '');
}

function nullable(v) {
  const s = text(v);
  if (!s || ['brak', '-', 'null', 'none'].includes(norm(s))) return null;
  return s;
}

function bool(v, fallback = false) {
  const s = norm(v);
  if (!s) return fallback;
  if (['tak', 'yes', 'true', '1', 'aktywny'].includes(s)) return true;
  if (['nie', 'no', 'false', '0', 'nieaktywny'].includes(s)) return false;
  return fallback;
}

function numberOrNull(v) {
  if (v === null || v === undefined || text(v) === '') return null;
  const n = Number(text(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function cleanEmail(v) {
  const s = text(v).toLowerCase();
  if (!s || s === 'brak') return null;
  const m = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function cleanPhone(v) {
  const s = text(v);
  if (!s || norm(s) === 'brak') return null;
  const plus = s.trim().startsWith('+') ? '+' : '';
  const d = s.replace(/\D/g, '');
  return d ? plus + d : null;
}

function emailDomain(v) {
  const e = cleanEmail(v);
  return e ? e.split('@')[1] : '';
}

function legalNameNorm(v) {
  let s = norm(v);
  const phrases = [
    'spolka z ograniczona odpowiedzialnoscia',
    'sp z ograniczona odpowiedzialnoscia',
    'sp z o o',
    'sp zoo',
    'spolka akcyjna',
    's a',
    'sa',
    'spolka komandytowa',
    'sp k',
    'sp jawna',
    'sp j',
    'limited',
    'ltd',
    'gmbh',
    'inc',
  ];
  for (const p of phrases) {
    s = s.replace(new RegExp(`\\b${p.replace(/\s+/g, '\\s+')}\\b`, 'g'), ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

function tokens(v) {
  return new Set(legalNameNorm(v).split(' ').filter((x) => x.length >= 2));
}

function diceSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function cleanPackageName(name) {
  let s = text(name);

  // np.: 1 x Monitor 43" (...) 1/1szt Waga: 29.1kg.
  s = s.replace(
    /\s+\d+\s*\/\s*\d+\s*szt\.?\s*(?:waga\s*:\s*[\d.,]+\s*kg\.?)?\s*$/i,
    '',
  );

  // jeżeli występuje samo "Waga: ..."
  s = s.replace(/\s+waga\s*:\s*[\d.,]+\s*kg\.?\s*$/i, '');

  return s.replace(/\s{2,}/g, ' ').trim();
}

function findFileRecursive(root, names) {
  if (!root || !fs.existsSync(root)) return null;
  const wanted = new Set(names.map((x) => x.toLowerCase()));
  const stack = [root];

  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '.git', '.venv'].includes(e.name)) stack.push(full);
      } else if (wanted.has(e.name.toLowerCase())) {
        return full;
      }
    }
  }
  return null;
}

function findFileByBasename(root, basename) {
  if (!root || !basename || !fs.existsSync(root)) return null;

  const directCandidates = [
    path.join(root, basename),
    path.join(root, 'images', basename),
    path.join(path.dirname(root), 'images', basename),
  ];
  for (const c of directCandidates) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;

  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '.git', '.venv'].includes(e.name)) stack.push(full);
      } else if (e.name === basename) {
        return full;
      }
    }
  }
  return null;
}

function workbook(file) {
  if (!file || !fs.existsSync(file)) throw new Error(`Brak pliku XLSX: ${file || '(null)'}`);
  return XLSX.readFile(file, { cellDates: true, raw: false });
}

function sheetRows(wb, sheet) {
  const ws = wb.Sheets[sheet];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) : [];
}

function allSheetRows(file) {
  const wb = workbook(file);
  return wb.SheetNames.map((sheet) => ({
    sheet,
    rows: sheetRows(wb, sheet),
  }));
}

function hasColumns(row, required) {
  const keys = new Set(Object.keys(row).map(norm));
  return required.every((r) => keys.has(norm(r)));
}

function get(row, names) {
  const entries = Object.entries(row);
  for (const name of names) {
    const n = norm(name);
    const found = entries.find(([k]) => norm(k) === n);
    if (found) return found[1];
  }
  return '';
}

function localGuard() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) throw new Error('Brak DATABASE_URL.');

  const u = new URL(raw);
  const local = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'wms_postgres']);
  console.log(`DB host: ${u.hostname}`);

  if (!local.has(u.hostname) && !opts.allowNonlocal) {
    throw new Error(`ODMOWA: ${u.hostname} nie wygląda na lokalną bazę.`);
  }
}

async function resolveOrg() {
  const list = await prisma.organizacja.findMany({
    where: { data_usuniecia: null },
    orderBy: { id: 'asc' },
  });

  if (!list.length) throw new Error('Brak organizacji.');

  if (opts.orgId) {
    const o = list.find((x) => x.id === opts.orgId);
    if (!o) throw new Error(`Brak organizacji id=${opts.orgId}`);
    return o;
  }

  if (list.length === 1) return list[0];

  console.log('Organizacje:');
  for (const o of list) console.log(`  ${o.id}: ${o.nazwa}`);
  throw new Error('Podaj --org-id N.');
}

function buildDbModelIndexes(models) {
  const byBarcode = new Map();
  const byName = new Map();
  const byCleanName = new Map();

  for (const m of models) {
    const bc = text(m.kod_kreskowy);
    if (bc) {
      if (!byBarcode.has(bc)) byBarcode.set(bc, []);
      byBarcode.get(bc).push(m);
    }

    const n = norm(m.nazwa);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(m);

    const cn = norm(cleanPackageName(m.nazwa));
    if (!byCleanName.has(cn)) byCleanName.set(cn, []);
    byCleanName.get(cn).push(m);
  }

  return { byBarcode, byName, byCleanName };
}

function one(map, key) {
  const a = map.get(key) || [];
  return a.length === 1 ? a[0] : null;
}

function matchDbModel(row, idx) {
  const bc = text(get(row, ['kod_kreskowy', 'kod kreskowy', 'kod kreskowy modelu']));
  if (bc) {
    const m = one(idx.byBarcode, bc);
    if (m) return m;
  }

  const name = text(get(row, ['nazwa', 'nazwa_modelu', 'nazwa modelu']));
  if (name) {
    let m = one(idx.byName, norm(name));
    if (m) return m;
    m = one(idx.byCleanName, norm(cleanPackageName(name)));
    if (m) return m;
  }

  return null;
}

async function fixGearNamesAndImages(orgId, gearFile) {
  console.log('\n=== FIX NAZW + ZDJĘĆ ===');

  const wb = workbook(gearFile);
  const rows = sheetRows(wb, '03_Modele');
  if (!rows.length) throw new Error(`Brak 03_Modele w ${gearFile}`);

  const models = await prisma.modelSprzetu.findMany({
    where: { id_organizacji: orgId, data_usuniecia: null },
  });
  let idx = buildDbModelIndexes(models);

  let renamed = 0;

  for (const m of models) {
    if (m.typ_sprzetu !== 'opakowanie') continue;
    const cleaned = cleanPackageName(m.nazwa);
    if (cleaned && cleaned !== m.nazwa) {
      await prisma.modelSprzetu.update({
        where: { id: m.id },
        data: { nazwa: cleaned },
      });
      renamed++;
    }
  }

  // Odśwież indeks po zmianie nazw.
  const models2 = await prisma.modelSprzetu.findMany({
    where: { id_organizacji: orgId, data_usuniecia: null },
  });
  idx = buildDbModelIndexes(models2);

  const webPublic = path.resolve(process.cwd(), '../web/public');
  if (!fs.existsSync(webPublic)) {
    throw new Error(`Nie znaleziono apps/web/public: ${webPublic}. Uruchom z apps/api.`);
  }

  const targetDir = path.join(webPublic, 'imported-warehouse-images');
  fs.mkdirSync(targetDir, { recursive: true });

  const searchRoot = path.dirname(gearFile);
  let imagesCopied = 0;
  let imageMisses = 0;
  let modelMisses = 0;

  const newIdToDbId = new Map();

  for (const r of rows) {
    const dbModel = matchDbModel(r, idx);
    if (!dbModel) {
      modelMisses++;
      continue;
    }

    const newId = text(get(r, ['__new_model_id']));
    if (newId) newIdToDbId.set(newId, dbModel.id);

    const imageBase =
      text(get(r, ['__zdjecie_plik'])) ||
      path.basename(text(get(r, ['zdjecie'])));

    if (!imageBase) continue;

    const source = findFileByBasename(searchRoot, imageBase)
      || findFileByBasename(opts.dataDir, imageBase);

    if (!source) {
      imageMisses++;
      continue;
    }

    const ext = path.extname(imageBase);
    const stem = path.basename(imageBase, ext)
      .replace(/[^\p{L}\p{N}._ -]+/gu, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100);

    const targetName = `model_${dbModel.id}_${stem}${ext}`;
    const target = path.join(targetDir, targetName);
    fs.copyFileSync(source, target);

    // ABSOLUTNY URL. Dzięki "/" browser nie zrobi /dashboard/warehouse/images/...
    const publicUrl = `/imported-warehouse-images/${targetName}`;

    await prisma.modelSprzetu.update({
      where: { id: dbModel.id },
      data: { zdjecie: publicUrl },
    });

    imagesCopied++;
  }

  const report = {
    gear_file: gearFile,
    package_names_cleaned: renamed,
    images_copied: imagesCopied,
    image_files_not_found: imageMisses,
    xlsx_models_not_matched_to_db: modelMisses,
    public_dir: targetDir,
  };

  fs.writeFileSync(
    path.join(opts.dataDir, 'POST_FIX_GEAR_REPORT.json'),
    JSON.stringify(report, null, 2),
  );

  console.log(report);

  return { newIdToDbId };
}

async function importPrices(orgId, priceFile, gearFile, existingMap = null) {
  console.log('\n=== IMPORT CEN ===');

  if (!priceFile) {
    console.log('Brak pliku cen — pomijam.');
    return;
  }

  const pwb = workbook(priceFile);
  const priceSheet =
    pwb.Sheets['Ceny']
      ? 'Ceny'
      : pwb.Sheets['NEW_Ceny']
        ? 'NEW_Ceny'
        : pwb.SheetNames[0];

  const prices = sheetRows(pwb, priceSheet);
  if (!prices.length) throw new Error(`Plik cen nie zawiera rekordów: ${priceFile}`);

  let newIdToDbId = existingMap?.newIdToDbId || new Map();

  if (!newIdToDbId.size && gearFile) {
    const gwb = workbook(gearFile);
    const gr = sheetRows(gwb, '03_Modele');
    const models = await prisma.modelSprzetu.findMany({
      where: { id_organizacji: orgId, data_usuniecia: null },
    });
    const idx = buildDbModelIndexes(models);

    for (const r of gr) {
      const m = matchDbModel(r, idx);
      const newId = text(get(r, ['__new_model_id']));
      if (m && newId) newIdToDbId.set(newId, m.id);
    }
  }

  // Dodatkowe indeksy po nazwie.
  const models = await prisma.modelSprzetu.findMany({
    where: { id_organizacji: orgId, data_usuniecia: null },
  });
  const modelIdx = buildDbModelIndexes(models);

  // Test lokalny: zastępujemy wszystkie stawki modeli NEW, żeby nie robić duplikatów.
  await prisma.cenaModelu.deleteMany({
    where: { id_organizacji: orgId },
  });

  const seen = new Set();
  let created = 0;
  let unmatched = 0;

  for (const r of prices) {
    const newId = text(get(r, ['new_model_id', 'ID modelu NEW', 'model_id_new']));
    let modelId = newId ? newIdToDbId.get(newId) : null;

    if (!modelId) {
      const fake = {
        nazwa: get(r, ['nazwa_modelu', 'Nazwa modelu', 'Nazwa sprzętu']),
        kod_kreskowy: get(r, ['kod_kreskowy', 'Kod kreskowy']),
      };
      modelId = matchDbModel(fake, modelIdx)?.id || null;
    }

    if (!modelId) {
      unmatched++;
      continue;
    }

    const rate = text(get(r, ['nazwa_stawki', 'Nazwa stawki', 'stawka'])) || 'Podstawowa (PLN)';
    const price = numberOrNull(get(r, ['cena_netto', 'Cena', 'cena']));
    const cost = numberOrNull(get(r, ['koszt', 'Koszt']));
    const costName = nullable(get(r, ['nazwa_kosztu', 'Nazwa kosztu']));
    const multiplyCost = bool(get(r, ['mnoz_koszt', 'Mnóż koszt', 'one_per_event']), false);

    const key = `${modelId}:${norm(rate)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    await prisma.cenaModelu.create({
      data: {
        id_organizacji: orgId,
        id_modelu: modelId,
        nazwa_stawki: rate,
        cena_netto: price,
        koszt: cost,
        nazwa_kosztu: costName,
        mnoz_koszt: multiplyCost,
        aktywny: true,
      },
    });
    created++;
  }

  const report = {
    prices_file: priceFile,
    sheet: priceSheet,
    source_rows: prices.length,
    created,
    unmatched,
  };
  fs.writeFileSync(
    path.join(opts.dataDir, 'POST_FIX_PRICES_REPORT.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(report);
}

function splitPerson(full) {
  const s = text(full);
  if (!s || norm(s) === 'brak') return { imie: null, nazwisko: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { imie: parts[0], nazwisko: null };
  return {
    imie: parts.slice(0, -1).join(' '),
    nazwisko: parts.at(-1),
  };
}

function parseAddress(raw) {
  const s = text(raw);
  if (!s) return { ulica: null, nr_budynku: null };

  const m = s.match(/^(.*?)(?:\s+)(\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)?)$/);
  if (!m) return { ulica: s, nr_budynku: null };

  return { ulica: text(m[1]), nr_budynku: text(m[2]) };
}

function sourceMeta(row, names) {
  const parts = [];
  for (const n of names) {
    const v = nullable(get(row, [n]));
    if (v) parts.push(`${n}: ${v}`);
  }
  return parts.join('; ');
}

function mergeValue(a, b, preferB = false) {
  const A = nullable(a);
  const B = nullable(b);
  if (preferB && B) return B;
  return A || B || null;
}

function companyFromNew(row) {
  const legalName =
    nullable(get(row, ['Nazwa', 'Nazwa firmy', 'Nazwa klienta'])) || 'BEZ NAZWY';
  const shortName = nullable(get(row, ['Nazwa firmy']));
  const addr = parseAddress(get(row, ['Adres', 'Ulica']));

  const notes = sourceMeta(row, [
    'Termin płatności [dni]',
    'Typ/Grupa',
    'Opiekunowie',
    'Status',
    'Stworzono',
    'Zaktualizowano',
    'Dodatkowe informacje',
  ]);

  return {
    source: ['NEW'],
    sourceIds: { new: text(get(row, ['ID'])) || null, stage: null },
    nazwa: legalName,
    nazwa_skrocona: shortName,
    nip: digits(get(row, ['Numer NIP', 'NIP'])).slice(0, 10) || null,
    regon: digits(get(row, ['REGON'])).slice(0, 14) || null,
    krs: digits(get(row, ['KRS'])).slice(0, 10) || null,
    ulica: addr.ulica,
    nr_budynku: addr.nr_budynku,
    nr_lokalu: nullable(get(row, ['Nr lokalu', 'Numer lokalu'])),
    kod_pocztowy: nullable(get(row, ['Kod pocztowy'])),
    miasto: nullable(get(row, ['Miasto'])),
    kraj: nullable(get(row, ['Państwo', 'Kraj'])) || 'Polska',
    email: cleanEmail(get(row, ['Adres e-mail', 'E-mail', 'Email'])),
    telefon: cleanPhone(get(row, ['Telefon'])),
    nr_konta: nullable(get(row, ['Numer konta', 'Nr konta'])),
    czy_klient: bool(get(row, ['Klient']), true),
    czy_dostawca: bool(get(row, ['Dostawca']), false),
    uwagi: notes || null,
  };
}

function companyFromStage(row) {
  const name = nullable(get(row, ['Nazwa klienta', 'Nazwa firmy', 'Nazwa']));
  const direct = splitPerson(get(row, ['Imię i nazwisko']));

  const company = {
    source: ['STAGETEAM'],
    sourceIds: { new: null, stage: text(get(row, ['ID klienta', 'ID'])) || null },
    nazwa: name || 'BEZ NAZWY',
    nazwa_skrocona: null,
    nip: digits(get(row, ['NIP', 'Numer NIP'])).slice(0, 10) || null,
    regon: null,
    krs: null,
    ulica: null,
    nr_budynku: null,
    nr_lokalu: null,
    kod_pocztowy: null,
    miasto: null,
    kraj: 'Polska',
    email: null,
    telefon: null,
    nr_konta: null,
    czy_klient: true,
    czy_dostawca: false,
    uwagi: nullable(get(row, ['Opis'])),
    directContact: {
      imie: direct.imie,
      nazwisko: direct.nazwisko,
      stanowisko: null,
      email: cleanEmail(get(row, ['E-mail', 'Email'])),
      telefon: cleanPhone(get(row, ['Telefon'])),
      notatki_wewnetrzne: nullable(get(row, ['Opis'])),
      glowny: true,
      source: 'STAGETEAM_KLIENT',
    },
  };

  // Jeżeli firma nie ma maila/telefonu, nie przenosimy automatycznie danych osoby
  // do pól firmy; pozostają kontaktem.
  return company;
}

function mergeCompanies(base, other) {
  const out = { ...base };
  out.source = [...new Set([...(base.source || []), ...(other.source || [])])];
  out.sourceIds = {
    new: base.sourceIds?.new || other.sourceIds?.new || null,
    stage: base.sourceIds?.stage || other.sourceIds?.stage || null,
  };

  // NEW jest zwykle bogatszy w dane rejestrowe.
  const otherIsNew = (other.source || []).includes('NEW');

  for (const field of [
    'nazwa', 'nazwa_skrocona', 'nip', 'regon', 'krs',
    'ulica', 'nr_budynku', 'nr_lokalu',
    'kod_pocztowy', 'miasto', 'kraj', 'email',
    'telefon', 'nr_konta',
  ]) {
    out[field] = mergeValue(out[field], other[field], otherIsNew);
  }

  out.czy_klient = Boolean(base.czy_klient || other.czy_klient);
  out.czy_dostawca = Boolean(base.czy_dostawca || other.czy_dostawca);

  const notes = [nullable(base.uwagi), nullable(other.uwagi)]
    .filter(Boolean);
  out.uwagi = [...new Set(notes)].join('\n') || null;

  if (!out.directContact && other.directContact) out.directContact = other.directContact;

  return out;
}

function chooseExistingCompany(companies, candidate) {
  if (candidate.nip && candidate.nip.length === 10) {
    const byNip = companies.find((c) => c.nip === candidate.nip);
    if (byNip) return byNip;
  }

  const strict = legalNameNorm(candidate.nazwa);
  if (strict) {
    const exact = companies.find((c) => legalNameNorm(c.nazwa) === strict);
    if (exact) return exact;
  }

  const domain = emailDomain(candidate.email);
  if (domain) {
    const sameDomain = companies.filter((c) => emailDomain(c.email) === domain);
    if (sameDomain.length === 1) return sameDomain[0];
  }

  let best = null;
  let bestScore = 0;
  for (const c of companies) {
    const score = diceSimilarity(c.nazwa, candidate.nazwa);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  if (best && bestScore >= 0.86) return best;

  return null;
}

function detectCrmRows(file, source) {
  const sheets = allSheetRows(file);
  const companies = [];
  const contacts = [];

  for (const { sheet, rows } of sheets) {
    if (!rows.length) continue;
    const first = rows[0];

    if (source === 'NEW' && hasColumns(first, ['ID', 'Nazwa'])) {
      for (const r of rows) {
        if (nullable(get(r, ['Nazwa', 'Nazwa firmy']))) companies.push(companyFromNew(r));
      }
      continue;
    }

    if (source === 'STAGETEAM' && hasColumns(first, ['ID klienta', 'Nazwa klienta'])) {
      for (const r of rows) {
        const c = companyFromStage(r);
        if (nullable(c.nazwa)) companies.push(c);
      }
      continue;
    }

    if (
      source === 'STAGETEAM'
      && hasColumns(first, ['Imię', 'Nazwisko', 'Firma'])
    ) {
      for (const r of rows) {
        contacts.push({
          source: 'STAGETEAM_KONTAKT',
          imie: nullable(get(r, ['Imię'])),
          nazwisko: nullable(get(r, ['Nazwisko'])),
          email: cleanEmail(get(r, ['E-mail', 'Email'])),
          stanowisko: nullable(get(r, ['Stanowisko'])),
          firmaRef: nullable(get(r, ['Firma'])),
          telefon: cleanPhone(get(r, ['Telefon'])),
        });
      }
    }
  }

  return { companies, contacts };
}

function contactIdentity(c) {
  if (c.email) return `mail:${c.email}`;
  if (c.telefon) return `tel:${digits(c.telefon)}:${norm(`${c.imie || ''} ${c.nazwisko || ''}`)}`;
  return `name:${norm(`${c.imie || ''} ${c.nazwisko || ''}`)}`;
}

function companyDomainScore(contactEmail, company) {
  const domain = emailDomain(contactEmail);
  if (!domain) return 0;

  const stem = domain.split('.')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!stem || ['gmail', 'wp', 'onet', 'interia', 'outlook', 'hotmail'].includes(stem)) return 0;

  const n = legalNameNorm(company.nazwa).replace(/\s/g, '');
  if (n.includes(stem) || stem.includes(n)) return 1;

  const ts = [...tokens(company.nazwa)];
  const hits = ts.filter((t) => t.length >= 4 && stem.includes(t)).length;
  return hits / Math.max(1, ts.length);
}

async function snapshotEventCrm(orgId) {
  return prisma.wydarzenie.findMany({
    where: { id_organizacji: orgId, data_usuniecia: null },
    select: {
      id: true,
      nazwa: true,
      kontrahent: {
        select: { nazwa: true, nip: true, email: true, telefon: true },
      },
      kontakt: {
        select: { imie: true, nazwisko: true, email: true, telefon: true },
      },
    },
  });
}

async function foreignKeysReferencing(targetTable) {
  return prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name,
      kcu.column_name,
      cols.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = tc.table_schema
     AND cols.table_name = tc.table_name
     AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = current_schema()
      AND ccu.table_name = $1
      AND ccu.column_name = 'id'
  `, targetTable);
}

function ident(s) {
  // nazwy pochodzą tylko z information_schema
  return `"${String(s).replace(/"/g, '""')}"`;
}

async function tableHasColumn(table, column) {
  const r = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
  `, table, column);
  return r.length > 0;
}

async function nullReferences(targetTable, orgId, exclude = new Set()) {
  const fks = await foreignKeysReferencing(targetTable);
  const report = [];

  for (const fk of fks) {
    const table = String(fk.table_name);
    const col = String(fk.column_name);
    const nullableCol = String(fk.is_nullable).toUpperCase() === 'YES';

    if (exclude.has(table)) continue;

    if (!nullableCol) {
      report.push({ table, column: col, action: 'SKIP_NOT_NULL' });
      continue;
    }

    const hasOrg = await tableHasColumn(table, 'id_organizacji');
    const sql = hasOrg
      ? `UPDATE ${ident(table)} SET ${ident(col)} = NULL WHERE "id_organizacji" = $1 AND ${ident(col)} IS NOT NULL`
      : `UPDATE ${ident(table)} SET ${ident(col)} = NULL WHERE ${ident(col)} IS NOT NULL`;

    const count = hasOrg
      ? await prisma.$executeRawUnsafe(sql, orgId)
      : await prisma.$executeRawUnsafe(sql);

    report.push({ table, column: col, action: 'NULL', rows: Number(count) });
  }

  return report;
}

async function importCrm(orgId, stageFile, newFile) {
  console.log('\n=== RESET + IMPORT CRM BEZ DUPLIKATÓW ===');

  if (!stageFile || !newFile) {
    throw new Error('CRM wymaga --stageteam PLIK.xlsx oraz --new-crm PLIK.xlsx');
  }

  const stage = detectCrmRows(stageFile, 'STAGETEAM');
  const nw = detectCrmRows(newFile, 'NEW');

  console.log(`NEW firmy: ${nw.companies.length}`);
  console.log(`StageTeam firmy: ${stage.companies.length}`);
  console.log(`StageTeam osobne kontakty: ${stage.contacts.length}`);

  // Najpierw NEW jako źródło bogatsze, potem ST.
  const merged = [];
  let mergedDuplicates = 0;

  for (const candidate of [...nw.companies, ...stage.companies]) {
    const existing = chooseExistingCompany(merged, candidate);
    if (existing) {
      const idx = merged.indexOf(existing);
      merged[idx] = mergeCompanies(existing, candidate);
      mergedDuplicates++;
    } else {
      merged.push(candidate);
    }
  }

  // Mapa ID StageTeam -> firma po scaleniu.
  const stageIdMap = new Map();
  for (const c of merged) {
    if (c.sourceIds?.stage) stageIdMap.set(String(c.sourceIds.stage), c);
  }

  const canonicalContacts = new Map();
  const orphanContacts = [];

  // Kontakty z wiersza klienta StageTeam.
  for (const c of merged) {
    const dc = c.directContact;
    if (!dc || !(dc.imie || dc.nazwisko || dc.email || dc.telefon)) continue;
    const key = `${legalNameNorm(c.nazwa)}:${contactIdentity(dc)}`;
    canonicalContacts.set(key, { ...dc, company: c });
  }

  // Osobny plik/arkusz kontaktów StageTeam.
  for (const sc of stage.contacts) {
    let company = null;
    const ref = text(sc.firmaRef);

    // Firma może mieć format a123 / 123.
    const m = ref.match(/^[a-z]?(\d+)$/i);
    if (m) company = stageIdMap.get(m[1]) || null;

    // Jeżeli referencja typu a1 wskazuje firmę, ale domena e-mail kontaktu
    // jednoznacznie wskazuje inną firmę, preferuj silne dopasowanie domeny.
    // Chroni to przed nieczytelnymi/starymi identyfikatorami firm w StageTeam.
    if (company && sc.email) {
      const currentScore = companyDomainScore(sc.email, company);
      const ranked = merged
        .map((c) => ({ c, score: companyDomainScore(sc.email, c) }))
        .filter((x) => x.score >= 0.5)
        .sort((a, b) => b.score - a.score);

      if (
        ranked.length
        && ranked[0].c !== company
        && ranked[0].score >= 0.75
        && ranked[0].score > currentScore + 0.4
      ) {
        company = ranked[0].c;
      }
    }

    if (!company && ref) {
      const exact = merged.filter(
        (c) =>
          legalNameNorm(c.nazwa) === legalNameNorm(ref)
          || legalNameNorm(c.nazwa_skrocona) === legalNameNorm(ref),
      );
      if (exact.length === 1) company = exact[0];
    }

    // W razie nieczytelnego "a1" spróbuj domeny maila.
    if (!company && sc.email) {
      const ranked = merged
        .map((c) => ({ c, score: companyDomainScore(sc.email, c) }))
        .filter((x) => x.score >= 0.5)
        .sort((a, b) => b.score - a.score);

      if (ranked.length && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
        company = ranked[0].c;
      }
    }

    if (!company) {
      orphanContacts.push(sc);
      continue;
    }

    const key = `${legalNameNorm(company.nazwa)}:${contactIdentity(sc)}`;
    if (!canonicalContacts.has(key)) {
      canonicalContacts.set(key, { ...sc, company });
    } else {
      const old = canonicalContacts.get(key);
      canonicalContacts.set(key, {
        ...old,
        imie: old.imie || sc.imie,
        nazwisko: old.nazwisko || sc.nazwisko,
        email: old.email || sc.email,
        telefon: old.telefon || sc.telefon,
        stanowisko: old.stanowisko || sc.stanowisko,
        company,
      });
    }
  }

  // Snapshot eventów, żeby po resecie CRM ponownie podpiąć klientów.
  const eventSnapshot = await snapshotEventCrm(orgId);

  // Ustaw NULL we wszystkich nullable FK do kontaktów/kontrahentów.
  const nullContactRefs = await nullReferences('kontakty_kontrahentow', orgId);
  await prisma.kontaktKontrahenta.deleteMany({ where: { id_organizacji: orgId } });

  const nullContractorRefs = await nullReferences(
    'kontrahenci',
    orgId,
    new Set(['kontakty_kontrahentow']),
  );
  await prisma.kontrahent.deleteMany({ where: { id_organizacji: orgId } });

  // Insert firm.
  const companyDbMap = new Map();
  const dbByNip = new Map();
  const dbByName = new Map();

  for (const c of merged) {
    const row = await prisma.kontrahent.create({
      data: {
        id_organizacji: orgId,
        nazwa: c.nazwa,
        nazwa_skrocona: c.nazwa_skrocona,
        nip: c.nip && c.nip.length === 10 ? c.nip : null,
        regon: c.regon || null,
        krs: c.krs || null,
        ulica: c.ulica,
        nr_budynku: c.nr_budynku,
        nr_lokalu: c.nr_lokalu,
        kod_pocztowy: c.kod_pocztowy,
        miasto: c.miasto,
        kraj: c.kraj || 'Polska',
        email: c.email,
        telefon: c.telefon,
        uwagi: c.uwagi,
        zrodlo_danych: c.source.join('+').toLowerCase(),
        aktywny: true,
        czy_klient: c.czy_klient,
        czy_dostawca: c.czy_dostawca,
        nr_konta: c.nr_konta,
      },
    });

    companyDbMap.set(c, row);
    if (row.nip) dbByNip.set(row.nip, row);
    dbByName.set(legalNameNorm(row.nazwa), row);
  }

  // Insert kontaktów bez duplikatów.
  const contactDb = [];
  for (const c of canonicalContacts.values()) {
    const contractor = companyDbMap.get(c.company);
    if (!contractor) continue;

    const row = await prisma.kontaktKontrahenta.create({
      data: {
        id_organizacji: orgId,
        id_kontrahenta: contractor.id,
        imie: c.imie || null,
        nazwisko: c.nazwisko || null,
        stanowisko: c.stanowisko || null,
        email: c.email || null,
        telefon: c.telefon || null,
        notatki_wewnetrzne: c.notatki_wewnetrzne || null,
        glowny: Boolean(c.glowny),
        aktywny: true,
      },
    });
    contactDb.push(row);
  }

  // Re-link eventów.
  const contactsByContractor = new Map();
  for (const c of contactDb) {
    if (!contactsByContractor.has(c.id_kontrahenta)) contactsByContractor.set(c.id_kontrahenta, []);
    contactsByContractor.get(c.id_kontrahenta).push(c);
  }

  let eventsRelinked = 0;
  let contactsRelinked = 0;

  for (const e of eventSnapshot) {
    if (!e.kontrahent) continue;

    let contractor = null;
    const oldNip = digits(e.kontrahent.nip).slice(0, 10);
    if (oldNip) contractor = dbByNip.get(oldNip) || null;
    if (!contractor) contractor = dbByName.get(legalNameNorm(e.kontrahent.nazwa)) || null;
    if (!contractor) continue;

    let contact = null;
    if (e.kontakt) {
      const candidates = contactsByContractor.get(contractor.id) || [];
      const oldMail = cleanEmail(e.kontakt.email);
      if (oldMail) contact = candidates.find((x) => cleanEmail(x.email) === oldMail) || null;

      if (!contact) {
        const oldPerson = norm(`${e.kontakt.imie || ''} ${e.kontakt.nazwisko || ''}`);
        const oldPhone = digits(e.kontakt.telefon);
        contact = candidates.find((x) => {
          const n = norm(`${x.imie || ''} ${x.nazwisko || ''}`);
          const p = digits(x.telefon);
          return (oldPerson && n === oldPerson) || (oldPhone && p === oldPhone);
        }) || null;
      }
    }

    await prisma.wydarzenie.update({
      where: { id: e.id },
      data: {
        id_kontrahenta: contractor.id,
        id_kontaktu: contact?.id || null,
      },
    });

    eventsRelinked++;
    if (contact) contactsRelinked++;
  }

  const report = {
    stageteam_file: stageFile,
    new_file: newFile,
    source_new_companies: nw.companies.length,
    source_stageteam_companies: stage.companies.length,
    source_stageteam_contacts: stage.contacts.length,
    duplicates_merged: mergedDuplicates,
    final_companies: merged.length,
    final_contacts: contactDb.length,
    orphan_contacts: orphanContacts,
    event_snapshot_count: eventSnapshot.length,
    events_relinked_to_contractor: eventsRelinked,
    events_relinked_to_contact: contactsRelinked,
    nulled_contact_foreign_keys: nullContactRefs,
    nulled_contractor_foreign_keys: nullContractorRefs,
  };

  fs.writeFileSync(
    path.join(opts.dataDir, 'POST_FIX_CRM_REPORT.json'),
    JSON.stringify(report, null, 2),
  );

  console.log({
    duplicates_merged: mergedDuplicates,
    final_companies: merged.length,
    final_contacts: contactDb.length,
    orphan_contacts: orphanContacts.length,
    events_relinked_to_contractor: eventsRelinked,
  });
}

async function main() {
  console.log('EVE-NT LOCAL POST-IMPORT FIX v1');
  localGuard();
  const org = await resolveOrg();
  console.log(`Organizacja: ${org.id} ${org.nazwa}`);

  fs.mkdirSync(opts.dataDir, { recursive: true });

  const gearFile =
    opts.gearXlsx
    || findFileRecursive(opts.dataDir, ['NEW_sprzet_do_EVE_NT_PRISMA.xlsx']);

  const priceFile =
    opts.pricesXlsx
    || findFileRecursive(opts.dataDir, ['NEW_ceny_modeli.xlsx']);

  let gearMap = null;

  if (!opts.skipGearFix) {
    if (!gearFile) throw new Error('Nie znaleziono NEW_sprzet_do_EVE_NT_PRISMA.xlsx');
    gearMap = await fixGearNamesAndImages(org.id, gearFile);
  }

  if (!opts.skipPrices) {
    if (priceFile) {
      await importPrices(org.id, priceFile, gearFile, gearMap);
    } else {
      console.log('\nUWAGA: brak NEW_ceny_modeli.xlsx — ceny NIE zostały jeszcze zaimportowane.');
      console.log('Najpierw uruchom export-new-prices.py i wrzuć wynik do --data-dir.');
    }
  }

  if (!opts.skipCrm) {
    await importCrm(org.id, opts.stageteamXlsx, opts.newCrmXlsx);
  }

  console.log('\nGOTOWE.');
}

main()
  .catch((e) => {
    console.error('\nBŁĄD:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
