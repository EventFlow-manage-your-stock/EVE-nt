#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function file(rel) {
  return path.join(root, rel);
}

function assertProjectRoot() {
  const pkg = file('package.json');
  const apps = file('apps');
  if (!fs.existsSync(pkg) || !fs.existsSync(apps)) {
    throw new Error('Uruchom skrypt z katalogu głównego EventFlow_v2, np. ~/Desktop/evf_piatek/EventFlow_v2');
  }
}

function backup(rel) {
  const src = file(rel);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, `${src}.bak.${timestamp}`);
    console.log(`📦 Backup: ${rel}.bak.${timestamp}`);
  }
}

function main() {
  assertProjectRoot();

  const targetRel = 'apps/web/app/dashboard/offers/[id]/pdf/page.tsx';
  const sourceRel = 'apps/web/app/dashboard/offers/[id]/pdf/page.tsx.patch-source';
  const target = file(targetRel);
  const source = file(sourceRel);

  if (!fs.existsSync(source)) {
    throw new Error(`Nie znaleziono pliku patcha: ${sourceRel}. Najpierw rozpakuj ZIP w katalogu głównym projektu.`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  backup(targetRel);
  fs.copyFileSync(source, target);
  fs.unlinkSync(source);

  console.log(`✅ Podmieniono: ${targetRel}`);
  console.log('\nZmiany:');
  console.log('- wymuszone drukowanie kolorów/tła w PDF oferty');
  console.log('- usunięte podpisy z oferty');
  console.log('- stopka: „Ofertę wygenerowano w systemie EventFlow”');
  console.log('\nGotowe. Wyczyść cache frontu i uruchom web ponownie.');
}

try {
  main();
} catch (error) {
  console.error('\n❌ Błąd patcha:');
  console.error(error?.message || error);
  process.exit(1);
}
