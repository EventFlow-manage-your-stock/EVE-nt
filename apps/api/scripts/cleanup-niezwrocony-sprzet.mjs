#!/usr/bin/env node

import { Client } from 'pg';
import readline from 'node:readline';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Brak DATABASE_URL.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

async function tableExists(client, tableName) {
  const res = await client.query(
    `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
      and table_name = $1
    ) as exists
    `,
    [tableName]
  );

  return Boolean(res.rows[0]?.exists);
}

async function countRows(client, tableName) {
  const res = await client.query(`select count(*)::int as count from "${tableName}"`);
  return res.rows[0]?.count ?? 0;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('\n=== EventFlow: czyszczenie zakładki Niezwrócony sprzęt ===\n');

  const candidates = [
    'pozycje_wydan_magazynowych',
    'wydania_magazynowe',
    'pozycje_wydania_magazynowego',
    'wydanie_magazynowe',
    'pozycje_dokumentow_magazynowych',
    'dokumenty_magazynowe',
  ];

  const existing = [];

  for (const table of candidates) {
    if (await tableExists(client, table)) {
      existing.push(table);
    }
  }

  if (existing.length === 0) {
    console.log('Nie znalazłem standardowych tabel WZ/PZ.');
    console.log('Tabele podobne do magazyn/wydan:');

    const res = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      and (
        table_name ilike '%wydan%'
        or table_name ilike '%magazyn%'
        or table_name ilike '%dokument%'
      )
      order by table_name
    `);

    console.table(res.rows);
    await client.end();
    return;
  }

  console.log('Znalezione tabele do czyszczenia:\n');

  for (const table of existing) {
    const count = await countRows(client, table);
    console.log(`- ${table}: ${count} rekordów`);
  }

  console.log('\nTo wyczyści historię WZ/PZ, czyli źródło zakładki Niezwrócony sprzęt.');
  console.log('Nie rusza modeli, egzemplarzy, kategorii ani opakowań/case.');

  const answer = await ask('\nŻeby wyczyścić wpisz dokładnie: WYCZYSC NIEZWROCONY\n> ');

  if (answer !== 'WYCZYSC NIEZWROCONY') {
    console.log('\nPrzerwano. Nic nie zmieniono.');
    await client.end();
    return;
  }

  await client.query('begin');

  try {
    const ordered = [
      'pozycje_wydan_magazynowych',
      'pozycje_wydania_magazynowego',
      'pozycje_dokumentow_magazynowych',
      'wydania_magazynowe',
      'wydanie_magazynowe',
      'dokumenty_magazynowe',
    ].filter((table) => existing.includes(table));

    for (const table of ordered) {
      console.log(`Czyszczę: ${table}`);
      await client.query(`delete from "${table}"`);
    }

    await client.query('commit');
    console.log('\n✅ Wyczyściłem dokumenty WZ/PZ. Zakładka Niezwrócony sprzęt powinna być pusta.');
  } catch (error) {
    await client.query('rollback');
    console.error('\n❌ Błąd, cofnięto zmiany:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().finally(() => {
  rl.close();
});
