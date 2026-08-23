#!/usr/bin/env node
/**
 * EVE-NT — PEŁNY AUDYT I CZYSZCZENIE NAZW MAGAZYNU
 *
 * Domyślnie wykonuje poprawki (--apply nie jest wymagane).
 * Działa tylko na lokalnej bazie, chyba że jawnie podasz --allow-nonlocal.
 *
 * Zakres:
 * - wszystkie modele sprzętu: bezpieczna normalizacja whitespace/HTML;
 * - modele typ_sprzetu=opakowanie: pełne czyszczenie śmieci z NEW;
 * - wszystkie egzemplarze modeli typu opakowanie;
 * - zachowuje numery egzemplarzy;
 * - generuje CSV + JSON: stara nazwa -> nowa nazwa + zastosowane reguły;
 * - po poprawkach drugi skan wykrywa nadal podejrzane nazwy.
 *
 * Uruchomienie z apps/api:
 *   node scripts/audit-fix-all-warehouse-names.mjs
 *
 * Tylko podgląd:
 *   node scripts/audit-fix-all-warehouse-names.mjs --dry-run
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
  orgId: arg('org-id') ? Number(arg('org-id')) : null,
  dryRun: Boolean(arg('dry-run', false)),
  allowNonlocal: Boolean(arg('allow-nonlocal', false)),
  reportDir: path.resolve(String(arg('report-dir', './import/new/name-audit'))),
};

function text(v) {
  return String(v ?? '').trim();
}

function norm(v) {
  return text(v)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBasicEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function addRule(rules, name) {
  if (!rules.includes(name)) rules.push(name);
}

function normalizeCommonName(input, rules) {
  let s = String(input ?? '');

  const beforeInvisible = s;
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  if (s !== beforeInvisible) addRule(rules, 'usunieto_niewidoczne_znaki');

  const beforeEntities = s;
  s = decodeBasicEntities(s);
  if (s !== beforeEntities) addRule(rules, 'dekodowano_html_entities');

  const beforeSpaces = s;
  s = s
    .replace(/\r?\n+/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s !== beforeSpaces) addRule(rules, 'znormalizowano_biale_znaki');

  // Usuń spacje przed typową interpunkcją.
  const beforePunct = s;
  s = s.replace(/\s+([,.;:])/g, '$1');
  if (s !== beforePunct) addRule(rules, 'poprawiono_spacje_przed_interpunkcja');

  // Zduplikowane identyczne "(zestaw N)" obok siebie.
  const beforeSet = s;
  s = s.replace(
    /(\(zestaw\s+\d+\))\s+\1(?=\s|$)/gi,
    '$1',
  );
  if (s !== beforeSet) addRule(rules, 'usunieto_powtorzony_zestaw');

  // Zduplikowane [NN] na samym końcu: [10] [10] -> [10].
  const beforeBracket = s;
  s = s.replace(/\[(\d+)\]\s+\[\1\]\s*$/i, '[$1]');
  if (s !== beforeBracket) addRule(rules, 'usunieto_powtorzony_numer');

  return s.trim();
}

function stripLegacyPackagePrefix(input, rules) {
  let s = input;

  // Znane śmieci z poprzednich migracji / NEW:
  // # [Case uniwersalny (przed update) 19] ...
  // [Case uniwersalny (przed update) ] ...
  // # [Opakowanie ... przed update ...] ...
  const patterns = [
    /^\s*#?\s*\[\s*case\s+uniwersalny\b[^\]]*przed\s+update[^\]]*\]\s*/i,
    /^\s*#?\s*\[\s*(?:case|rack|opakowanie|skrzynia)\b[^\]]*(?:przed\s+update|legacy|stary|old)[^\]]*\]\s*/i,
  ];

  for (const p of patterns) {
    const before = s;
    s = s.replace(p, '');
    if (s !== before) addRule(rules, 'usunieto_legacy_prefix');
  }

  // Sam znak # tylko jeśli ewidentnie został po usunięciu metadanych.
  const beforeHash = s;
  s = s.replace(/^\s*#\s+(?=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9])/u, '');
  if (s !== beforeHash) addRule(rules, 'usunieto_hash_prefix');

  return s;
}

function stripPackageRuntimeSuffix(input, rules) {
  let s = input;

  // Najważniejszy wariant NEW:
  // 2/2szt Waga: 14.2kg
  // 5/szt Waga: 70kg [10]
  // 4 / 4 szt. Waga: 46,12 kg [19]
  //
  // Pozwalamy na kilka [NN] na końcu, bo starszy importer mógł
  // jeszcze raz dokleić numer egzemplarza.
  const ratioStock = /\s+\d+\s*\/\s*(?:\d+\s*)?szt\.?\s*(?:waga\s*:?\s*[\d.,]+\s*kg\.?)?\s*(?:\[\d+\]\s*){0,3}$/i;
  const beforeRatio = s;
  s = s.replace(ratioStock, '');
  if (s !== beforeRatio) addRule(rules, 'usunieto_stan_szt_i_wage');

  // Wariant: "5 szt. Waga: 70kg [10]"
  const countWeight = /\s+\d+\s*szt\.?\s+waga\s*:?\s*[\d.,]+\s*kg\.?\s*(?:\[\d+\]\s*){0,3}$/i;
  const beforeCount = s;
  s = s.replace(countWeight, '');
  if (s !== beforeCount) addRule(rules, 'usunieto_ilosc_i_wage');

  // Sama waga jako techniczna końcówka.
  const weightOnly = /\s+waga\s*:?\s*[\d.,]+\s*kg\.?\s*(?:\[\d+\]\s*){0,3}$/i;
  const beforeWeight = s;
  s = s.replace(weightOnly, '');
  if (s !== beforeWeight) addRule(rules, 'usunieto_wage');

  // Sam techniczny licznik na końcu — tylko wariant z ukośnikiem,
  // żeby nie usuwać legalnych nazw typu "Case 4 szt.".
  const stockOnly = /\s+\d+\s*\/\s*(?:\d+\s*)?szt\.?\s*(?:\[\d+\]\s*){0,3}$/i;
  const beforeStock = s;
  s = s.replace(stockOnly, '');
  if (s !== beforeStock) addRule(rules, 'usunieto_stan_szt');

  return s;
}

function cleanPackageName(input) {
  const rules = [];
  let s = normalizeCommonName(input, rules);
  s = stripLegacyPackagePrefix(s, rules);
  s = stripPackageRuntimeSuffix(s, rules);
  s = normalizeCommonName(s, rules);

  return {
    oldName: text(input),
    newName: s,
    rules,
  };
}

function cleanRegularName(input) {
  const rules = [];
  const s = normalizeCommonName(input, rules);
  return {
    oldName: text(input),
    newName: s,
    rules,
  };
}

function ensureInstanceNumber(name, number, rules) {
  const n = text(number);
  let s = text(name);

  if (!n) return s;

  // Usuń wielokrotne powtórzenia numeru na samym końcu.
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reMany = new RegExp(`(?:\\s*\\[${escaped}\\]){2,}\\s*$`, 'i');
  const beforeMany = s;
  s = s.replace(reMany, ` [${n}]`);
  if (s !== beforeMany) addRule(rules, 'zredukowano_powtorzony_numer_egzemplarza');

  // Jeśli numer został usunięty razem ze śmieciami NEW, dokładamy dokładnie raz.
  const endsWithNumber = new RegExp(`\\[${escaped}\\]\\s*$`, 'i').test(s);
  if (!endsWithNumber) {
    s = `${s} [${n}]`.trim();
    addRule(rules, 'zachowano_numer_egzemplarza');
  }

  return s;
}

function suspiciousReasons(name, isPackage = false) {
  const s = text(name);
  const reasons = [];

  if (!s) reasons.push('pusta_nazwa');
  if (/[\u200B-\u200D\u2060\uFEFF]/.test(s)) reasons.push('niewidoczne_znaki');
  if (/&(?:nbsp|quot|amp|lt|gt|apos);|&#\d+;/i.test(s)) reasons.push('html_entity');
  if (/<[^>]+>/.test(s)) reasons.push('html_tag');
  if (/\s{2,}/.test(s)) reasons.push('wielokrotne_spacje');

  if (isPackage) {
    if (/waga\s*:/i.test(s)) reasons.push('pozostala_waga');
    if (/\d+\s*\/\s*(?:\d+\s*)?szt\.?/i.test(s)) reasons.push('pozostal_stan_szt');
    if (/^\s*#/.test(s)) reasons.push('pozostal_hash');
    if (/^\s*\[[^\]]*(?:przed\s+update|legacy|old|stary)[^\]]*\]/i.test(s)) {
      reasons.push('pozostal_legacy_prefix');
    }
    if (/\[(\d+)\]\s+\[\1\]\s*$/i.test(s)) reasons.push('powtorzony_numer');
  }

  // Niezbalansowane nawiasy/brackets — tylko sygnał, nie autokorekta.
  const openParen = (s.match(/\(/g) || []).length;
  const closeParen = (s.match(/\)/g) || []).length;
  if (openParen !== closeParen) reasons.push('niezbalansowane_nawiasy_okragle');

  const openBr = (s.match(/\[/g) || []).length;
  const closeBr = (s.match(/\]/g) || []).length;
  if (openBr !== closeBr) reasons.push('niezbalansowane_nawiasy_kwadratowe');

  return [...new Set(reasons)];
}

function csvCell(v) {
  const s = String(v ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, rows) {
  const headers = [
    'typ',
    'id',
    'model_id',
    'kod_kreskowy',
    'numer_egzemplarza',
    'stara_nazwa',
    'nowa_nazwa',
    'zmieniono',
    'reguly',
    'status_po',
    'podejrzane_powody',
  ];

  const lines = [
    headers.join(';'),
    ...rows.map((r) =>
      headers.map((h) => csvCell(r[h])).join(';')
    ),
  ];

  fs.writeFileSync(file, '\ufeff' + lines.join('\n'), 'utf8');
}

function localGuard() {
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

  console.log(`Baza: ${u.hostname}${u.pathname}`);

  if (!localHosts.has(u.hostname) && !opts.allowNonlocal) {
    throw new Error(
      `ODMOWA: host ${u.hostname} nie wygląda na lokalną bazę.`
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
    if (!o) throw new Error(`Brak organizacji ${opts.orgId}`);
    return o;
  }

  if (orgs.length === 1) return orgs[0];

  console.log('Organizacje:');
  for (const o of orgs) console.log(`  ${o.id}: ${o.nazwa}`);
  throw new Error('Podaj --org-id N.');
}

async function main() {
  console.log('==============================================================');
  console.log('EVE-NT — PEŁNY AUDYT NAZW MAGAZYNU v3');
  console.log(opts.dryRun ? 'TRYB: DRY RUN' : 'TRYB: APPLY');
  console.log('==============================================================');

  localGuard();
  const org = await resolveOrg();
  console.log(`Organizacja: ${org.id} — ${org.nazwa}`);

  fs.mkdirSync(opts.reportDir, { recursive: true });

  const models = await prisma.modelSprzetu.findMany({
    where: {
      id_organizacji: org.id,
      data_usuniecia: null,
    },
    orderBy: { id: 'asc' },
    include: {
      egzemplarze: {
        where: { data_usuniecia: null },
        orderBy: { id: 'asc' },
      },
    },
  });

  const report = [];
  let changedModels = 0;
  let changedItems = 0;

  for (const model of models) {
    const isPackage = model.typ_sprzetu === 'opakowanie';

    const cleanedModel = isPackage
      ? cleanPackageName(model.nazwa)
      : cleanRegularName(model.nazwa);

    const modelSuspicious = suspiciousReasons(
      cleanedModel.newName,
      isPackage,
    );

    const modelChanged =
      cleanedModel.newName &&
      cleanedModel.newName !== text(model.nazwa);

    if (modelChanged && !opts.dryRun) {
      await prisma.modelSprzetu.update({
        where: { id: model.id },
        data: { nazwa: cleanedModel.newName },
      });
      changedModels++;
    } else if (modelChanged) {
      changedModels++;
    }

    report.push({
      typ: isPackage ? 'MODEL_OPAKOWANIA' : 'MODEL_SPRZETU',
      id: model.id,
      model_id: model.id,
      kod_kreskowy: model.kod_kreskowy || '',
      numer_egzemplarza: '',
      stara_nazwa: model.nazwa,
      nowa_nazwa: cleanedModel.newName,
      zmieniono: modelChanged ? 'TAK' : 'NIE',
      reguly: cleanedModel.rules.join(' | '),
      status_po: modelSuspicious.length ? 'DO_KONTROLI' : 'OK',
      podejrzane_powody: modelSuspicious.join(' | '),
    });

    // Egzemplarze opakowań czyścimy bardziej dokładnie.
    // Egzemplarze zwykłego sprzętu tylko normalizujemy typograficznie.
    for (const item of model.egzemplarze) {
      const cleaned = isPackage
        ? cleanPackageName(item.nazwa || cleanedModel.newName)
        : cleanRegularName(item.nazwa || '');

      let newItemName = cleaned.newName;

      if (isPackage && item.numer_egzemplarza) {
        newItemName = ensureInstanceNumber(
          newItemName,
          item.numer_egzemplarza,
          cleaned.rules,
        );
      }

      newItemName = normalizeCommonName(
        newItemName,
        cleaned.rules,
      );

      const suspicious = suspiciousReasons(
        newItemName,
        isPackage,
      );

      const changed =
        newItemName &&
        newItemName !== text(item.nazwa);

      if (changed && !opts.dryRun) {
        await prisma.egzemplarz.update({
          where: { id: item.id },
          data: { nazwa: newItemName },
        });
        changedItems++;
      } else if (changed) {
        changedItems++;
      }

      report.push({
        typ: isPackage ? 'EGZEMPLARZ_OPAKOWANIA' : 'EGZEMPLARZ_SPRZETU',
        id: item.id,
        model_id: model.id,
        kod_kreskowy: item.kod_kreskowy || '',
        numer_egzemplarza: item.numer_egzemplarza || '',
        stara_nazwa: item.nazwa || '',
        nowa_nazwa: newItemName,
        zmieniono: changed ? 'TAK' : 'NIE',
        reguly: cleaned.rules.join(' | '),
        status_po: suspicious.length ? 'DO_KONTROLI' : 'OK',
        podejrzane_powody: suspicious.join(' | '),
      });
    }
  }

  const changedRows = report.filter((r) => r.zmieniono === 'TAK');
  const suspiciousRows = report.filter((r) => r.status_po === 'DO_KONTROLI');

  const jsonReport = {
    organization: { id: org.id, name: org.nazwa },
    dry_run: opts.dryRun,
    total_models: models.length,
    total_rows_checked: report.length,
    changed_models: changedModels,
    changed_items: changedItems,
    suspicious_after_cleanup: suspiciousRows.length,
    changes: changedRows,
    suspicious: suspiciousRows,
  };

  const jsonPath = path.join(opts.reportDir, 'NAME_AUDIT_REPORT.json');
  const csvPath = path.join(opts.reportDir, 'NAME_AUDIT_REPORT.csv');
  const suspiciousCsv = path.join(opts.reportDir, 'NAME_AUDIT_DO_KONTROLI.csv');

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(jsonReport, null, 2),
    'utf8',
  );
  writeCsv(csvPath, report);
  writeCsv(suspiciousCsv, suspiciousRows);

  console.log('');
  console.log('GOTOWE');
  console.log(`Sprawdzono rekordów: ${report.length}`);
  console.log(`Zmienione modele: ${changedModels}`);
  console.log(`Zmienione egzemplarze: ${changedItems}`);
  console.log(`Nadal do kontroli: ${suspiciousRows.length}`);
  console.log(`Raport: ${csvPath}`);
  console.log(`Podejrzane: ${suspiciousCsv}`);

  if (suspiciousRows.length) {
    console.log('');
    console.log('Pierwsze nazwy DO_KONTROLI:');
    for (const r of suspiciousRows.slice(0, 20)) {
      console.log(
        `  ${r.typ} #${r.id}: "${r.nowa_nazwa}" [${r.podejrzane_powody}]`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error('\nBŁĄD:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
