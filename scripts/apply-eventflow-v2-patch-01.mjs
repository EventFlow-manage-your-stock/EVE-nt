#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function file(rel) {
  return path.join(root, rel);
}

function assertFile(rel) {
  if (!fs.existsSync(file(rel))) {
    throw new Error(`Nie znaleziono pliku: ${rel}. Uruchom skrypt z katalogu głównego EventFlow_v2.`);
  }
}

function backup(rel) {
  const src = file(rel);
  fs.copyFileSync(src, `${src}.bak.${timestamp}`);
}

function update(rel, updater) {
  assertFile(rel);
  backup(rel);
  const before = fs.readFileSync(file(rel), 'utf8');
  const after = updater(before);
  if (after !== before) {
    fs.writeFileSync(file(rel), after);
    console.log(`✅ Zmieniono: ${rel}`);
  } else {
    console.log(`ℹ️ Bez zmian albo już poprawione: ${rel}`);
  }
}

function replaceAll(text, search, replacement) {
  return text.split(search).join(replacement);
}

update('apps/web/app/dashboard/calendar/page.tsx', (input) => {
  let text = input;
  text = text.replace(/urlop:\s*['"]#[0-9A-Fa-f]{6}['"]/g, "urlop: '#020617'");
  text = text.replace(/flota:\s*['"]#[0-9A-Fa-f]{6}['"]/g, "flota: '#22C55E'");
  return text;
});

update('apps/api/src/kalendarz/kalendarz.service.ts', (input) => {
  let text = input;
  text = replaceAll(text, "kolor: '#22C55E'", "kolor: '#020617'");
  for (const color of ['#0EA5E9', '#6366F1', '#F59E0B', '#2563EB', '#3B82F6']) {
    text = replaceAll(text, `kolor: '${color}'`, "kolor: '#22C55E'");
  }
  return text;
});

update('apps/api/src/serwis/serwis.service.ts', (input) => {
  let text = input;

  if (!text.includes('EVENTFLOW_PATCH_REMOVE_DZIALA_STATUS')) {
    text = text.replace(
      'async getStatusy(id_organizacji: number) { let statusy',
      "async getStatusy(id_organizacji: number) { // EVENTFLOW_PATCH_REMOVE_DZIALA_STATUS\n await this.prisma.extendedClient.statusSerwisu.updateMany({ where: { id_organizacji, aktywny: true, nazwa: { equals: 'Działa', mode: 'insensitive' } }, data: { aktywny: false, data_usuniecia: new Date() } }).catch(() => null); let statusy"
    );
  }

  text = text.replace(/\s*\{\s*id_organizacji,\s*nazwa:\s*'Działa',\s*kolor:\s*'#[0-9A-Fa-f]{6}',\s*kolejnosc:\s*1\s*\},?\s*/g, ' ');
  text = replaceAll(text, "{ id_organizacji, nazwa: 'Wymaga serwisu (działa)', kolor: '#facc15', kolejnosc: 2 }", "{ id_organizacji, nazwa: 'Wymaga serwisu (działa)', kolor: '#facc15', kolejnosc: 1 }");
  text = replaceAll(text, "{ id_organizacji, nazwa: 'Wymaga serwisu (nie działa)', kolor: '#ef4444', kolejnosc: 3 }", "{ id_organizacji, nazwa: 'Wymaga serwisu (nie działa)', kolor: '#ef4444', kolejnosc: 2 }");
  text = replaceAll(text, "{ id_organizacji, nazwa: 'W serwisie', kolor: '#2563eb', kolejnosc: 4 }", "{ id_organizacji, nazwa: 'W serwisie', kolor: '#2563eb', kolejnosc: 3 }");
  text = replaceAll(text, "{ id_organizacji, nazwa: 'Naprawiony', kolor: '#16a34a', kolejnosc: 5 }", "{ id_organizacji, nazwa: 'Naprawiony', kolor: '#16a34a', kolejnosc: 4 }");
  return text;
});

update('apps/web/app/dashboard/service/page.tsx', (input) => {
  let text = input;
  text = replaceAll(
    text,
    'setStatuses(s.data||[]);',
    "setStatuses((s.data||[]).filter((x:any)=>String(x.nazwa||'').toLowerCase()!=='działa'));"
  );
  text = replaceAll(text, '<option value="Działa">Działa</option>', '');
  text = replaceAll(text, "<option value='Działa'>Działa</option>", '');
  text = replaceAll(text, '>Bez zmiany Działa Wymaga serwisu', '>Bez zmiany Wymaga serwisu');
  text = replaceAll(text, 'Bez zmiany Działa Wymaga serwisu', 'Bez zmiany Wymaga serwisu');
  return text;
});

const pdfSource = path.join(root, 'apps/web/app/dashboard/offers/[id]/pdf/page.tsx');
const replacement = path.join(root, 'apps/web/app/dashboard/offers/[id]/pdf/page.tsx.patch-source');
if (fs.existsSync(replacement)) {
  backup('apps/web/app/dashboard/offers/[id]/pdf/page.tsx');
  fs.copyFileSync(replacement, pdfSource);
  fs.unlinkSync(replacement);
  console.log('✅ Podmieniono: apps/web/app/dashboard/offers/[id]/pdf/page.tsx');
} else {
  console.log('ℹ️ Brak pliku PDF .patch-source — pomijam podmianę PDF.');
}

console.log('\nGotowe. Zrestartuj API i frontend.');
