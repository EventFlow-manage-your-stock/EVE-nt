const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function extractNumberFromFileName(fileName) {
  const match = fileName.match(/magazyn\s*\(?(\d+)\)?/i);
  if (!match) return 0;
  return Number(match[1]);
}

function sortMagazynFiles(files) {
  return files.sort((a, b) => {
    const aNum = extractNumberFromFileName(a);
    const bNum = extractNumberFromFileName(b);

    if (aNum !== bNum) return aNum - bNum;

    return a.localeCompare(b, 'pl');
  });
}

async function wybierzOrganizacje() {
  const organizacje = await prisma.organizacja.findMany({
    select: {
      id: true,
      nazwa: true,
      subdomena: true,
      nip: true,
      email: true,
      aktywny: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (organizacje.length === 0) {
    throw new Error('Brak organizacji w bazie.');
  }

  console.log('\nDostępne organizacje:\n');
  console.table(organizacje);

  const answer = await ask('Wpisz ID organizacji, do której importować magazyn/sprzęt: ');
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

async function main() {
  console.log('\n=== EventFlow: import wszystkich plików magazynu ===\n');

  const importerPath = path.join(process.cwd(), 'scripts', 'import-sprzet-case-excel.mjs');

  if (!fs.existsSync(importerPath)) {
    throw new Error(`Nie znaleziono importera: ${importerPath}`);
  }

  const organizacja = await wybierzOrganizacje();

  const dir = path.join(process.cwd(), 'import', 'data', 'magazyn');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const files = sortMagazynFiles(
    fs
      .readdirSync(dir)
      .filter((file) => {
        const lower = file.toLowerCase();

        return (
          lower.startsWith('magazyn') &&
          !lower.startsWith('~$') &&
          (
            lower.endsWith('.xlsx') ||
            lower.endsWith('.xls') ||
            lower.endsWith('.csv')
          )
        );
      })
  );

  if (files.length === 0) {
    console.log('\nNie znaleziono plików magazynu.');
    console.log(`Wrzuć pliki tutaj:\n${dir}`);
    console.log('\nPrzykładowe nazwy:');
    console.log('magazyn.xlsx');
    console.log('magazyn (1).xlsx');
    console.log('magazyn (2).xlsx');
    return;
  }

  console.log('\nZnalezione pliki do importu:\n');
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  const dryRunAnswer = await ask('\nCzy najpierw zrobić test bez zapisu do bazy? TAK/NIE [TAK]: ');
  const dryRun = dryRunAnswer.trim().toUpperCase() !== 'NIE';

  console.log('\nTryb importu:');
  console.log(`Organizacja ID: ${organizacja.id}`);
  console.log(`Test bez zapisu: ${dryRun ? 'TAK' : 'NIE'}`);
  console.log('Sprzęt ilościowy: TAK, tryb pseudo');
  console.log('Case content: create');

  const confirm = await ask('\nAby kontynuować wpisz: IMPORTUJ\n> ');

  if (confirm !== 'IMPORTUJ') {
    console.log('\nPrzerwano. Nic nie zaimportowano.');
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);

    console.log('\n====================================');
    console.log(`Import pliku: ${file}`);
    console.log('====================================\n');

    const args = [
      importerPath,
      '--file',
      fullPath,
      '--org',
      String(organizacja.id),
      '--ilosciowe-mode',
      'pseudo',
      '--case-content',
      'create',
    ];

    if (dryRun) {
      args.push('--dry-run');
    }

    const result = spawnSync('node', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    if (result.status !== 0) {
      throw new Error(`Import zatrzymany na pliku: ${file}`);
    }
  }

  console.log('\n✅ Import wszystkich plików zakończony.');
  console.log('\nUwaga: jeśli uruchomiłeś tryb testowy, dane NIE zostały zapisane.');
  console.log('Aby zapisać dane, uruchom skrypt ponownie i przy pytaniu o test wpisz: NIE');
}

main()
  .catch((error) => {
    console.error('\n❌ Błąd importu:');
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
