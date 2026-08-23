const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function q(sql, ...params) {
  return prisma.$queryRawUnsafe(sql, ...params);
}

async function e(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

async function tableExists(tableName) {
  const rows = await q(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    ) AS exists
    `,
    tableName
  );

  return rows[0].exists === true;
}

async function safeCount(tableName, idOrganizacji) {
  if (!(await tableExists(tableName))) return 0;

  const rows = await q(
    `SELECT COUNT(*)::int AS count FROM ${tableName} WHERE id_organizacji = $1`,
    idOrganizacji
  );

  return rows[0].count;
}

async function safeExec(label, sql, idOrganizacji) {
  try {
    const count = await e(sql, idOrganizacji);
    console.log(`${label}: ${count}`);
    return count;
  } catch (error) {
    console.log(`${label}: pominięto / błąd: ${error.message}`);
    return 0;
  }
}

async function wybierzOrganizacje() {
  const organizacje = await q(`
    SELECT id, nazwa, subdomena, nip, email, aktywny
    FROM organizacje
    ORDER BY id ASC
  `);

  if (organizacje.length === 0) {
    throw new Error('Brak organizacji w bazie.');
  }

  console.log('\nDostępne organizacje:\n');
  console.table(organizacje);

  const answer = await ask('Wpisz ID organizacji, z której usunąć sprzęt/case’y: ');
  const idOrganizacji = Number(answer);

  if (!Number.isInteger(idOrganizacji) || idOrganizacji <= 0) {
    throw new Error('Nieprawidłowe ID organizacji.');
  }

  const organizacja = organizacje.find((org) => org.id === idOrganizacji);

  if (!organizacja) {
    throw new Error(`Nie znaleziono organizacji o ID ${idOrganizacji}.`);
  }

  console.log(`\nWybrano organizację: ${organizacja.nazwa} / ID ${organizacja.id}\n`);

  return organizacja;
}

async function pokazLiczniki(idOrganizacji) {
  const counts = {
    magazyny: await safeCount('magazyny', idOrganizacji),
    modele: await safeCount('modele', idOrganizacji),
    egzemplarze: await safeCount('egzemplarze', idOrganizacji),
    ceny_modeli: await safeCount('ceny_modeli', idOrganizacji),
    ceny_sprzetu: await safeCount('ceny_sprzetu', idOrganizacji),
    pozycje_wynajmu: await safeCount('pozycje_wynajmu', idOrganizacji),
    wydania_magazynowe: await safeCount('wydania_magazynowe', idOrganizacji),
    pozycje_wydan_magazynowych: await safeCount('pozycje_wydan_magazynowych', idOrganizacji),
    serwisy_sprzetu: await safeCount('serwisy_sprzetu', idOrganizacji),
  };

  console.table(counts);
}

async function main() {
  console.log('\n=== EventFlow: czyszczenie sprzętu i case’ów ===\n');

  const organizacja = await wybierzOrganizacje();
  const idOrganizacji = organizacja.id;

  console.log('Rekordy przed czyszczeniem:\n');
  await pokazLiczniki(idOrganizacji);

  console.log('\nUsuniemy:');
  console.log('- pozycje wynajmu');
  console.log('- wydania magazynowe i pozycje wydań');
  console.log('- serwisy sprzętu');
  console.log('- egzemplarze, w tym case’y');
  console.log('- modele sprzętu');
  console.log('- ceny modeli i ceny sprzętu');
  console.log('\nZostają: organizacje, kontrahenci, wydarzenia, wynajmy, kategorie.');

  const confirm = await ask('\nAby kontynuować wpisz dokładnie: USUN SPRZET\n> ');

  if (confirm !== 'USUN SPRZET') {
    console.log('\nPrzerwano. Nic nie usunięto.');
    return;
  }

  console.log('\nCzyszczę dane...\n');

  await safeExec(
    'Odłączono pozycje ofert od sprzętu',
    `
    UPDATE pozycje_oferty
    SET id_modelu = NULL,
        id_ceny_sprzetu = NULL
    WHERE id_organizacji = $1
      AND (id_modelu IS NOT NULL OR id_ceny_sprzetu IS NOT NULL)
    `,
    idOrganizacji
  );

  await safeExec(
    'Odłączono zadania od egzemplarzy',
    `
    UPDATE zadania
    SET id_egzemplarza = NULL
    WHERE id_organizacji = $1
      AND id_egzemplarza IS NOT NULL
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto pozycje wydań magazynowych',
    `
    DELETE FROM pozycje_wydan_magazynowych
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto wydania magazynowe',
    `
    DELETE FROM wydania_magazynowe
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto pozycje wynajmu',
    `
    DELETE FROM pozycje_wynajmu
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto serwisy sprzętu',
    `
    DELETE FROM serwisy_sprzetu
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Rozłączono egzemplarze z case’ów',
    `
    UPDATE egzemplarze
    SET id_case = NULL
    WHERE id_organizacji = $1
      AND id_case IS NOT NULL
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto egzemplarze',
    `
    DELETE FROM egzemplarze
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto ceny sprzętu',
    `
    DELETE FROM ceny_sprzetu
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto ceny modeli',
    `
    DELETE FROM ceny_modeli
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  await safeExec(
    'Usunięto modele sprzętu',
    `
    DELETE FROM modele
    WHERE id_organizacji = $1
    `,
    idOrganizacji
  );

  console.log('\nRekordy po czyszczeniu:\n');
  await pokazLiczniki(idOrganizacji);

  console.log('\n✅ Czyszczenie zakończone.');
}

main()
  .catch((error) => {
    console.error('\n❌ Błąd czyszczenia:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
