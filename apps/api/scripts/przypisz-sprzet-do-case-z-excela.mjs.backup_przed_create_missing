#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const MARKER = 'ASSIGN_OPAKOWANIA_V2';

const stats = {
  casesFound: 0,
  casesCreated: 0,
  casesMissing: 0,
  casesUnpackedFromCase: 0,

  barcodeLines: 0,
  barcodeAssigned: 0,
  barcodeAssignedByNameAndCodeAdded: 0,
  barcodeCreatedAndAssigned: 0,
  barcodeMissing: 0,

  quantityLines: 0,
  quantityAssignedPhysical: 0,
  quantityPseudoCreated: 0,
  quantityPseudoUpdated: 0,
  quantityModelMissing: 0,

  ignoredLines: 0,
  rowsProcessed: 0,
};

const errors = [];
const warnings = [];
const reservedExemplarIds = new Set();

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function clean(value) {
  if (value === undefined || value === null) return null;

  const text = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  const lower = text.toLowerCase();

  if (
    lower === 'brak' ||
    lower === 'b/d' ||
    lower === 'bd' ||
    lower === '-' ||
    lower === '---' ||
    lower === 'null' ||
    lower === 'undefined'
  ) {
    return null;
  }

  return text;
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\],.;:"'`]+/g, ' ')
    .replace(/\bnumer\b/g, 'nr')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBarcodeVariants(value) {
  const raw = clean(value);
  if (!raw) return [];

  const variants = new Set();

  const text = String(raw).trim().replace(/^'/, '').replace(/\s/g, '');
  if (text) variants.add(text);

  const digits = text.replace(/\D/g, '');

  if (digits) {
    variants.add(digits);

    if (digits.length < 13) {
      variants.add(digits.padStart(13, '0'));
    }

    if (digits.length === 13 && digits.startsWith('0')) {
      variants.add(digits.slice(1));
    }
  }

  return [...variants].filter(Boolean);
}

function parseQuantityToken(token) {
  const text = clean(token);
  if (!text) return null;

  const match = text.match(/(\d+)\s*szt/i);
  if (!match) return null;

  const qty = Number(match[1]);

  return Number.isInteger(qty) && qty > 0 ? qty : null;
}

function extractEntriesFromText(text) {
  const source = clean(text);
  if (!source) return [];

  const entries = [];

  // Format w raporcie był np.:
  // LedBar TRIBAR 400 IR | 0000000000109 LedBar TRIBAR 400 IR | 0000000000110 ...
  // Poprzedni skrypt brał wszystko po pierwszym | jako jeden kod.
  // Ten regex wycina wiele par: nazwa | kod albo nazwa | 2 szt.
  const pattern = /([^|]+?)\s*\|\s*(\d+\s*szt\.?|\d{4,13})/gi;

  let match;

  while ((match = pattern.exec(source)) !== null) {
    const name = clean(match[1]);
    const token = clean(match[2]);

    if (!name || !token) continue;

    const qty = parseQuantityToken(token);

    if (qty) {
      entries.push({
        type: 'quantity',
        name,
        qty,
        raw: `${name} | ${token}`,
      });
      continue;
    }

    const barcodeVariants = normalizeBarcodeVariants(token);

    if (barcodeVariants.length > 0) {
      entries.push({
        type: 'barcode',
        name,
        barcodeVariants,
        raw: `${name} | ${token}`,
      });
    }
  }

  return entries;
}

function parseContentLines(content) {
  const text = clean(content);
  if (!text) return [];

  const entries = extractEntriesFromText(text);

  if (entries.length > 0) {
    return entries;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);

  const out = [];

  for (const line of lines) {
    const parsed = extractEntriesFromText(line);

    if (parsed.length > 0) {
      out.push(...parsed);
      continue;
    }

    warnings.push({
      typ: 'linia',
      wiersz: '',
      opis: `Nie rozpoznano linii zawartości: ${line}`,
    });
  }

  return out;
}

function getCell(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }
  }

  const keys = Object.keys(row);

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);

    for (const name of names) {
      if (normalizedKey === normalizeKey(name)) {
        return row[key];
      }
    }
  }

  return null;
}

function appendNote(oldNote, newNote) {
  const oldText = clean(oldNote);

  if (!oldText) return newNote;
  if (oldText.includes(newNote)) return oldText;

  return `${oldText}\n${newNote}`;
}

function tokenSet(value) {
  const key = normalizeKey(value);

  return new Set(
    key
      .split(' ')
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .filter((x) => !['do', 'na', 'nr', 'szt', 'sztuk', 'zestaw'].includes(x))
  );
}

function nameScore(a, b) {
  const ak = normalizeKey(a);
  const bk = normalizeKey(b);

  if (!ak || !bk) return 0;
  if (ak === bk) return 100;
  if (ak.includes(bk) || bk.includes(ak)) return 80;

  const at = tokenSet(a);
  const bt = tokenSet(b);

  if (at.size === 0 || bt.size === 0) return 0;

  let common = 0;

  for (const token of at) {
    if (bt.has(token)) common += 1;
  }

  return Math.round((common / Math.max(at.size, bt.size)) * 70);
}

async function wybierzOrganizacje() {
  const organizacje = await prisma.organizacja.findMany({
    select: {
      id: true,
      nazwa: true,
      subdomena: true,
      nip: true,
      email: true,
      aktywny: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (organizacje.length === 0) {
    throw new Error('Brak organizacji w bazie.');
  }

  console.log('\nDostępne organizacje:\n');
  console.table(organizacje);

  const answer = await ask('Wpisz ID organizacji: ');
  const id = Number(answer);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Nieprawidłowe ID organizacji.');
  }

  const organizacja = organizacje.find((org) => org.id === id);

  if (!organizacja) {
    throw new Error(`Nie znaleziono organizacji o ID ${id}.`);
  }

  console.log(`\nWybrano organizację: ${organizacja.nazwa} / ID ${organizacja.id}\n`);

  return organizacja;
}

async function findExemplarByBarcode(orgId, barcodeVariants, mode) {
  if (!barcodeVariants || barcodeVariants.length === 0) return null;

  const ors = [];

  for (const code of barcodeVariants) {
    ors.push({ kod_kreskowy: code });
    ors.push({ qr_kod: code });
    ors.push({ zewnetrzny_kod_kreskowy: code });
    ors.push({ zewnetrzny_qr_kod: code });
  }

  const found = await prisma.egzemplarz.findMany({
    where: {
      id_organizacji: orgId,
      data_usuniecia: null,
      OR: ors,
    },
    include: {
      model: true,
    },
    take: 50,
  });

  if (mode === 'case') {
    return found.find((item) => item.model?.typ_sprzetu === 'opakowanie') || null;
  }

  return found.find((item) => item.model?.typ_sprzetu !== 'opakowanie') || null;
}

async function loadCaseCache(orgId) {
  const all = await prisma.egzemplarz.findMany({
    where: {
      id_organizacji: orgId,
      data_usuniecia: null,
    },
    include: {
      model: true,
    },
  });

  const cases = all.filter((item) => item.model?.typ_sprzetu === 'opakowanie');

  const byName = new Map();
  const byCode = new Map();

  for (const item of cases) {
    const names = [
      item.nazwa,
      item.numer_egzemplarza,
      item.kod_kreskowy,
      item.qr_kod,
      item.zewnetrzny_kod_kreskowy,
      item.zewnetrzny_qr_kod,
    ];

    for (const name of names) {
      const key = normalizeKey(name);
      if (key) byName.set(key, item);

      for (const code of normalizeBarcodeVariants(name)) {
        byCode.set(code, item);
      }
    }
  }

  return {
    cases,
    byName,
    byCode,
  };
}

function addCaseToCache(caseCache, caseExemplar) {
  caseCache.cases.push(caseExemplar);

  const names = [
    caseExemplar.nazwa,
    caseExemplar.numer_egzemplarza,
    caseExemplar.kod_kreskowy,
    caseExemplar.qr_kod,
    caseExemplar.zewnetrzny_kod_kreskowy,
    caseExemplar.zewnetrzny_qr_kod,
  ];

  for (const name of names) {
    const key = normalizeKey(name);
    if (key) caseCache.byName.set(key, caseExemplar);

    for (const code of normalizeBarcodeVariants(name)) {
      caseCache.byCode.set(code, caseExemplar);
    }
  }
}

function findCaseFromCache(caseCache, caseName, caseCode) {
  for (const code of normalizeBarcodeVariants(caseCode)) {
    const found = caseCache.byCode.get(code);
    if (found) return found;
  }

  const exactName = normalizeKey(caseName);

  if (exactName && caseCache.byName.has(exactName)) {
    return caseCache.byName.get(exactName);
  }

  // luźniejsze dopasowanie po nazwie
  let best = null;
  let bestScore = 0;

  for (const item of caseCache.cases) {
    const score = Math.max(
      nameScore(caseName, item.nazwa),
      nameScore(caseName, item.numer_egzemplarza)
    );

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return bestScore >= 55 ? best : null;
}

async function getOrCreateCase({ orgId, caseCache, caseName, caseCode, dryRun }) {
  const existing = findCaseFromCache(caseCache, caseName, caseCode);

  if (existing) {
    stats.casesFound += 1;
    return existing;
  }

  if (!caseName && !caseCode) {
    stats.casesMissing += 1;
    return null;
  }

  stats.casesCreated += 1;

  const name = caseName || `Opakowanie ${caseCode}`;

  if (dryRun) {
    return {
      id: -1000000 - stats.casesCreated,
      id_organizacji: orgId,
      nazwa: name,
      numer_egzemplarza: caseCode || name,
      kod_kreskowy: caseCode,
      qr_kod: caseCode,
      zewnetrzny_kod_kreskowy: caseCode,
      zewnetrzny_qr_kod: caseCode,
      model: {
        typ_sprzetu: 'opakowanie',
      },
    };
  }

  let model = await prisma.modelSprzetu.findFirst({
    where: {
      id_organizacji: orgId,
      nazwa: name,
      typ_sprzetu: 'opakowanie',
      data_usuniecia: null,
    },
  });

  if (!model) {
    model = await prisma.modelSprzetu.create({
      data: {
        id_organizacji: orgId,
        nazwa: name,
        typ_sprzetu: 'opakowanie',
        widoczny_w_ofercie: false,
        widoczny_w_mag: true,
        kod_kreskowy: caseCode || undefined,
        aktywny: true,
      },
    });
  }

  const exemplar = await prisma.egzemplarz.create({
    data: {
      id_organizacji: orgId,
      id_modelu: model.id,
      nazwa: name,
      numer_egzemplarza: caseCode || name,
      kod_kreskowy: caseCode || undefined,
      qr_kod: caseCode || undefined,
      zewnetrzny_kod_kreskowy: caseCode || undefined,
      zewnetrzny_qr_kod: caseCode || undefined,
      status_serwisowy: 'Działa',
      aktywny: true,
      notatki_wewnetrzne: `${MARKER}: utworzono brakujące opakowanie podczas przypisania zawartości.`,
    },
    include: {
      model: true,
    },
  });

  addCaseToCache(caseCache, exemplar);

  return exemplar;
}

async function loadModelCache(orgId) {
  const models = await prisma.modelSprzetu.findMany({
    where: {
      id_organizacji: orgId,
      data_usuniecia: null,
    },
  });

  const byName = new Map();

  for (const model of models) {
    if (model.typ_sprzetu === 'opakowanie') continue;

    const key = normalizeKey(model.nazwa);
    if (!key) continue;

    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(model);
  }

  return {
    models,
    byName,
  };
}

function findBestModel(modelCache, name) {
  const key = normalizeKey(name);

  if (!key) return null;

  const exact = modelCache.byName.get(key);

  if (exact && exact.length > 0) {
    return exact.find((model) => model.typ_sprzetu === 'ilosciowy') || exact[0];
  }

  let best = null;
  let bestScore = 0;

  for (const model of modelCache.models) {
    if (model.typ_sprzetu === 'opakowanie') continue;

    const score = nameScore(name, model.nazwa);

    if (score > bestScore) {
      best = model;
      bestScore = score;
    }
  }

  return bestScore >= 35 ? best : null;
}

async function findFreeExemplarByName({ orgId, modelCache, name }) {
  const model = findBestModel(modelCache, name);

  if (!model) return null;

  const candidates = await prisma.egzemplarz.findMany({
    where: {
      id_organizacji: orgId,
      id_modelu: model.id,
      id_case: null,
      data_usuniecia: null,
    },
    include: {
      model: true,
    },
    orderBy: {
      id: 'asc',
    },
    take: 100,
  });

  const filtered = candidates.filter((item) => {
    if (reservedExemplarIds.has(item.id)) return false;
    if (item.model?.typ_sprzetu === 'opakowanie') return false;

    const nr = String(item.numer_egzemplarza || '');
    const note = String(item.notatki_wewnetrzne || '');

    if (nr.startsWith('ILOŚĆ:')) return false;
    if (note.includes(MARKER)) return false;

    return true;
  });

  if (filtered.length === 0) return null;

  const emptyCode = filtered.find((item) => {
    return !item.kod_kreskowy && !item.qr_kod && !item.zewnetrzny_kod_kreskowy && !item.zewnetrzny_qr_kod;
  });

  return emptyCode || filtered[0];
}


async function getOrCreateModelForMissingBarcode({ orgId, modelCache, name, dryRun }) {
  let model = findBestModel(modelCache, name);

  if (model) return model;

  const cleanName = clean(name);

  if (!cleanName) return null;

  if (dryRun) {
    return {
      id: -3000000 - stats.barcodeCreatedAndAssigned,
      id_organizacji: orgId,
      nazwa: cleanName,
      typ_sprzetu: 'sprzet',
    };
  }

  model = await prisma.modelSprzetu.create({
    data: {
      id_organizacji: orgId,
      nazwa: cleanName,
      typ_sprzetu: 'sprzet',
      widoczny_w_ofercie: true,
      widoczny_w_mag: true,
      aktywny: true,
    },
  });

  modelCache.models.push(model);

  const key = normalizeKey(model.nazwa);

  if (key) {
    if (!modelCache.byName.has(key)) modelCache.byName.set(key, []);
    modelCache.byName.get(key).push(model);
  }

  return model;
}

async function createMissingExemplarFromBarcode({ orgId, caseExemplar, modelCache, entry, primaryBarcode, dryRun }) {
  const model = await getOrCreateModelForMissingBarcode({
    orgId,
    modelCache,
    name: entry.name,
    dryRun,
  });

  if (!model) return null;

  stats.barcodeCreatedAndAssigned += 1;

  if (dryRun) {
    return {
      id: -4000000 - stats.barcodeCreatedAndAssigned,
      id_organizacji: orgId,
      id_modelu: model.id,
      id_case: caseExemplar.id,
      nazwa: entry.name,
      kod_kreskowy: primaryBarcode,
      qr_kod: primaryBarcode,
      zewnetrzny_kod_kreskowy: primaryBarcode,
      zewnetrzny_qr_kod: primaryBarcode,
      numer_egzemplarza: primaryBarcode,
      status_serwisowy: 'Działa',
      aktywny: true,
      model,
    };
  }

  return prisma.egzemplarz.create({
    data: {
      id_organizacji: orgId,
      id_modelu: model.id,
      id_case: caseExemplar.id,
      nazwa: entry.name,
      kod_kreskowy: primaryBarcode,
      qr_kod: primaryBarcode,
      zewnetrzny_kod_kreskowy: primaryBarcode,
      zewnetrzny_qr_kod: primaryBarcode,
      numer_egzemplarza: primaryBarcode,
      status_serwisowy: 'Działa',
      aktywny: true,
      opis: 'Egzemplarz utworzony automatycznie podczas przypisywania zawartości case.',
      notatki_wewnetrzne: `${MARKER}: utworzono brakujący egzemplarz po kodzie z Excela i przypisano do case id=${caseExemplar.id}. Źródło=${entry.raw}`,
    },
    include: {
      model: true,
    },
  });
}


async function assignExistingExemplarToCase({ exemplar, caseExemplar, dryRun, reason, barcodeToSet = null }) {
  if (!exemplar || !caseExemplar) return;

  if (exemplar.model?.typ_sprzetu === 'opakowanie') {
    warnings.push({
      typ: 'case',
      wiersz: '',
      opis: `Pominięto próbę przypięcia case do case: egzemplarz ${exemplar.id}`,
    });
    return;
  }

  if (exemplar.id_case && exemplar.id_case !== caseExemplar.id) {
    warnings.push({
      typ: 'sprzet',
      wiersz: '',
      opis: `Egzemplarz ${exemplar.id} był już w case ${exemplar.id_case}; zostanie przepięty do case ${caseExemplar.id}.`,
    });
  }

  reservedExemplarIds.add(exemplar.id);

  if (dryRun) return;

  const note = `${MARKER}: przypisano do case id=${caseExemplar.id}. Powód: ${reason}`;

  const data = {
    id_case: caseExemplar.id,
    notatki_wewnetrzne: appendNote(exemplar.notatki_wewnetrzne, note),
  };

  if (barcodeToSet) {
    data.kod_kreskowy = barcodeToSet;
    data.qr_kod = barcodeToSet;
    data.zewnetrzny_kod_kreskowy = barcodeToSet;
    data.zewnetrzny_qr_kod = barcodeToSet;
  }

  await prisma.egzemplarz.update({
    where: {
      id: exemplar.id,
    },
    data,
  });
}

async function assignQuantityToCase({ orgId, caseExemplar, model, itemName, qty, dryRun }) {
  if (!model) return;

  if (model.typ_sprzetu !== 'ilosciowy') {
    if (!dryRun) {
      await prisma.modelSprzetu.update({
        where: {
          id: model.id,
        },
        data: {
          typ_sprzetu: 'ilosciowy',
        },
      });
    }
  }

  const candidatesRaw = await prisma.egzemplarz.findMany({
    where: {
      id_organizacji: orgId,
      id_modelu: model.id,
      id_case: null,
      data_usuniecia: null,
    },
    include: {
      model: true,
    },
    orderBy: {
      id: 'asc',
    },
    take: Math.max(qty * 5, 20),
  });

  const candidates = candidatesRaw.filter((item) => {
    if (reservedExemplarIds.has(item.id)) return false;

    const nr = String(item.numer_egzemplarza || '');
    const note = String(item.notatki_wewnetrzne || '');

    if (nr.startsWith('ILOŚĆ:')) return false;
    if (note.includes(MARKER)) return false;

    return true;
  });

  const toAssign = candidates.slice(0, qty);

  for (const exemplar of toAssign) {
    await assignExistingExemplarToCase({
      exemplar,
      caseExemplar,
      dryRun,
      reason: `pozycja ilościowa z Excela: ${itemName}, sztuk=${qty}`,
    });
  }

  stats.quantityAssignedPhysical += toAssign.length;

  const missingQty = qty - toAssign.length;

  if (missingQty <= 0) return;

  const existingPseudo = await prisma.egzemplarz.findFirst({
    where: {
      id_organizacji: orgId,
      id_modelu: model.id,
      id_case: dryRun ? undefined : caseExemplar.id,
      numer_egzemplarza: {
        startsWith: 'ILOŚĆ:',
      },
      notatki_wewnetrzne: {
        contains: MARKER,
      },
      data_usuniecia: null,
    },
  });

  const pseudoData = {
    id_organizacji: orgId,
    id_modelu: model.id,
    id_case: caseExemplar.id,
    nazwa: `${model.nazwa} (${missingQty} szt. w case)`,
    numer_egzemplarza: `ILOŚĆ:${missingQty}`,
    status_serwisowy: 'Działa',
    aktywny: true,
    opis: `Pozycja ilościowa w case: ${missingQty} szt.`,
    notatki_wewnetrzne: `${MARKER}: pseudo-pozycja ilościowa dla case id=${caseExemplar.id}; ilość=${missingQty}; źródło=${itemName}`,
  };

  if (existingPseudo) {
    stats.quantityPseudoUpdated += 1;

    if (!dryRun) {
      await prisma.egzemplarz.update({
        where: {
          id: existingPseudo.id,
        },
        data: pseudoData,
      });
    }
  } else {
    stats.quantityPseudoCreated += 1;

    if (!dryRun) {
      await prisma.egzemplarz.create({
        data: pseudoData,
      });
    }
  }
}

function writeCsv(filePath, rows, columns) {
  const lines = [
    columns.join(';'),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column] ?? '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(';')
    ),
  ];

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function saveReports() {
  const reportsDir = path.join(process.cwd(), 'import', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  writeCsv(
    path.join(reportsDir, 'przypisanie-opakowan-errors.csv'),
    errors,
    ['typ', 'wiersz', 'case', 'pozycja', 'opis']
  );

  writeCsv(
    path.join(reportsDir, 'przypisanie-opakowan-warnings.csv'),
    warnings,
    ['typ', 'wiersz', 'opis']
  );

  fs.writeFileSync(
    path.join(reportsDir, 'przypisanie-opakowan-summary.json'),
    JSON.stringify(stats, null, 2),
    'utf8'
  );

  console.log('\nRaporty zapisane w:');
  console.log(path.join(reportsDir, 'przypisanie-opakowan-errors.csv'));
  console.log(path.join(reportsDir, 'przypisanie-opakowan-warnings.csv'));
  console.log(path.join(reportsDir, 'przypisanie-opakowan-summary.json'));
}

async function main() {
  console.log('\n=== EventFlow: przypisanie sprzętu do case z Excela ===\n');

  const organizacja = await wybierzOrganizacje();
  const orgId = organizacja.id;

  const defaultFile = path.join(
    process.cwd(),
    'import',
    'data',
    'opakowania',
    'opakowania_wszystkie_kody_lub_ilosc.xlsx'
  );

  const inputFile = await ask(`Ścieżka do Excela [${defaultFile}]: `);
  const filePath = inputFile || defaultFile;

  if (!fs.existsSync(filePath)) {
    throw new Error(`Nie znaleziono pliku: ${filePath}`);
  }

  const dryAnswer = await ask('Najpierw zrobić test bez zapisu? TAK/NIE [TAK]: ');
  const dryRun = dryAnswer.toUpperCase() !== 'NIE';

  console.log(`\nPlik: ${filePath}`);
  console.log(`Organizacja: ${organizacja.nazwa} / ID ${orgId}`);
  console.log(`Tryb testowy: ${dryRun ? 'TAK' : 'NIE'}\n`);

  const confirm = await ask('Aby kontynuować wpisz: PRZYPISZ\n> ');

  if (confirm !== 'PRZYPISZ') {
    console.log('Przerwano. Nic nie zmieniono.');
    return;
  }

  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellText: true,
  });

  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  console.log(`Arkusz: ${sheetName}`);
  console.log(`Wiersze: ${rows.length}\n`);

  const caseCache = await loadCaseCache(orgId);
  const modelCache = await loadModelCache(orgId);

  console.log(`Case’y w bazie: ${caseCache.cases.length}`);
  console.log(`Modele sprzętu w bazie: ${modelCache.models.length}\n`);

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2;

    stats.rowsProcessed += 1;

    const caseName = clean(getCell(row, ['Nazwa opakowania']));
    const caseCode = clean(getCell(row, ['Kod kreskowy opakowania']));
    const content = clean(getCell(row, ['Zawartość']));

    const caseExemplar = await getOrCreateCase({
      orgId,
      caseCache,
      caseName,
      caseCode,
      dryRun,
    });

    if (!caseExemplar) {
      errors.push({
        typ: 'case',
        wiersz: rowNumber,
        case: caseName || caseCode || '',
        pozycja: '',
        opis: 'Nie udało się znaleźć ani utworzyć case/opakowania.',
      });
      continue;
    }

    if (caseExemplar.id_case) {
      stats.casesUnpackedFromCase += 1;

      if (!dryRun && caseExemplar.id > 0) {
        await prisma.egzemplarz.update({
          where: {
            id: caseExemplar.id,
          },
          data: {
            id_case: null,
          },
        });
      }
    }

    const entries = parseContentLines(content);

    for (const entry of entries) {
      if (entry.type === 'barcode') {
        stats.barcodeLines += 1;

        let exemplar = await findExemplarByBarcode(orgId, entry.barcodeVariants, 'sprzet');
        let assignedByName = false;
        const primaryBarcode = entry.barcodeVariants[0];

        if (!exemplar) {
          exemplar = await findFreeExemplarByName({
            orgId,
            modelCache,
            name: entry.name,
          });

          if (exemplar) {
            assignedByName = true;
          }
        }

        if (!exemplar) {
          exemplar = await createMissingExemplarFromBarcode({
            orgId,
            caseExemplar,
            modelCache,
            entry,
            primaryBarcode,
            dryRun,
          });

          if (!exemplar) {
            stats.barcodeMissing += 1;

            errors.push({
              typ: 'sprzet_kod',
              wiersz: rowNumber,
              case: caseName || caseCode || '',
              pozycja: entry.raw,
              opis: `Nie znaleziono modelu ani egzemplarza dla: ${entry.name}. Kod: ${entry.barcodeVariants.join(', ')}`,
            });

            continue;
          }
        } else {
          await assignExistingExemplarToCase({
            exemplar,
            caseExemplar,
            dryRun,
            reason: assignedByName
              ? `nie było kodu w bazie, znaleziono po nazwie i nadano kod: ${primaryBarcode}`
              : `kod z Excela: ${primaryBarcode}`,
            barcodeToSet: assignedByName ? primaryBarcode : null,
          });

          if (assignedByName) {
            stats.barcodeAssignedByNameAndCodeAdded += 1;
          } else {
            stats.barcodeAssigned += 1;
          }
        }
      }

      if (entry.type === 'quantity') {
        stats.quantityLines += 1;

        const model = findBestModel(modelCache, entry.name);

        if (!model) {
          stats.quantityModelMissing += 1;

          errors.push({
            typ: 'sprzet_ilosciowy',
            wiersz: rowNumber,
            case: caseName || caseCode || '',
            pozycja: entry.raw,
            opis: `Nie znaleziono modelu po nazwie: ${entry.name}`,
          });

          continue;
        }

        await assignQuantityToCase({
          orgId,
          caseExemplar,
          model,
          itemName: entry.name,
          qty: entry.qty,
          dryRun,
        });
      }
    }

    if ((index + 1) % 25 === 0) {
      console.log(`Przetworzono ${index + 1}/${rows.length} wierszy...`);
    }
  }

  saveReports();

  console.log('\n=== Podsumowanie ===\n');
  console.table(stats);

  if (dryRun) {
    console.log('\nTo był DRY RUN — nie zapisano zmian do bazy.');
    console.log('Uruchom skrypt jeszcze raz i wpisz NIE przy pytaniu o test, żeby zapisać zmiany.');
  } else {
    console.log('\n✅ Przypisanie sprzętu do case zakończone.');
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Błąd:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
