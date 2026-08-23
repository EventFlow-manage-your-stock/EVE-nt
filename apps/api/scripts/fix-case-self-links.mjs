#!/usr/bin/env node

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Brak DATABASE_URL.');
  process.exit(1);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = $2
    ) as exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log('\n=== EventFlow: naprawa self-linków case ===\n');

    const tableCandidates = ['egzemplarze', 'egzemplarz'];
    let table = null;

    for (const candidate of tableCandidates) {
      if (await tableExists(client, candidate)) {
        table = candidate;
        break;
      }
    }

    if (!table) {
      console.log('Nie znalazłem tabeli egzemplarzy. Nic nie zmieniono.');
      return;
    }

    const hasIdCase = await columnExists(client, table, 'id_case');
    if (!hasIdCase) {
      console.log(`Tabela ${table} nie ma kolumny id_case. Nic nie zmieniono.`);
      return;
    }

    const preview = await client.query(`select id, nazwa, kod_kreskowy, id_case from "${table}" where id_case = id order by id limit 50`);
    const count = await client.query(`select count(*)::int as count from "${table}" where id_case = id`);

    console.log(`Tabela: ${table}`);
    console.log(`Self-linków case do usunięcia: ${count.rows[0]?.count || 0}`);

    if (preview.rows.length) {
      console.table(preview.rows);
    }

    if (!Number(count.rows[0]?.count || 0)) {
      console.log('\n✅ Brak self-linków. Baza wygląda OK.');
      return;
    }

    await client.query('begin');
    const updated = await client.query(`update "${table}" set id_case = null where id_case = id`);
    await client.query('commit');

    console.log(`\n✅ Usunięto self-linki case: ${updated.rowCount}`);
    console.log('Case dalej istnieje, ale nie będzie już własną zawartością.');
  } catch (err) {
    try { await client.query('rollback'); } catch {}
    console.error('\n❌ Błąd cleanupu:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
