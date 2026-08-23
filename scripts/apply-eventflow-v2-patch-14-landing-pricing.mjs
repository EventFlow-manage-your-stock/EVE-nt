#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const webRoot = path.join(root, 'apps', 'web');
const changed = [];
const warnings = [];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build', '.git'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js|mdx|md|html)$/i.test(ent.name) && !/\.bak_|\.backup|\.old/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function backupFile(file, text) {
  const rel = path.relative(root, file);
  const bak = path.join(path.dirname(file), `${path.basename(file)}.bak_patch14_${Date.now()}`);
  fs.writeFileSync(bak, text);
  return rel;
}

function replaceAllLiteral(text, from, to) {
  return text.split(from).join(to);
}

function removeStandaloneFeature(text, feature) {
  const esc = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Array/string entries: 'Feature', "Feature",
  text = text.replace(new RegExp(`\\s*['\"]${esc}['\"]\\s*,?`, 'g'), '');
  // JSX li entries with optional icon/children, conservative standalone line removal
  text = text.replace(new RegExp(`\\n[^\\n]*(?:${esc})[^\\n]*`, 'g'), (line) => {
    if (line.length > 350) return line.replace(new RegExp(esc, 'g'), '');
    if (/<li|<span|<p|CheckCircle|Check|feature|Feature|funkcj|Funkcj/i.test(line)) return '';
    return line.replace(new RegExp(esc, 'g'), '');
  });
  // Raw duplicate text fallback
  text = text.replace(new RegExp(esc, 'g'), '');
  return text;
}

function findPlanIndex(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`(?:name|title|nazwa|plan)\\s*:\\s*['\"\\`]${escaped}['\"\\`]`, 'i'),
      new RegExp(`['\"\\`]${escaped}['\"\\`]`, 'i'),
      new RegExp(`>\\s*${escaped}\\s*<`, 'i'),
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (m) return m.index;
    }
  }
  return -1;
}

function addFeatureToArrayAfterPlan(text, planLabels, feature) {
  if (text.includes(feature)) return { text, ok: true, already: true };
  const planIdx = findPlanIndex(text, planLabels);
  if (planIdx === -1) return { text, ok: false };

  const windowText = text.slice(planIdx, planIdx + 8000);
  const arrayRe = /(?:features|funkcje|items|lista)\s*:\s*\[/i;
  const m = arrayRe.exec(windowText);
  if (m) {
    const insertPos = planIdx + m.index + m[0].length;
    const indentMatch = text.slice(0, insertPos).match(/(^|\n)([ \t]*)[^\n]*$/);
    const indent = (indentMatch?.[2] || '      ') + '  ';
    return { text: text.slice(0, insertPos) + `\n${indent}'${feature}',` + text.slice(insertPos), ok: true };
  }

  const ulIdx = windowText.search(/<ul[\s>]/i);
  if (ulIdx !== -1) {
    const ulEnd = windowText.indexOf('>', ulIdx);
    if (ulEnd !== -1) {
      const insertPos = planIdx + ulEnd + 1;
      return { text: text.slice(0, insertPos) + `\n                <li>${feature}</li>` + text.slice(insertPos), ok: true };
    }
  }

  return { text, ok: false };
}

function normalizePricing(text, file) {
  let out = text;

  // Teksty landing/cennik
  const replacements = [
    ['KONTROLA NAD KAŻDYM KABLEM I PRACOWNIKIEM', 'KONTROLA NAD KAŻDYM SPRZĘTEM, WYDARZENIEM ORAZ TECHNIKIEM'],
    ['Przestań tracić pieniądze na zagubionym sprzęcie i zapomnij o overbookingu.', 'Przestań tracić pieniądze na zagubionym sprzęcie i zapomnij o problemach organizacyjnych.'],
    ['System, któremu ufają liderzy techniki scenicznej i AV', 'System, któremu ufają liderzy branży eventowej.'],
    ['Stworzone przez eventowców dla eventowców. Upraszczamy zarządzanie technologią sceniczną, abyś Ty mógł skupić się na tworzeniu niezwykłych widowisk.', 'Stworzone przez specjalistów dla wszystkich. Upraszczamy zarządzanie technologią sceniczną, abyś Ty mógł skupić się na tworzeniu niezwykłych widowisk.'],
    ['Oszczędności z odzyskanego sprzętu i czasu pracy pokryją koszt subskrypcji w pierwszym miesiącu.', ''],
    ['800 zł + dojazd', '800 zł'],
    ['800zł + dojazd', '800 zł'],
    ['800 PLN + dojazd', '800 zł'],
  ];

  for (const [from, to] of replacements) out = replaceAllLiteral(out, from, to);

  // Usunięcia funkcji z cennika
  const removeFeatures = [
    'Budżetowanie wydarzeń',
    'Eksporty Danych',
    'Eksporty danych',
    'CRM (Kontrahenci + Kontakty)',
    'CRM Kontrahenci + Kontakty',
    'Moduł Ofert',
    'Moduł ofert',
    'Wynajmy cross-rental',
    'Wynajmy cross rental',
  ];
  for (const feature of removeFeatures) out = removeStandaloneFeature(out, feature);

  const maybePricing = /cennik|pricing|starter|enterprise|budżetowanie|cross-rental|moduł ofert|kontrahenci/i.test(out) || /pricing|cennik/i.test(file);
  if (maybePricing) {
    const proFeatures = ['CRM (Kontrahenci + Kontakty)', 'Moduł Ofert'];
    for (const feature of proFeatures) {
      const result = addFeatureToArrayAfterPlan(out, ['Pro', 'PRO', 'Professional'], feature);
      out = result.text;
      if (!result.ok) warnings.push(`Nie udało się automatycznie dodać do planu PRO: ${feature} w ${path.relative(root, file)}`);
    }

    const ent = addFeatureToArrayAfterPlan(out, ['Enterprise', 'ENTERPRISE', 'Biznes', 'Business'], 'Wynajmy cross-rental');
    out = ent.text;
    if (!ent.ok) warnings.push(`Nie udało się automatycznie dodać do planu Enterprise: Wynajmy cross-rental w ${path.relative(root, file)}`);
  }


  // Informacja, że ceny są netto
  if (maybePricing && /\b(zł|PLN)\b/i.test(out) && !/ceny\s+netto|netto/i.test(out)) {
    out = out.replace(/(800 zł)/g, '$1 netto');
    out = out.replace(/(\d+[\s\u00a0]*zł)(?!\s*netto)/g, '$1 netto');
  } else if (maybePricing) {
    out = out.replace(/(800 zł)(?!\s*netto)/g, '$1 netto');
  }

  return out;
}

if (!fs.existsSync(webRoot)) {
  console.error('Nie jestem w katalogu projektu EventFlow_v2 albo nie ma apps/web.');
  process.exit(1);
}

const files = walk(webRoot);
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = normalizePricing(before, file);
  if (after !== before) {
    const rel = backupFile(file, before);
    fs.writeFileSync(file, after);
    changed.push(rel);
  }
}

console.log('\n✅ Patch 14: landing/cennik założony.');
console.log('\nZmienione pliki:');
for (const f of changed) console.log(' -', f);
if (!changed.length) console.log(' - brak zmian: nie znaleziono tekstów do podmiany');

if (warnings.length) {
  console.log('\n⚠️ Ostrzeżenia do sprawdzenia:');
  for (const w of warnings) console.log(' -', w);
}

console.log('\nKontrola tekstów:');
console.log(' - Hero: KONTROLA NAD KAŻDYM SPRZĘTEM, WYDARZENIEM ORAZ TECHNIKIEM');
console.log(' - Stopka: Stworzone przez specjalistów dla wszystkich...');
console.log(' - Cena wdrożenia: 800 zł netto');
console.log(' - Ceny: netto');
console.log(' - PRO: CRM + Moduł Ofert');
console.log(' - Enterprise: Wynajmy cross-rental');
