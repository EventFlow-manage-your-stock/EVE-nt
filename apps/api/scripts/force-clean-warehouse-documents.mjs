#!/usr/bin/env node

import { Client } from 'pg';
import readline from 'node:readline';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Brak DATABASE_URL');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

async function getTables(client) {
  const res = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `);

  return res.rows.map((r) => r.table_name);
}

async function countRows(client, table) {
  const res = await client.query(`select count(*)::int as count from "${table}"`);
  return res.rows[0].count;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('\n=== EventFlow: czyszczenie zakładki Niezwrócony sprzęt ===\n');

  const allTables = await getTables(client);

  const exactPreferred = [
    'pozycje_wydan_magazynowych',
    'wydania_magazynowe',
    'pozycje_wydania_magazynowego',
    'wydanie_magazynowe',
    'pozycje_dokumentow_magazynowych',
    'dokumenty_magazynowe',
    'pozycje_przyjec_magazynowych',
    'przyjecia_magazynowe',
    'zwroty_magazynowe',
    'pozycje_zwrotow_magazynowych',
  ];

  const protectedPatterns = [
    'model',
    'egzemplarz',
    'egzemplarze',
    'kategoria',
    'kategorie',
    'organizacja',
    'organizacje',
    'uzytkownik',
    'uzytkownicy',
    'wydarzenie',
    'wydarzenia',
    'pozycje_sprzetu_wydarzen',
    'wynajem',
    'wynajmy',
    'oferta',
    'oferty',
  ];

  const keywordPatterns = [
    'wydan_magazyn',
    'wydania_magazyn',
    'wydanie_magazyn',
    'pozycje_wydan',
    'dokumenty_magazyn',
    'pozycje_dokumentow_magazyn',
    'przyjecia_magazyn',
    'przyjecie_magazyn',
    'pozycje_przyjec',
    'zwroty_magazyn',
    'pozycje_zwrotow',
  ];

  const candidateSet = new Set();

  for (const table of exactPreferred) {
    if (allTables.includes(table)) candidateSet.add(table);
  }

  for (const table of allTables) {
    const lower = table.toLowerCase();

    const protectedTable = protectedPatterns.some((p) => lower.includes(p));
    if (protectedTable) continue;

    const looksLikeWarehouseDoc = keywordPatterns.some((p) => lower.includes(p));
    if (looksLikeWarehouseDoc) candidateSet.add(table);
  }

  const candidates = [...candidateSet];

  if (!candidates.length) {
    console.log('Nie znalazłem tabel dokumentów magazynowych po nazwach.');
    console.log('\nTabele w bazie zawierające magazyn/wydan/przyjec/zwrot/dokument:');

    const similar = allTables.filter((t) => {
      const x = t.toLowerCase();
      return (
        x.includes('magazyn') ||
        x.includes('wydan') ||
        x.includes('przyjec') ||
        x.includes('zwrot') ||
        x.includes('dokument')
      );
    });

    console.table(similar.map((table) => ({ table })));
    await client.end();
    return;
  }

  const previewRows = [];

  for (const table of candidates) {
    previewRows.push({
      table,
      count: await countRows(client, table),
    });
  }

  console.log('Tabele, które będą czyszczone:\n');
  console.table(previewRows);

  console.log('\nTo czyści historię WZ/PZ/zwrotów, czyli źródło zakładki Niezwrócony sprzęt.');
  console.log('Nie czyści modeli, egzemplarzy, case, kategorii, wydarzeń, wynajmów ani ofert.');

  const answer = await ask('\nJeśli chcesz kontynuować, wpisz dokładnie: WYCZYSC NIEZWROCONY\n> ');

  if (answer !== 'WYCZYSC NIEZWROCONY') {
    console.log('\nPrzerwano. Nic nie zmieniono.');
    await client.end();
    return;
  }

  await client.query('begin');

  try {
    for (const table of candidates) {
      console.log(`Czyszczę: ${table}`);
      await client.query(`truncate table "${table}" restart identity cascade`);
    }

    await client.query('commit');

    console.log('\n✅ Wyczyściłem dokumenty magazynowe WZ/PZ/zwroty.');
    console.log('Zakładka Niezwrócony sprzęt powinna być pusta po restarcie API/frontendu.');
  } catch (err) {
    await client.query('rollback');

    console.error('\n❌ Błąd, cofnięto zmiany:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().finally(() => {
  rl.close();
});
