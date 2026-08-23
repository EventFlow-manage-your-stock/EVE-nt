#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const HEADERS = [
  'Nazwa',
  'Kategoria',
  'Producent',
  'Model',
  'SKU',
  'Kod kreskowy',
  'Ilość',
  'Status',
  'Stan',
  'Cena zakupu',
  'Cena wynajmu/doba',
  'Waga (kg)',
  'Moc (W)',
  'Wymiary',
  'Lokalizacja',
  'Nr seryjny',
  'Notatki',
  'Opis',
  'Kod sztuki',
  'Notatki sztuki',
  'Serializować',
];

const inputDir = path.join(process.cwd(), 'import', 'data', 'magazyn');
const outputFile = path.join(process.cwd(), 'import', 'out', 'magazyn-sprzet-bez-case.csv');
const reportsDir = path.join(process.cwd(), 'import', 'reports');

const stats = {
  files: 0,
  sourceRows: 0,
  outputRows: 0,
  egzemplarze: 0,
  ilosciowe: 0,
  caseSkipped: 0,
  rackLikeSkipped: 0,
  duplicatePieceCodeSkipped: 0,
  emptySkipped: 0,
};

const warnings = [];
const skuByName = new Map();
let skuCounter = 1;
const seenPieceCodes = new Map();

function clean(value) {
  if (value === undefined || value === null) return '';

  const text = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

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
    return '';
  }

  return text;
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }
  }

  const keys = Object.keys(row);
  const normalizedNames = names.map(normalize);

  for (const key of keys) {
    const normalizedKey = normalize(key);

    if (normalizedNames.includes(normalizedKey)) {
      return row[key];
    }
  }

  return '';
}

function detectType(row) {
  const typ = normalize(getCell(row, ['Typ', 'type']));

  if (typ.includes('case') || typ.includes('opakowanie')) return 'case';
  if (typ.includes('ilosciowe') || typ.includes('ilosc')) return 'ilosciowe';
  if (typ.includes('egzemplarz')) return 'egzemplarz';

  return 'egzemplarz';
}

function isRackOrCaseLike(name, category) {
  const n = normalize(name);
  const c = normalize(category);

  if (!n) return false;

  // W imporcie "sprzęt bez case" pomijamy typowe opakowania/racki/skrzynie.
  // Nie pomijamy słów typu "stagebox", bo to jest realny sprzęt audio.
  const startsLikeCase =
    n.startsWith('case ') ||
    n.startsWith('rack ') ||
    n.startsWith('rck ') ||
    n.startsWith('skrzynia ') ||
    n.startsWith('walizka ') ||
    n.startsWith('opakowanie ') ||
    n.startsWith('flightcase ') ||
    n.startsWith('flight case ');

  const categoryLikeCase =
    c.includes('opakowania') ||
    c.includes('case') ||
    c.includes('racki') ||
    c.includes('skrzynie');

  return startsLikeCase || categoryLikeCase;
}

function numberValue(value) {
  const text = clean(value);

  if (!text) return '';

  const normalized = text
    .replace(/\s/g, '')
    .replace(/zł/gi, '')
    .replace(/pln/gi, '')
    .replace(',', '.');

  const match = normalized.match(/-?\d+(\.\d+)?/);

  return match ? match[0] : '';
}

function quantityValue(value, fallback = 1) {
  const text = clean(value);

  if (!text) return fallback;

  const match = text.match(/\d+/);

  if (!match) return fallback;

  const qty = Number(match[0]);

  return Number.isInteger(qty) && qty > 0 ? qty : fallback;
}

function barcodeValue(value) {
  const text = clean(value)
    .replace(/^'/, '')
    .replace(/\s/g, '');

  if (!text) return '';

  const digits = text.replace(/\D/g, '');

  if (digits.length >= 4) return digits;

  return text;
}

function slug(value) {
  const key = normalize(value);

  if (!key) return 'SPRZET';

  return key
    .split(' ')
    .slice(0, 4)
    .map((part) => part.slice(0, 8).toUpperCase())
    .join('-');
}

function skuFor(name, category) {
  const key = normalize(`${category} ${name}`);

  if (!key) return '';

  if (!skuByName.has(key)) {
    const nr = String(skuCounter).padStart(4, '0');
    skuCounter += 1;
    skuByName.set(key, `MAG-${slug(name)}-${nr}`);
  }

  return skuByName.get(key);
}

function dimensions(row) {
  const w = clean(getCell(row, ['Szerokość', 'Szerokosc']));
  const h = clean(getCell(row, ['Wysokość', 'Wysokosc']));
  const d = clean(getCell(row, ['Głębokość', 'Glebokosc']));

  const parts = [w, h, d].filter(Boolean);

  return parts.length ? parts.join(' x ') : '';
}

function convertRow(row, fileName, rowNumber) {
  const type = detectType(row);

  const nazwaModelu = clean(getCell(row, ['Nazwa modelu', 'Model']));
  const nazwa = clean(getCell(row, ['Nazwa']));
  const finalName = nazwaModelu || nazwa;

  const kategoria = clean(getCell(row, ['Kategoria']));

  if (type === 'case') {
    stats.caseSkipped += 1;
    return null;
  }

  if (isRackOrCaseLike(finalName, kategoria)) {
    stats.rackLikeSkipped += 1;

    warnings.push({
      Plik: fileName,
      Wiersz: rowNumber,
      Typ: 'pominieto_case_lub_rack',
      Opis: `Pominięto w imporcie sprzętu bez case: ${finalName}`,
    });

    return null;
  }

  const nr = clean(getCell(row, ['Nr', 'Numer']));
  const kod = barcodeValue(getCell(row, ['Kod kreskowy', 'Kod']));
  const miejsce = clean(getCell(row, ['Miejsce', 'Lokalizacja']));
  const serial = clean(getCell(row, ['Numer seryjny', 'Nr seryjny', 'SN']));
  const wartosc = numberValue(getCell(row, ['Wartość', 'Wartosc', 'Cena zakupu']));
  const waga = numberValue(getCell(row, ['Waga', 'Waga (kg)']));
  const objetosc = clean(getCell(row, ['Objętość', 'Objetosc']));

  if (!finalName && !kategoria) {
    stats.emptySkipped += 1;
    return null;
  }

  const ilosc = type === 'ilosciowe'
    ? quantityValue(getCell(row, ['ilość', 'Ilość', 'Ilosc']), 1)
    : 1;

  if (type === 'ilosciowe') stats.ilosciowe += 1;
  if (type === 'egzemplarz') stats.egzemplarze += 1;

  const kodSztuki = type === 'egzemplarz'
    ? kod || nr
    : '';

  // Bardzo ważne: nie importujemy drugi raz tej samej fizycznej sztuki.
  // Jeżeli kod sztuki już był, pomijamy kolejny rekord i zapisujemy ostrzeżenie.
  if (kodSztuki) {
    if (seenPieceCodes.has(kodSztuki)) {
      stats.duplicatePieceCodeSkipped += 1;

      const first = seenPieceCodes.get(kodSztuki);

      warnings.push({
        Plik: fileName,
        Wiersz: rowNumber,
        Typ: 'pominieto_duplikat_kodu_sztuki',
        Opis: `Kod ${kodSztuki} już był wcześniej: ${first}. Pominięto duplikat: ${finalName}`,
      });

      return null;
    }

    seenPieceCodes.set(kodSztuki, `${fileName}, wiersz ${rowNumber}, ${finalName}`);
  }

  const notatki = [
    `Źródło: ${fileName}, wiersz ${rowNumber}`,
    nr ? `Nr z pliku: ${nr}` : '',
    objetosc ? `Objętość: ${objetosc}` : '',
    type === 'ilosciowe' ? 'Sprzęt ilościowy bez case.' : '',
  ].filter(Boolean).join(' | ');

  const notatkiSztuki = [
    kod ? `Kod z pliku: ${kod}` : '',
    miejsce ? `Miejsce z pliku: ${miejsce}` : '',
  ].filter(Boolean).join(' | ');

  return {
    'Nazwa': finalName,
    'Kategoria': kategoria,
    'Producent': '',
    'Model': nazwaModelu,
    'SKU': skuFor(finalName, kategoria),
    // Ważne:
    // Kod kreskowy z pliku magazynowego zapisujemy do szablonu.
    // Dla egzemplarzy ten sam kod zostaje też w "Kod sztuki".
    'Kod kreskowy': kod,
    'Ilość': String(ilosc),
    'Status': 'dostępny',
    'Stan': 'dobry',
    'Cena zakupu': wartosc,
    'Cena wynajmu/doba': '',
    'Waga (kg)': waga,
    'Moc (W)': '',
    'Wymiary': dimensions(row),
    'Lokalizacja': miejsce,
    'Nr seryjny': serial,
    'Notatki': notatki,
    'Opis': nazwa && nazwa !== finalName ? nazwa : '',
    'Kod sztuki': kodSztuki,
    'Notatki sztuki': notatkiSztuki,

    // Zostawiamy puste.
    // "tak" powinno być używane tylko wtedy, gdy jedna pozycja ma wygenerować wiele sztuk.
    // Tutaj mamy albo konkretne egzemplarze z Kod sztuki, albo pozycje ilościowe.
    'Serializować': '',
  };
}


function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows) {
  const lines = [];

  lines.push(HEADERS.map(csvEscape).join(';'));

  for (const row of rows) {
    lines.push(HEADERS.map((header) => csvEscape(row[header] ?? '')).join(';'));
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `\ufeff${lines.join('\n')}`, 'utf8');
}

function writeReports() {
  fs.mkdirSync(reportsDir, { recursive: true });

  fs.writeFileSync(
    path.join(reportsDir, 'konwersja-magazyn-bez-case-summary.json'),
    JSON.stringify(stats, null, 2),
    'utf8'
  );

  const warningHeaders = ['Plik', 'Wiersz', 'Typ', 'Opis'];
  const warningLines = [warningHeaders.map(csvEscape).join(';')];

  for (const warning of warnings) {
    warningLines.push(warningHeaders.map((h) => csvEscape(warning[h] ?? '')).join(';'));
  }

  fs.writeFileSync(
    path.join(reportsDir, 'konwersja-magazyn-bez-case-warnings.csv'),
    `\ufeff${warningLines.join('\n')}`,
    'utf8'
  );
}

function main() {
  console.log('\n=== Konwersja magazynu do CSV — sprzęt bez case ===\n');

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Nie znaleziono folderu: ${inputDir}`);
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((name) => /magazyn.*\.(xlsx|xls|csv)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }))
    .map((name) => path.join(inputDir, name));

  if (files.length === 0) {
    throw new Error(`Brak plików magazyn*.xlsx/xls/csv w folderze: ${inputDir}`);
  }

  const outputRows = [];

  for (const file of files) {
    stats.files += 1;

    console.log(`Czytam: ${file}`);

    const workbook = XLSX.readFile(file, {
      cellDates: false,
      cellText: true,
    });

    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });

    for (let index = 0; index < rows.length; index++) {
      stats.sourceRows += 1;

      const converted = convertRow(
        rows[index],
        path.basename(file),
        index + 2
      );

      if (converted) {
        outputRows.push(converted);
        stats.outputRows += 1;
      }
    }
  }

  writeCsv(outputFile, outputRows);
  writeReports();

  console.log('\n=== Podsumowanie ===\n');
  console.table(stats);

  console.log('\n✅ Gotowy plik CSV:');
  console.log(outputFile);

  console.log('\nRaporty:');
  console.log(path.join(reportsDir, 'konwersja-magazyn-bez-case-summary.json'));
  console.log(path.join(reportsDir, 'konwersja-magazyn-bez-case-warnings.csv'));
}

try {
  main();
} catch (error) {
  console.error('\n❌ Błąd:');
  console.error(error.message || error);
  process.exit(1);
}
