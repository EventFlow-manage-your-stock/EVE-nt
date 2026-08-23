#!/usr/bin/env node
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const code = process.argv[2];

if (!DATABASE_URL) {
  console.error('Brak DATABASE_URL.');
  process.exit(1);
}

if (!code) {
  console.error('Użycie: node apps/api/scripts/fix-case-code-content.mjs 0100000000489');
  process.exit(1);
}

const norm = (v) => String(v ?? '').trim();
const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();

  console.log(`\n=== EventFlow: naprawa zawartości case dla kodu ${code} ===\n`);

  const caseRes = await client.query(`
    select e.id, e.nazwa, e.numer_egzemplarza, e.numer_urzadzenia, e.kod_kreskowy, e.sn,
           m.nazwa as model_nazwa, m.typ_sprzetu
    from egzemplarze e
    join modele m on m.id = e.id_modelu
    where e.data_usuniecia is null
      and (
        e.kod_kreskowy = $1
        or e.numer_egzemplarza = $1
        or e.numer_urzadzenia = $1
        or e.sn = $1
        or e.qr_kod = $1
        or e.zewnetrzny_kod_kreskowy = $1
        or e.zewnetrzny_qr_kod = $1
      )
    order by case when m.typ_sprzetu = 'opakowanie' then 0 else 1 end, e.id
  `, [code]);

  if (!caseRes.rows.length) {
    console.log('Nie znalazłem egzemplarza/case po tym kodzie.');
    return;
  }

  console.log('Znalezione rekordy po kodzie:');
  console.table(caseRes.rows);

  const caseRow = caseRes.rows.find((r) => r.typ_sprzetu === 'opakowanie') || caseRes.rows[0];
  console.log(`\nUżywam jako case: id=${caseRow.id}, model=${caseRow.model_nazwa}, typ=${caseRow.typ_sprzetu}`);

  const contentRes = await client.query(`
    select e.id, e.nazwa, e.numer_egzemplarza, e.numer_urzadzenia, e.kod_kreskowy, e.sn,
           m.nazwa as model_nazwa, m.typ_sprzetu
    from egzemplarze e
    join modele m on m.id = e.id_modelu
    where e.id_case = $1
      and e.data_usuniecia is null
    order by e.id
  `, [caseRow.id]);

  console.log('\nAktualna zawartość case:');
  console.table(contentRes.rows);

  const badRows = contentRes.rows.filter((r) => [
    r.numer_egzemplarza,
    r.numer_urzadzenia,
    r.kod_kreskowy,
    r.sn,
  ].map(norm).includes(norm(code)) || Number(r.id) === Number(caseRow.id));

  if (!badRows.length) {
    console.log('\nNie znalazłem błędnej pozycji z kodem case w zawartości. Frontendowy filtr powinien wystarczyć.');
    return;
  }

  console.log('\nBłędne pozycje do wypięcia z case:');
  console.table(badRows);

  const ids = badRows.map((r) => r.id);
  await client.query('begin');
  try {
    await client.query(`update egzemplarze set id_case = null, data_aktualizacji = now() where id = any($1::int[])`, [ids]);
    await client.query('commit');
    console.log(`\n✅ Wypięto z case ${ids.length} błędnych pozycji: ${ids.join(', ')}`);
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Błąd:');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
