#!/usr/bin/env node
/**
 * NEW -> EVE-NT | LOCAL TEST IMPORT
 *
 * Cel:
 * - wyczyścić magazyn, ALE zachować kategorie;
 * - wyczyścić wydarzenia, ALE zachować typy/statusy;
 * - NIE ruszać istniejących ról użytkowników;
 * - zaimportować sprzęt, użytkowników i wydarzenia z XLSX NEW;
 * - wszystkim importowanym użytkownikom ustawić hasło: zaq1@WSX;
 * - NIE tworzyć żadnej nowej roli/uprawnienia dla importowanych użytkowników.
 *
 * Uruchamiaj z apps/api:
 *   node scripts/import-new-test-local.mjs --data-dir ./import/new
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'zaq1@WSX';

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const opts = {
  dataDir: path.resolve(String(arg('data-dir', './import/new'))),
  orgId: arg('org-id') ? Number(arg('org-id')) : null,
  password: String(arg('password', DEFAULT_PASSWORD)),
  allowNonlocal: Boolean(arg('allow-nonlocal', false)),
  skipGear: Boolean(arg('skip-gear', false)),
  skipUsers: Boolean(arg('skip-users', false)),
  skipEvents: Boolean(arg('skip-events', false)),
  noReset: Boolean(arg('no-reset', false)),
};

function norm(v) {
  return String(v ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function text(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function nullableText(v) {
  const s = text(v);
  return s ? s : null;
}

function bool(v, fallback = true) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = norm(v);
  if (!s) return fallback;
  if (['1', 'true', 'tak', 'yes', 'aktywny'].includes(s)) return true;
  if (['0', 'false', 'nie', 'no', 'nieaktywny'].includes(s)) return false;
  return fallback;
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

function dateOrNull(v) {
  if (!v) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v;
  }

  // Excel serial
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const d = new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0)),
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  let s = String(v).trim();
  if (!s) return null;

  // dd.mm.yyyy [hh:mm]
  let m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // yyyy-mm-dd [hh:mm]
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, yyyy, mm, dd, hh = '0', mi = '0', ss = '0'] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function digits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function findFileRecursive(root, preferredNames) {
  if (!fs.existsSync(root)) return null;

  const wanted = new Set(preferredNames.map((x) => x.toLowerCase()));
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '.git', '.venv'].includes(e.name)) stack.push(full);
      } else if (wanted.has(e.name.toLowerCase())) {
        return full;
      }
    }
  }
  return null;
}

function readWorkbook(file) {
  if (!file) throw new Error('Brak ścieżki XLSX.');
  if (!fs.existsSync(file)) throw new Error(`Plik nie istnieje: ${file}`);
  return XLSX.readFile(file, { cellDates: true, raw: false });
}

function rows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
}

function firstExistingSheet(wb, names) {
  for (const n of names) {
    if (wb.Sheets[n]) return n;
  }
  return null;
}

function banner(t) {
  console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);
}

function printCounter(label, done, all) {
  console.log(`  [${String(done).padStart(String(all).length, ' ')}/${all}] ${label}`);
}

function localDatabaseGuard() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) {
    throw new Error('Brak DATABASE_URL. Uruchom z katalogu apps/api z poprawnym .env.');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL nie jest poprawnym URL.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'wms_postgres']);
  const isLocal = localHosts.has(url.hostname);

  console.log(`DATABASE_URL host: ${url.hostname}`);
  console.log(`DATABASE: ${url.pathname.replace(/^\//, '')}`);

  if (!isLocal && !opts.allowNonlocal) {
    throw new Error(
      `ODMOWA: baza nie wygląda na lokalną (${url.hostname}). ` +
      `Jeśli WIESZ co robisz, użyj --allow-nonlocal.`,
    );
  }
}

async function resolveOrganization() {
  const orgs = await prisma.organizacja.findMany({
    where: { data_usuniecia: null },
    orderBy: { id: 'asc' },
  });

  if (!orgs.length) throw new Error('Brak organizacji w bazie.');

  if (opts.orgId) {
    const found = orgs.find((o) => o.id === opts.orgId);
    if (!found) throw new Error(`Nie ma organizacji id=${opts.orgId}.`);
    return found;
  }

  if (orgs.length === 1) return orgs[0];

  console.log('Organizacje w bazie:');
  for (const o of orgs) console.log(`  ${o.id}: ${o.nazwa} [${o.subdomena}]`);
  throw new Error('Jest więcej niż jedna organizacja. Podaj --org-id N.');
}

async function preflight() {
  localDatabaseGuard();

  const org = await resolveOrganization();

  console.log(`Organizacja docelowa: ${org.id} — ${org.nazwa}`);

  const counts = {
    kategorie: await prisma.kategoria.count({ where: { id_organizacji: org.id } }),
    modele: await prisma.modelSprzetu.count({ where: { id_organizacji: org.id } }),
    egzemplarze: await prisma.egzemplarz.count({ where: { id_organizacji: org.id } }),
    wydarzenia: await prisma.wydarzenie.count({ where: { id_organizacji: org.id } }),
    users: await prisma.uzytkownik.count({ where: { id_organizacji: org.id } }),
    userRoles: await prisma.uzytkownikRola.count({ where: { id_organizacji: org.id } }),
    typyWydarzen: await prisma.typWydarzenia.count({ where: { id_organizacji: org.id } }),
    statusyWydarzen: await prisma.statusWydarzenia.count({ where: { id_organizacji: org.id } }),
  };

  console.log('Stan przed importem:', counts);

  return { org, counts };
}

async function resetLocalData(orgId) {
  banner('RESET DANYCH TESTOWYCH');

  // Ten importer jest przeznaczony do lokalnej testowej bazy.
  // TRUNCATE ... CASCADE jest świadomy: czyści pełne zależności wydarzeń/magazynu,
  // ale NIE czyści tabel konfiguracji: kategorie, typy_wydarzen, statusy_wydarzen.
  console.log('1/3 Czyszczę wydarzenia i wszystkie tabele zależne...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "wydarzenia" RESTART IDENTITY CASCADE');

  console.log('2/3 Czyszczę modele + magazyny i wszystkie zależności...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "modele", "magazyny" RESTART IDENTITY CASCADE');

  console.log('3/3 Role/uprawnienia użytkowników: pozostawiam bez zmian.');

  console.log('RESET OK. Kategorie / typy wydarzeń / statusy wydarzeń / role użytkowników pozostawione.');
}

async function databaseUserColumns() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'uzytkownicy'
  `);
  return new Set(result.map((r) => String(r.column_name)));
}

async function importUsers(orgId, file) {
  banner('IMPORT UŻYTKOWNIKÓW');

  const wb = readWorkbook(file);
  const sheet = firstExistingSheet(wb, ['Uzytkownicy', '01_Uzytkownicy']);
  if (!sheet) throw new Error(`Brak arkusza Uzytkownicy w ${file}`);

  const list = rows(wb, sheet);
  const dbColumns = await databaseUserColumns();

  console.log(`Plik: ${file}`);
  console.log(`Arkusz: ${sheet}`);
  console.log(`Wierszy: ${list.length}`);
  console.log(`Hasło wszystkich importowanych userów: ${opts.password}`);
  console.log('Role: importer nie tworzy żadnego UzytkownikRola i nie usuwa istniejących.');

  const extraCandidates = [
    'data_urodzenia',
    'pesel',
    'nr_dokumentu',
    'miejscowosc',
    'kod_pocztowy',
    'ulica',
    'nr_domu',
    'nr_lokalu',
    'kraj',
    'stanowisko',
    'login_new',
    'plec',
    'nip',
    'nr_konta_iban',
  ];

  const unsupported = {};
  const imported = [];
  let ok = 0;
  let skipped = 0;

  for (let i = 0; i < list.length; i++) {
    const r = list[i];

    const email = text(r.email).toLowerCase();
    const imie = text(r.imie);
    const nazwisko = text(r.nazwisko);

    if (!email || !imie || !nazwisko) {
      console.warn(`  SKIP user row ${i + 2}: brak imienia/nazwiska/email`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(opts.password, 10);

    const dataLastLogin = dateOrNull(r.data_ostatniego_logowania);

    const user = await prisma.uzytkownik.upsert({
      where: {
        id_organizacji_email: {
          id_organizacji: orgId,
          email,
        },
      },
      update: {
        imie,
        nazwisko,
        telefon: nullableText(r.telefon),
        haslo: passwordHash,
        avatar: nullableText(r.avatar),
        aktywny: bool(r.aktywny, true),
        data_ostatniego_logowania: dataLastLogin,
        data_usuniecia: null,
      },
      create: {
        id_organizacji: orgId,
        imie,
        nazwisko,
        email,
        telefon: nullableText(r.telefon),
        haslo: passwordHash,
        avatar: nullableText(r.avatar),
        aktywny: bool(r.aktywny, true),
        data_ostatniego_logowania: dataLastLogin,
      },
    });

    // Jeśli lokalna baza ma już dodane pola profilu, importuj je automatycznie.
    // Jeśli nie ma - zapisz je do raportu, żeby niczego nie zgubić.
    const extrasToUpdate = {};
    for (const field of extraCandidates) {
      const value = r[field];
      if (value === '' || value === null || value === undefined) continue;

      if (dbColumns.has(field)) {
        extrasToUpdate[field] = value;
      } else {
        unsupported[field] ??= [];
        unsupported[field].push({
          user_id: user.id,
          email,
          value,
        });
      }
    }

    // data_urodzenia, jeśli kolumna istnieje, zapisujemy jako DATE.
    if (extrasToUpdate.data_urodzenia) {
      const d = dateOrNull(extrasToUpdate.data_urodzenia);
      if (d) extrasToUpdate.data_urodzenia = d;
      else delete extrasToUpdate.data_urodzenia;
    }

    if (Object.keys(extrasToUpdate).length) {
      const sets = [];
      const values = [];
      let p = 1;

      for (const [col, value] of Object.entries(extrasToUpdate)) {
        // nazwa kolumny pochodzi wyłącznie z whitelisted extraCandidates + introspekcji.
        sets.push(`"${col}" = $${p++}`);
        values.push(value);
      }
      values.push(user.id);

      await prisma.$executeRawUnsafe(
        `UPDATE "uzytkownicy" SET ${sets.join(', ')} WHERE "id" = $${p}`,
        ...values,
      );
    }

    imported.push({ id: user.id, email, imie, nazwisko });
    ok++;
    printCounter(`${email}`, i + 1, list.length);
  }

  // Importer celowo NIE tworzy i NIE usuwa żadnych wpisów w uzytkownicy_role.
  // Istniejące role w lokalnej bazie pozostają bez zmian.
  const report = {
    file,
    imported: ok,
    skipped,
    password: opts.password,
    user_roles_created_by_importer: 0,
    existing_user_roles_preserved: true,
    unsupported_profile_fields_not_in_current_db: unsupported,
    users: imported,
  };

  fs.writeFileSync(
    path.join(opts.dataDir, 'IMPORT_USERS_REPORT.json'),
    JSON.stringify(report, null, 2),
  );

  console.log(`Użytkownicy OK: ${ok}; pominięci: ${skipped}; nowe role utworzone przez importer: 0.`);
}

function buildExportCategoryPaths(catRows) {
  const byKey = new Map();
  for (const r of catRows) {
    const key = text(r.__import_key);
    if (!key) continue;
    byKey.set(key, {
      key,
      name: text(r.nazwa),
      parentKey: text(r.__id_rodzica_import_key),
    });
  }

  function pathFor(key, stack = new Set()) {
    if (!key || !byKey.has(key)) return [];
    if (stack.has(key)) return [byKey.get(key).name];
    stack.add(key);
    const c = byKey.get(key);
    return [...pathFor(c.parentKey, stack), c.name].filter(Boolean);
  }

  const out = new Map();
  for (const key of byKey.keys()) out.set(key, pathFor(key));
  return out;
}

function buildDbCategoryPaths(dbCats) {
  const byId = new Map(dbCats.map((c) => [c.id, c]));

  function pathFor(id, stack = new Set()) {
    if (!id || !byId.has(id)) return [];
    if (stack.has(id)) return [byId.get(id).nazwa];
    stack.add(id);
    const c = byId.get(id);
    return [...pathFor(c.id_rodzica, stack), c.nazwa].filter(Boolean);
  }

  const out = new Map();
  for (const c of dbCats) out.set(c.id, pathFor(c.id));
  return out;
}

async function importGear(orgId, file) {
  banner('IMPORT MAGAZYNU / SPRZĘTU');

  const wb = readWorkbook(file);
  const catRows = rows(wb, '01_Kategorie');
  const magRows = rows(wb, '02_Magazyny');
  const modelRows = rows(wb, '03_Modele');
  const itemRows = rows(wb, '04_Egzemplarze');
  const relationRows = rows(wb, '05_Relacje_Case');

  if (!modelRows.length) {
    throw new Error(`Brak danych 03_Modele w ${file}`);
  }

  console.log(`Kategorie z XLSX: ${catRows.length} (NIE będą tworzone)`);
  console.log(`Magazyny: ${magRows.length}`);
  console.log(`Modele: ${modelRows.length}`);
  console.log(`Egzemplarze: ${itemRows.length}`);
  console.log(`Relacje CASE: ${relationRows.length}`);

  // KATEGORIE: zachowujemy DB, tylko mapujemy eksport -> istniejące ID.
  const dbCats = await prisma.kategoria.findMany({
    where: {
      id_organizacji: orgId,
      data_usuniecia: null,
    },
    orderBy: { id: 'asc' },
  });

  const exportPaths = buildExportCategoryPaths(catRows);
  const dbPaths = buildDbCategoryPaths(dbCats);

  const dbPathMap = new Map();
  const dbNameMap = new Map();

  for (const c of dbCats) {
    const p = norm((dbPaths.get(c.id) || []).join(' > '));
    if (p) dbPathMap.set(p, c.id);

    const n = norm(c.nazwa);
    if (!dbNameMap.has(n)) dbNameMap.set(n, []);
    dbNameMap.get(n).push(c.id);
  }

  const categoryMap = new Map();
  const categoryWarnings = [];

  for (const [key, parts] of exportPaths.entries()) {
    const exactPath = norm(parts.join(' > '));
    let id = dbPathMap.get(exactPath);

    if (!id) {
      const last = norm(parts.at(-1));
      const candidates = dbNameMap.get(last) || [];
      if (candidates.length === 1) id = candidates[0];
    }

    if (id) categoryMap.set(key, id);
    else categoryWarnings.push({ import_key: key, path: parts.join(' > ') });
  }

  // MAGAZYNY
  const warehouseMap = new Map();

  for (let i = 0; i < magRows.length; i++) {
    const r = magRows[i];
    const name = text(r.nazwa);
    const key = text(r.__import_key);
    if (!name || !key) continue;

    const w = await prisma.magazyn.upsert({
      where: {
        id_organizacji_nazwa: {
          id_organizacji: orgId,
          nazwa: name,
        },
      },
      update: {
        opis: nullableText(r.opis),
        aktywny: bool(r.aktywny, true),
        data_usuniecia: null,
      },
      create: {
        id_organizacji: orgId,
        nazwa: name,
        opis: nullableText(r.opis),
        aktywny: bool(r.aktywny, true),
      },
    });
    warehouseMap.set(key, w.id);
  }

  // MODELE
  const modelMap = new Map();
  const modelNameIndex = new Map();
  const modelBarcodeIndex = new Map();

  for (let i = 0; i < modelRows.length; i++) {
    const r = modelRows[i];
    const key = text(r.__import_key);
    const name = text(r.nazwa);
    if (!key || !name) continue;

    const catKey = text(r.__id_kategorii_import_key);
    const idCategory = categoryMap.get(catKey) ?? null;

    if (catKey && !idCategory) {
      console.warn(`  UWAGA model bez dopasowanej kategorii: ${name} [${catKey}]`);
    }

    const model = await prisma.modelSprzetu.create({
      data: {
        id_organizacji: orgId,
        id_kategorii: idCategory,
        nazwa: name,
        producent: nullableText(r.producent),
        miejsce_w_mag: nullableText(r.miejsce_w_mag),
        opis: nullableText(r.opis),
        notatki_wewnetrzne: nullableText(r.notatki_wewnetrzne),
        widoczny_w_ofercie: bool(r.widoczny_w_ofercie, true),
        widoczny_w_mag: bool(r.widoczny_w_mag, true),
        szerokosc: num(r.szerokosc),
        wysokosc: num(r.wysokosc),
        glebokosc: num(r.glebokosc),
        objetosc: num(r.objetosc),
        waga: num(r.waga),
        wartosc: num(r.wartosc),
        wartosc_domyslna_egzemplarza: num(r.wartosc_domyslna_egzemplarza),
        zdjecie: nullableText(r.zdjecie),
        aktywny: bool(r.aktywny, true),
        typ_sprzetu: text(r.typ_sprzetu) || 'sprzet',
        tryb_ewidencji: text(r.tryb_ewidencji) || 'egzemplarze',
        ilosc_magazynowa: num(r.ilosc_magazynowa) ?? 0,
        jednostka: text(r.jednostka) || 'szt.',
        ulubiony: bool(r.ulubiony, false),
        udostepniony_crn: bool(r.udostepniony_crn, false),
        kod_kreskowy: nullableText(r.kod_kreskowy),
        pobor_pradu: num(r.pobor_pradu),
      },
    });

    modelMap.set(key, model.id);
    modelNameIndex.set(norm(name), model.id);

    const bc = text(r.kod_kreskowy);
    if (bc) modelBarcodeIndex.set(bc, model.id);

    if ((i + 1) % 25 === 0 || i + 1 === modelRows.length) {
      console.log(`  modele: ${i + 1}/${modelRows.length}`);
    }
  }

  // EGZEMPLARZE bez id_case
  const itemMap = new Map();

  for (let i = 0; i < itemRows.length; i++) {
    const r = itemRows[i];
    const key = text(r.__import_key);
    const modelKey = text(r.__id_modelu_import_key);
    if (!key || !modelKey) continue;

    const modelId = modelMap.get(modelKey);
    if (!modelId) {
      console.warn(`  SKIP egzemplarz ${key}: brak modelu ${modelKey}`);
      continue;
    }

    const warehouseId = warehouseMap.get(text(r.__id_magazynu_import_key)) ?? null;

    const item = await prisma.egzemplarz.create({
      data: {
        id_organizacji: orgId,
        id_modelu: modelId,
        id_magazynu: warehouseId,
        nazwa: nullableText(r.nazwa),
        sn: nullableText(r.sn),
        qr_kod: nullableText(r.qr_kod),
        kod_kreskowy: nullableText(r.kod_kreskowy),
        miejsce_w_mag: nullableText(r.miejsce_w_mag),
        id_case: null,
        id_statusu_egzemplarza: intOrNull(r.id_statusu_egzemplarza),
        szerokosc: num(r.szerokosc),
        wysokosc: num(r.wysokosc),
        glebokosc: num(r.glebokosc),
        objetosc: num(r.objetosc),
        waga: num(r.waga),
        wartosc: num(r.wartosc),
        notatki_wewnetrzne: nullableText(r.notatki_wewnetrzne),
        zdjecie: nullableText(r.zdjecie),
        aktywny: bool(r.aktywny, true),
        numer_urzadzenia: nullableText(r.numer_urzadzenia),
        numer_egzemplarza: nullableText(r.numer_egzemplarza),
        zewnetrzny_kod_kreskowy: nullableText(r.zewnetrzny_kod_kreskowy),
        zewnetrzny_qr_kod: nullableText(r.zewnetrzny_qr_kod),
        rozroznij_kod_qr: bool(r.rozroznij_kod_qr, false),
        data_produkcji: dateOrNull(r.data_produkcji),
        cena_zakupu: num(r.cena_zakupu),
        pakowany_pojedynczo: bool(r.pakowany_pojedynczo, false),
        opis: nullableText(r.opis),
        status_serwisowy: text(r.status_serwisowy) || 'Działa',
      },
    });

    itemMap.set(key, item.id);

    if ((i + 1) % 50 === 0 || i + 1 === itemRows.length) {
      console.log(`  egzemplarze: ${i + 1}/${itemRows.length}`);
    }
  }

  // RELACJE CASE: najpierw techniczne __id_case_import_key z arkusza egzemplarzy...
  let caseLinked = 0;
  const casePairs = new Map();

  for (const r of itemRows) {
    const itemKey = text(r.__import_key);
    const caseKey = text(r.__id_case_import_key);
    if (itemKey && caseKey) casePairs.set(itemKey, caseKey);
  }

  // ...potem dokładamy relacje z 05_Relacje_Case, ale tylko dopasowane.
  for (const r of relationRows) {
    const status = norm(r.status);
    const itemKey = text(r.egzemplarz_import_key);
    const caseKey = text(r.case_import_key);
    if (!itemKey || !caseKey) continue;
    if (status && !status.includes('dopasow')) continue;
    casePairs.set(itemKey, caseKey);
  }

  for (const [itemKey, caseKey] of casePairs.entries()) {
    const itemId = itemMap.get(itemKey);
    const caseId = itemMap.get(caseKey);
    if (!itemId || !caseId || itemId === caseId) continue;

    await prisma.egzemplarz.update({
      where: { id: itemId },
      data: { id_case: caseId },
    });
    caseLinked++;
  }

  const report = {
    file,
    existing_categories_preserved: dbCats.length,
    category_mappings: categoryMap.size,
    category_unmatched: categoryWarnings,
    warehouses: warehouseMap.size,
    models: modelMap.size,
    items: itemMap.size,
    case_relations: caseLinked,
  };

  fs.writeFileSync(
    path.join(opts.dataDir, 'IMPORT_GEAR_REPORT.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('MAGAZYN OK:', report);

  return { modelMap, modelNameIndex, modelBarcodeIndex };
}

async function nameMaps(orgId) {
  const [types, statuses, accounting, stages, users, contractors] = await Promise.all([
    prisma.typWydarzenia.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
    prisma.statusWydarzenia.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
    prisma.statusKsiegowy.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
    prisma.typEtapu.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
    prisma.uzytkownik.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
    prisma.kontrahent.findMany({ where: { id_organizacji: orgId, data_usuniecia: null } }),
  ]);

  const mapUnique = (arr, fn) => {
    const m = new Map();
    for (const x of arr) {
      const k = norm(fn(x));
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };

  return {
    types: mapUnique(types, (x) => x.nazwa),
    statuses: mapUnique(statuses, (x) => x.nazwa),
    accounting: mapUnique(accounting, (x) => x.nazwa),
    stages: mapUnique(stages, (x) => x.nazwa),
    users: mapUnique(users, (x) => `${x.imie} ${x.nazwisko}`),
    contractorsByName: mapUnique(contractors, (x) => x.nazwa),
    contractorsByNip: new Map(contractors.filter((x) => x.nip).map((x) => [digits(x.nip), x])),
  };
}

function one(map, value) {
  const k = norm(value);
  const a = map.get(k) || [];
  return a.length === 1 ? a[0] : null;
}

async function resolveContractor(orgId, maps, name, nip) {
  const normalizedNip = digits(nip);
  if (normalizedNip && maps.contractorsByNip.has(normalizedNip)) {
    return maps.contractorsByNip.get(normalizedNip);
  }

  const existing = one(maps.contractorsByName, name);
  if (existing) return existing;

  const n = text(name);
  if (!n) return null;

  const created = await prisma.kontrahent.create({
    data: {
      id_organizacji: orgId,
      nazwa: n,
      nip: normalizedNip.length === 10 ? normalizedNip : null,
      aktywny: true,
      czy_klient: true,
      czy_dostawca: false,
      zrodlo_danych: 'import_new',
    },
  });

  maps.contractorsByName.set(norm(n), [created]);
  if (created.nip) maps.contractorsByNip.set(created.nip, created);

  return created;
}

async function importEvents(orgId, file, gearIndexes = null) {
  banner('IMPORT WYDARZEŃ');

  const wb = readWorkbook(file);
  const main = rows(wb, 'Wydarzenia');
  const details = rows(wb, 'Szczegoly');
  const schedule = rows(wb, 'Harmonogram');
  const gear = rows(wb, 'Sprzet');

  if (!main.length) throw new Error(`Brak danych Wydarzenia w ${file}`);

  console.log(`Wydarzenia: ${main.length}`);
  console.log(`Szczegóły: ${details.length}`);
  console.log(`Harmonogram: ${schedule.length}`);
  console.log(`Sprzęt wydarzeń: ${gear.length}`);

  const maps = await nameMaps(orgId);

  // Jeśli importer gear był pominięty, zbuduj indeks z aktualnej bazy.
  let modelNameIndex = gearIndexes?.modelNameIndex || new Map();
  let modelBarcodeIndex = gearIndexes?.modelBarcodeIndex || new Map();

  if (!gearIndexes) {
    const models = await prisma.modelSprzetu.findMany({
      where: { id_organizacji: orgId, data_usuniecia: null },
    });
    for (const m of models) {
      modelNameIndex.set(norm(m.nazwa), m.id);
      if (m.kod_kreskowy) modelBarcodeIndex.set(String(m.kod_kreskowy), m.id);
    }
  }

  const detailByNewId = new Map();
  for (const r of details) {
    const id = text(r['ID NEW']);
    if (id && !detailByNewId.has(id)) detailByNewId.set(id, r);
  }

  const eventMap = new Map();
  const unmatched = {
    types: new Set(),
    statuses: new Set(),
    accounting: new Set(),
    managers: new Set(),
    models: new Set(),
    stages: new Set(),
  };

  for (let i = 0; i < main.length; i++) {
    const r = main[i];
    const newId = text(r['ID NEW']);
    const name = text(r['Wydarzenie']);
    if (!newId || !name) continue;

    const type = one(maps.types, r['Typ']);
    const status = one(maps.statuses, r['Status']);
    const accounting = one(maps.accounting, r['Księgowe']);
    const manager = one(maps.users, r['EventManager']);
    const contractor = await resolveContractor(
      orgId,
      maps,
      r['Klient'],
      r['NIP klienta'],
    );

    if (text(r['Typ']) && !type) unmatched.types.add(text(r['Typ']));
    if (text(r['Status']) && !status) unmatched.statuses.add(text(r['Status']));
    if (text(r['Księgowe']) && !accounting) unmatched.accounting.add(text(r['Księgowe']));
    if (text(r['EventManager']) && !manager) unmatched.managers.add(text(r['EventManager']));

    const d = detailByNewId.get(newId) || {};

    const event = await prisma.wydarzenie.create({
      data: {
        id_organizacji: orgId,
        id_typu_wydarzenia: type?.id ?? null,
        id_statusu_wydarzenia: status?.id ?? null,
        id_kontrahenta: contractor?.id ?? null,
        id_managera: manager?.id ?? null,
        id_statusu_ksiegowego: accounting?.id ?? null,
        nazwa: name,
        numer: nullableText(r['Kod wydarzenia']),
        opis: nullableText(d['Opis']),
        uwagi: nullableText(d['Szczegóły']),
        data_start: dateOrNull(r['Od']),
        data_koniec: dateOrNull(r['Do']),
        miejsce_reczne: nullableText(r['Miejsce']),
        aktywny: true,
      },
    });

    eventMap.set(newId, event.id);

    printCounter(`${newId} ${name}`, i + 1, main.length);
  }

  // Harmonogram
  let scheduleCreated = 0;
  for (const r of schedule) {
    const eventId = eventMap.get(text(r['ID NEW']));
    if (!eventId) continue;

    const name = text(r['Etap']) || 'Etap';
    const start = dateOrNull(r['Od']);
    const end = dateOrNull(r['Do']);
    if (!start || !end) continue;

    const type = one(maps.stages, name);
    if (name && !type) unmatched.stages.add(name);

    await prisma.etapWydarzenia.create({
      data: {
        id_organizacji: orgId,
        id_wydarzenia: eventId,
        id_typu_etapu: type?.id ?? null,
        nazwa: name,
        data_start: start,
        data_koniec: end,
        aktywny: true,
      },
    });
    scheduleCreated++;
  }

  // Plan sprzętu
  let gearCreated = 0;
  const seenEventModel = new Set();

  for (const r of gear) {
    const eventId = eventMap.get(text(r['ID NEW']));
    if (!eventId) continue;

    let modelId = null;
    const barcode = text(r['Kod kreskowy modelu']);
    if (barcode) modelId = modelBarcodeIndex.get(barcode) ?? null;
    if (!modelId) modelId = modelNameIndex.get(norm(r['Sprzęt'])) ?? null;

    if (!modelId) {
      if (text(r['Sprzęt'])) unmatched.models.add(text(r['Sprzęt']));
      continue;
    }

    const unique = `${eventId}:${modelId}`;
    if (seenEventModel.has(unique)) continue;
    seenEventModel.add(unique);

    await prisma.pozycjaSprzetuWydarzenia.create({
      data: {
        id_organizacji: orgId,
        id_wydarzenia: eventId,
        id_modelu: modelId,
        ilosc_planowana: num(r['Ilość']) ?? 1,
        aktywny: true,
      },
    });
    gearCreated++;
  }

  const report = {
    file,
    events: eventMap.size,
    schedule: scheduleCreated,
    event_gear: gearCreated,
    unmatched: Object.fromEntries(
      Object.entries(unmatched).map(([k, set]) => [k, [...set]]),
    ),
    not_imported_in_this_test_pass: [
      'PDF ofert',
      'rekordy ofert do tabel Oferta/WersjaOferty',
      'załączniki wydarzeń',
      'ekipa z surowego arkusza Ekipa',
      'flota z surowego arkusza Flota',
      'sprzęt zewnętrzny',
    ],
  };

  fs.writeFileSync(
    path.join(opts.dataDir, 'IMPORT_EVENTS_REPORT.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('WYDARZENIA OK:', report);
}

async function finalCheck(orgId) {
  banner('KONTROLA PO IMPORCIE');

  const counts = {
    kategorie: await prisma.kategoria.count({ where: { id_organizacji: orgId } }),
    magazyny: await prisma.magazyn.count({ where: { id_organizacji: orgId } }),
    modele: await prisma.modelSprzetu.count({ where: { id_organizacji: orgId } }),
    egzemplarze: await prisma.egzemplarz.count({ where: { id_organizacji: orgId } }),
    wydarzenia: await prisma.wydarzenie.count({ where: { id_organizacji: orgId } }),
    etapy: await prisma.etapWydarzenia.count({ where: { id_organizacji: orgId } }),
    sprzetWydarzen: await prisma.pozycjaSprzetuWydarzenia.count({ where: { id_organizacji: orgId } }),
    users: await prisma.uzytkownik.count({ where: { id_organizacji: orgId } }),
    userRoles: await prisma.uzytkownikRola.count({ where: { id_organizacji: orgId } }),
    typyWydarzen: await prisma.typWydarzenia.count({ where: { id_organizacji: orgId } }),
    statusyWydarzen: await prisma.statusWydarzenia.count({ where: { id_organizacji: orgId } }),
  };

  console.table(counts);

  console.log(`Istniejące wpisy uzytkownicy_role pozostawione: ${counts.userRoles}`);

  return counts;
}

async function main() {
  banner('NEW -> EVE-NT | LOCAL TEST IMPORT');

  console.log(`Data dir: ${opts.dataDir}`);
  console.log(`Password: ${opts.password}`);
  console.log(`skipGear=${opts.skipGear}, skipUsers=${opts.skipUsers}, skipEvents=${opts.skipEvents}`);
  console.log(`noReset=${opts.noReset}`);

  if (!fs.existsSync(opts.dataDir)) {
    throw new Error(`Katalog danych nie istnieje: ${opts.dataDir}`);
  }

  const usersFile = findFileRecursive(opts.dataDir, [
    'NEW_uzytkownicy.xlsx',
    'NEW_uzytkownicy_do_EVE_NT.xlsx',
  ]);

  const gearFile = findFileRecursive(opts.dataDir, [
    'NEW_sprzet_do_EVE_NT_PRISMA.xlsx',
  ]);

  const eventsFile = findFileRecursive(opts.dataDir, [
    'NEW_wydarzenia.xlsx',
  ]);

  console.log('Wykryte pliki:');
  console.log(`  users:  ${usersFile || '(brak)'}`);
  console.log(`  gear:   ${gearFile || '(brak)'}`);
  console.log(`  events: ${eventsFile || '(brak)'}`);

  if (!opts.skipUsers && !usersFile) throw new Error('Brak NEW_uzytkownicy.xlsx');
  if (!opts.skipGear && !gearFile) throw new Error('Brak NEW_sprzet_do_EVE_NT_PRISMA.xlsx');
  if (!opts.skipEvents && !eventsFile) throw new Error('Brak NEW_wydarzenia.xlsx');

  const { org, counts: before } = await preflight();

  if (!opts.noReset) {
    await resetLocalData(org.id);
  } else {
    console.log('UWAGA: --no-reset, pomijam czyszczenie danych.');
  }

  let gearIndexes = null;

  // Userów importujemy przed eventami, aby EventManager mógł się poprawnie mapować.
  if (!opts.skipUsers) {
    await importUsers(org.id, usersFile);
  }

  if (!opts.skipGear) {
    gearIndexes = await importGear(org.id, gearFile);
  }

  if (!opts.skipEvents) {
    await importEvents(org.id, eventsFile, gearIndexes);
  }

  const after = await finalCheck(org.id);

  fs.writeFileSync(
    path.join(opts.dataDir, 'IMPORT_SUMMARY.json'),
    JSON.stringify({
      started_from_counts: before,
      finished_counts: after,
      organization: { id: org.id, name: org.nazwa },
      password_for_imported_users: opts.password,
      user_roles_after_import: after.userRoles,
      user_roles_created_by_importer: 0,
      existing_user_roles_preserved: true,
      completed_at: new Date().toISOString(),
    }, null, 2),
  );

  banner('IMPORT ZAKOŃCZONY');
  console.log(`Wszyscy importowani użytkownicy: hasło ${opts.password}`);
  console.log('Importer nie utworzył żadnych nowych przypisań ról. Istniejące role pozostawiono bez zmian.');
  console.log(`Raporty: ${opts.dataDir}`);
}

main()
  .catch((e) => {
    console.error('\nIMPORT PRZERWANY:');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
