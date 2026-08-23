#!/usr/bin/env node
/**
 * EVE-NT — SCALANIE MODELI OPAKOWAŃ / ZESTAWÓW PO IMPORCIE Z NEW
 *
 * Problem po imporcie:
 *   10 x LedBar TRIBAR 400 IR (zestaw 1) -> Model A -> 1 egzemplarz
 *   10 x LedBar TRIBAR 400 IR (zestaw 2) -> Model B -> 1 egzemplarz
 *   ...
 *
 * Wynik:
 *   Model: 10 x LedBar TRIBAR 400 IR
 *      Egzemplarz 1
 *      Egzemplarz 2
 *      ...
 *
 * Obsługuje m.in.:
 *   2 x LAPTOP ... (zestaw 1)
 *   2 x LAPTOP ... (zestaw 15)
 *   [1] 4x Zestaw słuchawkowy Intercom Vokkero
 *   [2] 4x Zestaw słuchawkowy Intercom Vokkero
 *
 * WAŻNE:
 * - zachowuje ID Egzemplarz;
 * - dzięki temu zawartość CASE przez Egzemplarz.id_case pozostaje poprawna;
 * - nie usuwa fizycznych opakowań;
 * - usuwa dopiero zbędne MODELE po przepięciu ich egzemplarzy;
 * - domyślnie jest DRY-RUN;
 * - zmiany dopiero z --apply.
 *
 * Uruchamiaj z apps/api:
 *
 *   node scripts/merge-new-package-models.mjs --org 1
 *
 * następnie:
 *
 *   node scripts/merge-new-package-models.mjs --org 1 --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const opts = {
  orgId: arg('org') ? Number(arg('org')) : (arg('org-id') ? Number(arg('org-id')) : null),
  apply: Boolean(arg('apply', false)),
  allowNonlocal: Boolean(arg('allow-nonlocal', false)),
  includeSingletons: Boolean(arg('include-singletons', false)),
  reportDir: path.resolve(String(arg('report-dir', './import/new/package-merge'))),
};

function text(v) {
  return String(v ?? '').trim();
}

function norm(v) {
  return text(v)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function csvCell(v) {
  const s = String(v ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, rows) {
  const headers = [
    'status',
    'base_name',
    'survivor_model_id',
    'old_model_id',
    'old_model_name',
    'extracted_number',
    'marker',
    'item_id',
    'old_item_number',
    'new_item_number',
    'old_item_name',
    'new_item_name',
    'note',
  ];

  const lines = [
    headers.join(';'),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(';')),
  ];

  fs.writeFileSync(file, '\ufeff' + lines.join('\n'), 'utf8');
}

function cleanImportedGarbage(name) {
  let s = text(name);

  // Legacy prefix znany z NEW.
  s = s.replace(
    /^\s*#?\s*\[\s*(?:case|rack|opakowanie|skrzynia)\b[^\]]*(?:przed\s+update|legacy|old|stary)[^\]]*\]\s*/i,
    '',
  );

  // Stan + waga, jeśli starszy import nadal to ma.
  s = s.replace(
    /\s+\d+\s*\/\s*(?:\d+\s*)?szt\.?\s*(?:waga\s*:?\s*[\d.,]+\s*kg\.?)?\s*(?:\[\d+\]\s*)?$/i,
    '',
  );

  s = s.replace(
    /\s+waga\s*:?\s*[\d.,]+\s*kg\.?\s*(?:\[\d+\]\s*)?$/i,
    '',
  );

  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Rozpoznaje TYLKO jednoznaczne oznaczenia numeru fizycznego opakowania.
 *
 * Nie rusza:
 *   [DELL Latitude 5440]
 *   10 x LedBar
 *   0,5 x 1m
 *
 * Przykłady:
 *   "... (zestaw 12)" -> base "...", number "12"
 *   "[2] 4x Vokkero"  -> base "4x Vokkero", number "2"
 */
function parsePackageModelName(rawName) {
  let s = cleanImportedGarbage(rawName);
  let m;

  const suffixPatterns = [
    {
      marker: 'ZESTAW_PAREN',
      re: /\s*\(\s*zestaw\s*(?:nr\.?\s*)?#?\s*(\d+)\s*\)\s*$/i,
    },
    {
      marker: 'CASE_PAREN',
      re: /\s*\(\s*(?:case|rack|opakowanie|skrzynia)\s*(?:nr\.?\s*)?#?\s*(\d+)\s*\)\s*$/i,
    },
    {
      marker: 'ZESTAW_SUFFIX',
      re: /\s+-?\s*zestaw\s*(?:nr\.?\s*)?#?\s*(\d+)\s*$/i,
    },
    {
      marker: 'CASE_SUFFIX',
      re: /\s+-?\s*(?:case|rack|opakowanie|skrzynia)\s*(?:nr\.?\s*)?#?\s*(\d+)\s*$/i,
    },
  ];

  for (const p of suffixPatterns) {
    m = s.match(p.re);
    if (m) {
      const base = s.replace(p.re, '').replace(/\s{2,}/g, ' ').trim();
      return {
        original: rawName,
        cleaned: s,
        base,
        number: m[1],
        marker: p.marker,
        numbered: true,
      };
    }
  }

  // [1] Nazwa — tylko CYFRY w nawiasie kwadratowym na początku.
  m = s.match(/^\s*\[\s*(\d+)\s*\]\s+(.+)$/);
  if (m) {
    return {
      original: rawName,
      cleaned: s,
      base: text(m[2]),
      number: m[1],
      marker: 'NUMBER_PREFIX_BRACKET',
      numbered: true,
    };
  }

  // Nazwa [1] — uznajemy za numer dopiero na etapie grupowania.
  // Samo "[10]" może być częścią legalnej nazwy pojedynczego modelu.
  m = s.match(/^(.+?)\s+\[\s*(\d+)\s*\]\s*$/);
  if (m) {
    return {
      original: rawName,
      cleaned: s,
      base: text(m[1]),
      number: m[2],
      marker: 'NUMBER_SUFFIX_BRACKET_CONDITIONAL',
      numbered: true,
      conditional: true,
    };
  }

  return {
    original: rawName,
    cleaned: s,
    base: s,
    number: null,
    marker: 'NONE',
    numbered: false,
  };
}

function groupingKey(name) {
  return norm(name).replace(/\s+/g, ' ');
}

function isBlank(v) {
  return v === null || v === undefined || text(v) === '';
}

function sameValue(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return String(a) === String(b);
}

function localDatabaseGuard() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) throw new Error('Brak DATABASE_URL.');

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Niepoprawny DATABASE_URL.');
  }

  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'wms_postgres',
  ]);

  console.log(`DB: ${u.hostname}${u.pathname}`);

  if (!localHosts.has(u.hostname) && !opts.allowNonlocal) {
    throw new Error(
      `ODMOWA: ${u.hostname} nie wygląda na lokalną bazę.`
    );
  }
}

async function resolveOrg() {
  const orgs = await prisma.organizacja.findMany({
    where: { data_usuniecia: null },
    orderBy: { id: 'asc' },
  });

  if (!orgs.length) throw new Error('Brak organizacji.');

  if (opts.orgId) {
    const o = orgs.find((x) => x.id === opts.orgId);
    if (!o) throw new Error(`Brak organizacji id=${opts.orgId}`);
    return o;
  }

  if (orgs.length === 1) return orgs[0];

  console.log('Organizacje:');
  for (const o of orgs) console.log(`  ${o.id}: ${o.nazwa}`);
  throw new Error('Podaj --org N.');
}

async function modelForeignKeys(tx) {
  const refs = await tx.$queryRawUnsafe(`
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
      AND ccu.table_name = 'modele'
      AND ccu.column_name = 'id'
    ORDER BY tc.table_name, kcu.column_name
  `);

  return refs.map((r) => ({
    table: String(r.table_name),
    column: String(r.column_name),
  }));
}

function ident(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

async function tableHasColumn(tx, table, column) {
  const r = await tx.$queryRawUnsafe(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
  `, table, column);
  return r.length > 0;
}

async function countReference(tx, table, column, modelId, orgId) {
  const hasOrg = await tableHasColumn(tx, table, 'id_organizacji');
  const sql = hasOrg
    ? `SELECT COUNT(*)::int AS count FROM ${ident(table)}
       WHERE ${ident(column)} = $1 AND "id_organizacji" = $2`
    : `SELECT COUNT(*)::int AS count FROM ${ident(table)}
       WHERE ${ident(column)} = $1`;

  const rows = hasOrg
    ? await tx.$queryRawUnsafe(sql, modelId, orgId)
    : await tx.$queryRawUnsafe(sql, modelId);

  return Number(rows[0]?.count || 0);
}

async function reassignGenericReference(tx, table, column, oldId, newId, orgId) {
  const hasOrg = await tableHasColumn(tx, table, 'id_organizacji');
  const sql = hasOrg
    ? `UPDATE ${ident(table)}
       SET ${ident(column)} = $1
       WHERE ${ident(column)} = $2 AND "id_organizacji" = $3`
    : `UPDATE ${ident(table)}
       SET ${ident(column)} = $1
       WHERE ${ident(column)} = $2`;

  return hasOrg
    ? Number(await tx.$executeRawUnsafe(sql, newId, oldId, orgId))
    : Number(await tx.$executeRawUnsafe(sql, newId, oldId));
}

async function mergeCennikPrices(tx, orgId, survivorId, oldId, notes) {
  const oldRows = await tx.cenaSprzetu.findMany({
    where: {
      id_organizacji: orgId,
      id_modelu: oldId,
      data_usuniecia: null,
    },
  });

  for (const old of oldRows) {
    const existing = await tx.cenaSprzetu.findUnique({
      where: {
        id_cennika_id_modelu: {
          id_cennika: old.id_cennika,
          id_modelu: survivorId,
        },
      },
    });

    if (!existing) {
      await tx.cenaSprzetu.update({
        where: { id: old.id },
        data: { id_modelu: survivorId },
      });
      continue;
    }

    const comparable = [
      'cena_netto',
      'vat',
      'procent_pierwszego_dnia',
      'przelicznik_kolejnych_dni',
      'aktywny',
    ];

    const conflict = comparable.some(
      (field) => !sameValue(existing[field], old[field])
    );

    if (conflict) {
      throw new Error(
        `Konflikt ceny cennikowej: modele ${survivorId}/${oldId}, ` +
        `cennik ${old.id_cennika}. Nie wybieram ceny automatycznie.`
      );
    }

    await tx.cenaSprzetu.delete({
      where: { id: old.id },
    });

    notes.push(
      `Usunięto identyczny duplikat ceny_sprzetu id=${old.id}`
    );
  }
}

async function dedupeModelRates(tx, orgId, survivorId, notes) {
  const rows = await tx.cenaModelu.findMany({
    where: {
      id_organizacji: orgId,
      id_modelu: survivorId,
    },
    orderBy: { id: 'asc' },
  });

  const groups = new Map();

  for (const row of rows) {
    const key = norm(row.nazwa_stawki);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  for (const [key, list] of groups.entries()) {
    if (list.length < 2) continue;

    const keeper = list[0];

    for (const dup of list.slice(1)) {
      const fields = [
        'cena_netto',
        'koszt',
        'nazwa_kosztu',
        'mnoz_koszt',
        'aktywny',
      ];

      const conflicting = fields.some((f) => {
        if (isBlank(keeper[f]) || isBlank(dup[f])) return false;
        return !sameValue(keeper[f], dup[f]);
      });

      if (conflicting) {
        notes.push(
          `UWAGA: dwie różne stawki "${keeper.nazwa_stawki}" ` +
          `pozostawione przy modelu ${survivorId}: id ${keeper.id}, ${dup.id}`
        );
        continue;
      }

      const update = {};
      for (const f of ['cena_netto', 'koszt', 'nazwa_kosztu']) {
        if (isBlank(keeper[f]) && !isBlank(dup[f])) update[f] = dup[f];
      }

      if (Object.keys(update).length) {
        await tx.cenaModelu.update({
          where: { id: keeper.id },
          data: update,
        });
        Object.assign(keeper, update);
      }

      await tx.cenaModelu.delete({
        where: { id: dup.id },
      });

      notes.push(
        `Scalono duplikat ceny_modelu "${keeper.nazwa_stawki}" id=${dup.id}`
      );
    }
  }
}

function chooseSurvivor(group) {
  // Najpierw istniejący model bez numeru, dokładnie o nazwie bazowej.
  const exactBase = group.models.find(
    (x) => !x.parsed.numbered && groupingKey(x.model.nazwa) === groupingKey(group.base)
  );
  if (exactBase) return exactBase;

  // Potem model z największą liczbą egzemplarzy.
  return [...group.models].sort((a, b) => {
    const diff = b.model.egzemplarze.length - a.model.egzemplarze.length;
    if (diff) return diff;
    return a.model.id - b.model.id;
  })[0];
}

function mergeMetadata(models, survivor) {
  const fillFields = [
    'producent',
    'miejsce_w_mag',
    'opis',
    'notatki_wewnetrzne',
    'szerokosc',
    'wysokosc',
    'glebokosc',
    'objetosc',
    'waga',
    'wartosc',
    'wartosc_domyslna_egzemplarza',
    'zdjecie',
    'kod_kreskowy',
    'pobor_pradu',
  ];

  const update = {
    nazwa: models[0].baseName,
    typ_sprzetu: survivor.typ_sprzetu,
    tryb_ewidencji: 'egzemplarze',
    aktywny: models.some((x) => x.model.aktywny),
    widoczny_w_mag: models.some((x) => x.model.widoczny_w_mag),
    widoczny_w_ofercie: models.some((x) => x.model.widoczny_w_ofercie),
    ulubiony: models.some((x) => x.model.ulubiony),
  };

  const conflicts = [];

  for (const field of fillFields) {
    const nonBlank = models
      .map((x) => x.model[field])
      .filter((v) => !isBlank(v));

    if (!isBlank(survivor[field])) {
      update[field] = survivor[field];
    } else if (nonBlank.length) {
      update[field] = nonBlank[0];
    }

    const unique = [...new Set(nonBlank.map(String))];
    if (unique.length > 1) {
      conflicts.push({
        field,
        values: unique,
      });
    }
  }

  return { update, conflicts };
}

function planItemNumbers(group, survivorId) {
  const plans = [];
  const occupied = new Set();

  // Najpierw liczby wynikające jawnie z nazwy modelu.
  for (const x of group.models) {
    if (!x.parsed.number || x.model.egzemplarze.length !== 1) continue;
    occupied.add(String(Number(x.parsed.number)));
  }

  // Zachowaj istniejące numery tam, gdzie model nie ma własnego numeru.
  for (const x of group.models) {
    if (x.parsed.number && x.model.egzemplarze.length === 1) continue;
    for (const item of x.model.egzemplarze) {
      if (text(item.numer_egzemplarza)) {
        occupied.add(text(item.numer_egzemplarza));
      }
    }
  }

  let next = 1;
  function nextFree() {
    while (occupied.has(String(next))) next++;
    const result = String(next);
    occupied.add(result);
    next++;
    return result;
  }

  const assigned = new Set();

  for (const x of group.models) {
    const explicit = x.parsed.number;

    for (const item of x.model.egzemplarze) {
      let number = '';

      // Typowy błędny import: numbered model ma dokładnie 1 physical item.
      if (explicit && x.model.egzemplarze.length === 1) {
        number = String(Number(explicit));
      } else if (text(item.numer_egzemplarza)) {
        number = text(item.numer_egzemplarza);
      } else {
        number = nextFree();
      }

      if (assigned.has(number)) {
        // Duplikat po wcześniejszym imporcie -> nadaj kolejny wolny,
        // ale zachowaj informację w raporcie.
        const original = number;
        number = nextFree();

        plans.push({
          item,
          fromModelId: x.model.id,
          toModelId: survivorId,
          newNumber: number,
          newName: `${group.base} [${number}]`,
          note: `Konflikt numeru ${original}; nadano wolny numer ${number}`,
        });

        assigned.add(number);
        continue;
      }

      assigned.add(number);

      plans.push({
        item,
        fromModelId: x.model.id,
        toModelId: survivorId,
        newNumber: number,
        newName: `${group.base} [${number}]`,
        note:
          explicit && x.model.egzemplarze.length === 1
            ? `Numer ${number} przeniesiony z nazwy modelu (${x.parsed.marker})`
            : '',
      });
    }
  }

  // Sort raportu naturalnie po numerach.
  plans.sort((a, b) => {
    const na = Number(a.newNumber);
    const nb = Number(b.newNumber);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.newNumber.localeCompare(b.newNumber, 'pl');
  });

  return plans;
}

function buildGroups(models) {
  const parsed = models.map((model) => ({
    model,
    parsed: parsePackageModelName(model.nazwa),
  }));

  const raw = new Map();

  for (const x of parsed) {
    const key = groupingKey(x.parsed.base);
    if (!raw.has(key)) {
      raw.set(key, {
        base: x.parsed.base,
        models: [],
      });
    }
    raw.get(key).models.push(x);
  }

  const groups = [];

  for (const g of raw.values()) {
    const anyNumbered = g.models.some((x) => x.parsed.numbered);

    if (g.models.length < 2 && !opts.includeSingletons) continue;
    if (!anyNumbered && g.models.length < 2) continue;

    // Conditional suffix "[10]" jest numerem tylko jeśli grupa ma co najmniej
    // dwa modele o tej samej bazie albo jest inny jawnie numerowany model.
    if (
      g.models.length === 1
      && g.models[0].parsed.marker === 'NUMBER_SUFFIX_BRACKET_CONDITIONAL'
      && !opts.includeSingletons
    ) {
      continue;
    }

    // Nie łączymy opakowania z modelem "zestaw" automatycznie.
    const types = [...new Set(g.models.map((x) => x.model.typ_sprzetu))];
    const categories = [...new Set(g.models.map((x) => x.model.id_kategorii ?? 'NULL'))];

    groups.push({
      ...g,
      types,
      categories,
      safe:
        types.length === 1 &&
        categories.length === 1 &&
        g.models.length >= 2,
    });
  }

  groups.sort((a, b) => a.base.localeCompare(b.base, 'pl'));

  return groups;
}

async function executeGroup(orgId, group, foreignKeys) {
  const survivorWrap = chooseSurvivor(group);
  const survivorId = survivorWrap.model.id;
  const oldModels = group.models.filter((x) => x.model.id !== survivorId);
  const itemPlans = planItemNumbers(group, survivorId);
  const notes = [];

  const snapshot = {
    base: group.base,
    survivor_model_id: survivorId,
    models: group.models.map((x) => ({
      id: x.model.id,
      name: x.model.nazwa,
      type: x.model.typ_sprzetu,
      category_id: x.model.id_kategorii,
      parsed_number: x.parsed.number,
      marker: x.parsed.marker,
      item_ids: x.model.egzemplarze.map((e) => e.id),
    })),
  };

  if (!opts.apply) {
    return {
      applied: false,
      survivorId,
      oldModels,
      itemPlans,
      notes,
      snapshot,
      metadataConflicts: [],
    };
  }

  return prisma.$transaction(async (tx) => {
    const dbSurvivor = await tx.modelSprzetu.findUnique({
      where: { id: survivorId },
    });
    if (!dbSurvivor) throw new Error(`Brak modelu survivor ${survivorId}`);

    const metaModels = group.models.map((x) => ({
      ...x,
      baseName: group.base,
    }));

    const { update: metadataUpdate, conflicts: metadataConflicts } =
      mergeMetadata(metaModels, dbSurvivor);

    // 1. Ustaw bazową nazwę modelu.
    await tx.modelSprzetu.update({
      where: { id: survivorId },
      data: metadataUpdate,
    });

    // 2. Egzemplarze zachowują ID — przepinamy tylko id_modelu,
    // numer i czytelną nazwę fizycznego opakowania.
    for (const plan of itemPlans) {
      await tx.egzemplarz.update({
        where: { id: plan.item.id },
        data: {
          id_modelu: survivorId,
          numer_egzemplarza: plan.newNumber,
          nazwa: plan.newName,
        },
      });
    }

    // 3. Ceny cennikowe wymagają obsługi UNIQUE(id_cennika,id_modelu).
    for (const old of oldModels) {
      await mergeCennikPrices(
        tx,
        orgId,
        survivorId,
        old.model.id,
        notes,
      );
    }

    // 4. Pozostałe FK do modele.
    const excluded = new Set([
      'egzemplarze.id_modelu',
      'ceny_sprzetu.id_modelu',
    ]);

    for (const old of oldModels) {
      for (const fk of foreignKeys) {
        const key = `${fk.table}.${fk.column}`;
        if (excluded.has(key)) continue;

        // ceny_modeli można przepiąć normalnie; deduplikujemy później.
        const count = await countReference(
          tx,
          fk.table,
          fk.column,
          old.model.id,
          orgId,
        );

        if (!count) continue;

        const changed = await reassignGenericReference(
          tx,
          fk.table,
          fk.column,
          old.model.id,
          survivorId,
          orgId,
        );

        notes.push(
          `${fk.table}.${fk.column}: ${old.model.id} -> ${survivorId}, rekordów ${changed}`
        );
      }
    }

    // 5. Po przepięciu cen_modeli usuń identyczne stawki.
    await dedupeModelRates(tx, orgId, survivorId, notes);

    // 6. Dopiero teraz usuń puste, zbędne modele.
    for (const old of oldModels) {
      const leftItems = await tx.egzemplarz.count({
        where: { id_modelu: old.model.id },
      });

      if (leftItems) {
        throw new Error(
          `Model ${old.model.id} nadal ma ${leftItems} egzemplarzy — rollback grupy.`
        );
      }

      await tx.modelSprzetu.delete({
        where: { id: old.model.id },
      });
    }

    return {
      applied: true,
      survivorId,
      oldModels,
      itemPlans,
      notes,
      snapshot,
      metadataConflicts,
    };
  }, {
    maxWait: 10_000,
    timeout: 120_000,
  });
}

async function main() {
  console.log('================================================================');
  console.log('EVE-NT — SCALANIE MODELI OPAKOWAŃ / ZESTAWÓW Z NEW');
  console.log(opts.apply ? 'TRYB: APPLY' : 'TRYB: DRY-RUN');
  console.log('================================================================');

  localDatabaseGuard();
  const org = await resolveOrg();
  console.log(`Organizacja: ${org.id} — ${org.nazwa}`);

  fs.mkdirSync(opts.reportDir, { recursive: true });

  const models = await prisma.modelSprzetu.findMany({
    where: {
      id_organizacji: org.id,
      typ_sprzetu: {
        in: ['opakowanie', 'zestaw'],
      },
      data_usuniecia: null,
    },
    include: {
      egzemplarze: {
        where: { data_usuniecia: null },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Modele opakowań/zestawów w DB: ${models.length}`);

  const groups = buildGroups(models);
  console.log(`Grupy do analizy: ${groups.length}`);

  const foreignKeys = await modelForeignKeys(prisma);

  const reportRows = [];
  const results = [];
  let appliedGroups = 0;
  let skippedGroups = 0;
  let failedGroups = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    console.log('');
    console.log(`[${i + 1}/${groups.length}] ${group.base}`);
    console.log(`  modeli: ${group.models.length}`);
    console.log(
      `  ids: ${group.models.map((x) => x.model.id).join(', ')}`
    );

    if (!group.safe) {
      const reason = [];
      if (group.types.length !== 1) {
        reason.push(`różne typy: ${group.types.join(', ')}`);
      }
      if (group.categories.length !== 1) {
        reason.push(`różne kategorie: ${group.categories.join(', ')}`);
      }
      if (group.models.length < 2) {
        reason.push('tylko jeden model');
      }

      console.log(`  POMIJAM: ${reason.join('; ')}`);
      skippedGroups++;

      for (const x of group.models) {
        reportRows.push({
          status: 'DO_KONTROLI',
          base_name: group.base,
          survivor_model_id: '',
          old_model_id: x.model.id,
          old_model_name: x.model.nazwa,
          extracted_number: x.parsed.number || '',
          marker: x.parsed.marker,
          item_id: '',
          old_item_number: '',
          new_item_number: '',
          old_item_name: '',
          new_item_name: '',
          note: reason.join('; '),
        });
      }
      continue;
    }

    try {
      const result = await executeGroup(org.id, group, foreignKeys);
      results.push(result);

      const survivor = chooseSurvivor(group);
      console.log(`  survivor model ID: ${survivor.model.id}`);
      console.log(`  nowa nazwa modelu: ${group.base}`);
      console.log(`  egzemplarzy po scaleniu: ${result.itemPlans.length}`);

      for (const p of result.itemPlans) {
        const modelWrap = group.models.find(
          (x) => x.model.id === p.fromModelId
        );

        reportRows.push({
          status: opts.apply ? 'SCALONO' : 'PLAN',
          base_name: group.base,
          survivor_model_id: result.survivorId,
          old_model_id: p.fromModelId,
          old_model_name: modelWrap?.model.nazwa || '',
          extracted_number: modelWrap?.parsed.number || '',
          marker: modelWrap?.parsed.marker || '',
          item_id: p.item.id,
          old_item_number: p.item.numer_egzemplarza || '',
          new_item_number: p.newNumber,
          old_item_name: p.item.nazwa || '',
          new_item_name: p.newName,
          note: p.note,
        });
      }

      if (result.metadataConflicts?.length) {
        console.log(
          `  UWAGA konflikty metadanych: ${result.metadataConflicts.map((x) => x.field).join(', ')}`
        );
      }

      if (opts.apply) appliedGroups++;
    } catch (e) {
      failedGroups++;
      console.error(`  BŁĄD / ROLLBACK GRUPY: ${e.message}`);

      for (const x of group.models) {
        reportRows.push({
          status: 'BLAD_ROLLBACK',
          base_name: group.base,
          survivor_model_id: '',
          old_model_id: x.model.id,
          old_model_name: x.model.nazwa,
          extracted_number: x.parsed.number || '',
          marker: x.parsed.marker,
          item_id: '',
          old_item_number: '',
          new_item_number: '',
          old_item_name: '',
          new_item_name: '',
          note: e.message,
        });
      }
    }
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const report = {
    generated_at: new Date().toISOString(),
    mode: opts.apply ? 'APPLY' : 'DRY_RUN',
    organization: {
      id: org.id,
      name: org.nazwa,
    },
    models_scanned: models.length,
    groups_detected: groups.length,
    groups_applied: appliedGroups,
    groups_skipped: skippedGroups,
    groups_failed: failedGroups,
    foreign_keys_to_models: foreignKeys,
    groups: results.map((r) => ({
      applied: r.applied,
      survivor_model_id: r.survivorId,
      snapshot_before: r.snapshot,
      notes: r.notes,
      metadata_conflicts: r.metadataConflicts || [],
    })),
  };

  const jsonPath = path.join(
    opts.reportDir,
    `PACKAGE_MERGE_${opts.apply ? 'APPLY' : 'DRY_RUN'}_${stamp}.json`
  );

  const csvPath = path.join(
    opts.reportDir,
    `PACKAGE_MERGE_${opts.apply ? 'APPLY' : 'DRY_RUN'}_${stamp}.csv`
  );

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(report, null, 2),
    'utf8',
  );
  writeCsv(csvPath, reportRows);

  console.log('');
  console.log('================================================================');
  console.log('GOTOWE');
  console.log(`Modele przeanalizowane: ${models.length}`);
  console.log(`Grupy: ${groups.length}`);
  console.log(
    opts.apply
      ? `Scalone grupy: ${appliedGroups}`
      : 'Nie zmieniono bazy — to był DRY-RUN.'
  );
  console.log(`Pominięte: ${skippedGroups}`);
  console.log(`Błędy/rollback: ${failedGroups}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`JSON: ${jsonPath}`);

  if (!opts.apply) {
    console.log('');
    console.log('Jeżeli raport jest OK, uruchom ponownie z --apply.');
  }
}

main()
  .catch((e) => {
    console.error('\nBŁĄD KRYTYCZNY:');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
