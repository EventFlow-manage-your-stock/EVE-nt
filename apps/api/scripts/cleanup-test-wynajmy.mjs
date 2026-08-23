#!/usr/bin/env node

import readline from 'node:readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

function hasField(modelName, fieldName) {
  const model = prisma._runtimeDataModel?.models?.[modelName];
  return Boolean(model?.fields?.some((f) => f.name === fieldName));
}

function pickText(item, fields) {
  return fields
    .map((f) => item[f])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

async function main() {
  console.log('\n=== EventFlow: czyszczenie testowych wynajmów ===\n');

  if (!prisma.wynajem) {
    throw new Error('Brak delegata prisma.wynajem — sprawdź nazwę modelu Wynajem w Prisma.');
  }

  const wynajmy = await prisma.wynajem.findMany({
    orderBy: { id: 'asc' },
  });

  const textFields = [
    'numer',
    'nazwa',
    'tytul',
    'opis',
    'uwagi',
    'notatki',
    'notatki_wewnetrzne',
  ].filter((f) => hasField('Wynajem', f));

  const candidates = wynajmy.filter((w) => {
    const text = pickText(w, textFields);

    if (text.includes('sprzet-event')) return true;
    if (text.includes('sprzęt-event')) return true;
    if (text.includes('techniczny')) return true;
    if (text.includes('testowy')) return true;
    if (text.includes('test wynaj')) return true;
    if (text.includes('wynajem test')) return true;

    return false;
  });

  console.log(`Wszystkie wynajmy w bazie: ${wynajmy.length}`);
  console.log(`Znalezione testowe/techniczne do czyszczenia: ${candidates.length}\n`);

  if (candidates.length === 0) {
    console.log('Nie znaleziono testowych wynajmów po bezpiecznych frazach.');
    return;
  }

  console.table(
    candidates.map((w) => ({
      id: w.id,
      numer: w.numer ?? '',
      nazwa: w.nazwa ?? w.tytul ?? '',
      opis: String(w.opis ?? w.uwagi ?? '').slice(0, 80),
      aktywny: w.aktywny,
      data_usuniecia: w.data_usuniecia,
    }))
  );

  const answer = await ask('\nWpisać USUN, żeby oznaczyć te wynajmy jako usunięte: ');

  if (answer !== 'USUN') {
    console.log('\nPrzerwano. Nic nie zmieniono.');
    return;
  }

  const data = {};

  if (hasField('Wynajem', 'aktywny')) data.aktywny = false;
  if (hasField('Wynajem', 'data_usuniecia')) data.data_usuniecia = new Date();
  if (hasField('Wynajem', 'data_aktualizacji')) data.data_aktualizacji = new Date();

  if (Object.keys(data).length === 0) {
    throw new Error('Model Wynajem nie ma pól aktywny/data_usuniecia — nie robię hard delete automatycznie.');
  }

  const ids = candidates.map((w) => w.id);

  const result = await prisma.wynajem.updateMany({
    where: { id: { in: ids } },
    data,
  });

  console.log(`\n✅ Oznaczono jako usunięte: ${result.count} wynajmów.`);

  if (prisma.oferta && hasField('Oferta', 'id_wynajmu')) {
    const offerResult = await prisma.oferta.updateMany({
      where: { id_wynajmu: { in: ids } },
      data: { id_wynajmu: null },
    }).catch(() => null);

    if (offerResult) {
      console.log(`✅ Odpięto oferty od tych wynajmów: ${offerResult.count}`);
    }
  }

  console.log('\nGotowe. To było soft-delete, więc dane są ukryte, ale nie zniszczone fizycznie.');
}

main()
  .catch((err) => {
    console.error('\n❌ Błąd:');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
