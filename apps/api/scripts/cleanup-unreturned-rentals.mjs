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

function getModelFields(modelName) {
  return prisma._runtimeDataModel?.models?.[modelName]?.fields?.map((f) => f.name) || [];
}

function hasField(fields, name) {
  return fields.includes(name);
}

function pickFirst(fields, candidates) {
  return candidates.find((field) => hasField(fields, field)) || null;
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

async function main() {
  console.log('\n=== EventFlow: czyszczenie zakładki Niezwrócony sprzęt ===\n');

  if (!prisma.wynajem) {
    throw new Error('Brak modelu prisma.wynajem. Sprawdź schema.prisma.');
  }

  const fields = getModelFields('Wynajem');

  console.log('Pola modelu Wynajem:');
  console.log(fields.join(', '));
  console.log('');

  const realReturnField = pickFirst(fields, [
    'data_zwrotu_rzeczywista',
    'rzeczywista_data_zwrotu',
    'data_rzeczywistego_zwrotu',
    'data_faktycznego_zwrotu',
  ]);

  const plannedReturnField = pickFirst(fields, [
    'data_zwrotu_planowana',
    'planowana_data_zwrotu',
    'data_planowanego_zwrotu',
    'data_do',
    'koniec',
  ]);

  const activeField = pickFirst(fields, ['aktywny']);
  const deletedField = pickFirst(fields, ['data_usuniecia']);
  const updatedField = pickFirst(fields, ['data_aktualizacji']);
  const numberField = pickFirst(fields, ['numer', 'numer_wynajmu', 'kod']);
  const nameField = pickFirst(fields, ['nazwa', 'tytul', 'opis']);
  const contractorField = pickFirst(fields, ['id_kontrahenta']);

  if (!realReturnField) {
    throw new Error(
      'Nie znalazłem pola rzeczywistej daty zwrotu w modelu Wynajem. Podeślij pola wypisane wyżej.'
    );
  }

  const where = {
    [realReturnField]: null,
  };

  if (activeField) where[activeField] = true;
  if (deletedField) where[deletedField] = null;

  const wynajmy = await prisma.wynajem.findMany({
    where,
    orderBy: {
      id: 'asc',
    },
    take: 5000,
  });

  console.log(`Znalezione wynajmy widoczne jako niezwrócone: ${wynajmy.length}\n`);

  if (!wynajmy.length) {
    console.log('Nie ma czego czyścić. Zakładka powinna być pusta po odświeżeniu frontu.');
    return;
  }

  console.table(
    wynajmy.slice(0, 80).map((w) => ({
      id: w.id,
      numer: numberField ? safeText(w[numberField]) : '',
      nazwa: nameField ? safeText(w[nameField]).slice(0, 60) : '',
      kontrahent: contractorField ? w[contractorField] : '',
      planowany_zwrot: plannedReturnField ? w[plannedReturnField] : '',
      rzeczywisty_zwrot: w[realReturnField],
    }))
  );

  if (wynajmy.length > 80) {
    console.log(`\nPokazałem pierwsze 80 z ${wynajmy.length}.`);
  }

  console.log('\nTo NIE usuwa wynajmów. Tylko wpisuje rzeczywistą datę zwrotu, żeby zniknęły z zakładki Niezwrócony sprzęt.');

  const answer = await ask('\nJeśli chcesz kontynuować, wpisz dokładnie: OZNACZ JAKO ZWROCONE\n> ');

  if (answer !== 'OZNACZ JAKO ZWROCONE') {
    console.log('\nPrzerwano. Nic nie zmieniono.');
    return;
  }

  let updated = 0;

  for (const w of wynajmy) {
    const returnDate =
      plannedReturnField && w[plannedReturnField]
        ? new Date(w[plannedReturnField])
        : new Date();

    const data = {
      [realReturnField]: returnDate,
    };

    if (updatedField) {
      data[updatedField] = new Date();
    }

    await prisma.wynajem.update({
      where: {
        id: w.id,
      },
      data,
    });

    updated += 1;
  }

  console.log(`\n✅ Oznaczono jako zwrócone: ${updated} wynajmów.`);
  console.log('Odśwież zakładkę Niezwrócony sprzęt. Powinna być pusta.');
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
