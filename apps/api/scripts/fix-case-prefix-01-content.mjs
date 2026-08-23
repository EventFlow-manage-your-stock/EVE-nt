#!/usr/bin/env node
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Brak DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function tableExists(tableName) {
  const res = await client.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as exists
  `, [tableName]);
  return Boolean(res.rows[0]?.exists);
}

async function columns(tableName) {
  const res = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = $1
  `, [tableName]);
  return res.rows.map((r) => r.column_name);
}

function q(name) {
  return '"' + String(name).replaceAll('"', '""') + '"';
}

async function main() {
  await client.connect();

  const table = (await tableExists('egzemplarze')) ? 'egzemplarze' : ((await tableExists('egzemplarz')) ? 'egzemplarz' : null);
  if (!table) {
    console.log('Nie znalazłem tabeli egzemplarze/egzemplarz.');
    return;
  }

  const cols = await columns(table);
  if (!cols.includes('id_case')) {
    console.log(`Tabela ${table} nie ma kolumny id_case.`);
    return;
  }

  const codeCols = [
    'kod_kreskowy',
    'zewnetrzny_kod_kreskowy',
    'qr_kod',
    'zewnetrzny_qr_kod',
    'sn',
    'numer_seryjny',
    'numer_egzemplarza',
    'numer_urzadzenia',
    'kod',
    'numer',
  ].filter((c) => cols.includes(c));

  if (!codeCols.length) {
    console.log(`Nie znalazłem kolumn kodowych w ${table}.`);
    return;
  }

  const prefixWhere = codeCols.map((c) => `regexp_replace(coalesce(${q(c)}::text, ''), '[^0-9A-Za-z]', '', 'g') like '01%'`).join(' or ');

  const preview = await client.query(`
    select id, id_case, ${codeCols.map(q).join(', ')}
    from ${q(table)}
    where id_case is not null and (${prefixWhere})
    order by id
    limit 50
  `);

  console.log('\nEgzemplarze z kodem/numerem zaczynającym się od 01, które siedzą w case:');
  console.table(preview.rows);

  if (!preview.rows.length) {
    console.log('Nie znaleziono błędnych wpisów prefix 01 w zawartości case.');
    return;
  }

  if (process.argv.includes('--apply')) {
    const result = await client.query(`
      update ${q(table)}
      set id_case = null
      where id_case is not null and (${prefixWhere})
    `);
    console.log(`\n✅ Wypięto z case: ${result.rowCount} egzemplarzy z kodami 01...`);
  } else {
    console.log('\nTo był podgląd. Aby realnie wypiąć te wpisy z case, uruchom z parametrem --apply');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Błąd:');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => null);
  });
