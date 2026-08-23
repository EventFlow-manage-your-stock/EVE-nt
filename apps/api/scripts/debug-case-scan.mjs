#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const code = process.argv[2];

if (!code) {
  console.error('Użycie: node apps/api/scripts/debug-case-scan.mjs CASE-...');
  process.exit(1);
}

function pick(obj, keys) {
  for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  return null;
}

async function main() {
  const caseRows = await prisma.$queryRawUnsafe(`
    select e.*, m.nazwa as model_nazwa, m.typ_sprzetu as model_typ_sprzetu
    from egzemplarze e
    left join modele m on m.id = e.id_modelu
    where e.kod_kreskowy = $1
       or e.zewnetrzny_kod_kreskowy = $1
       or e.zewnetrzny_qr_kod = $1
       or e.qr_kod = $1
       or e.sn = $1
       or e.numer_egzemplarza = $1
    order by e.id asc
    limit 10
  `, code).catch(async () => []);

  if (!caseRows.length) {
    console.log('Nie znalazłem egzemplarza/case dla kodu:', code);
    return;
  }

  for (const c of caseRows) {
    const caseId = Number(c.id);
    console.log('\n=== Zeskanowany obiekt ===');
    console.table([{ id: c.id, nazwa: c.nazwa, model: c.model_nazwa, typ: c.model_typ_sprzetu, kod: c.kod_kreskowy, id_case: c.id_case }]);

    const contents = await prisma.$queryRawUnsafe(`
      select e.id, e.nazwa, e.numer_egzemplarza, e.kod_kreskowy, e.sn, e.id_case,
             m.id as id_modelu, m.nazwa as model_nazwa, m.typ_sprzetu as model_typ_sprzetu
      from egzemplarze e
      left join modele m on m.id = e.id_modelu
      where e.id_case = $1
      order by m.nazwa asc nulls last, e.nazwa asc nulls last, e.id asc
    `, caseId).catch(async () => []);

    console.log('\n=== Zawartość case wg bazy ===');
    if (!contents.length) console.log('Brak pozycji w środku.');
    else console.table(contents.map((x) => ({
      id: x.id,
      model: x.model_nazwa,
      nazwa: x.nazwa,
      numer: x.numer_egzemplarza,
      kod: x.kod_kreskowy,
      typ: x.model_typ_sprzetu,
      id_case: x.id_case,
    })));

    console.log('\nJeśli widzisz tu 3 laptopy, a fizycznie w case są 2, problem jest w danych case w bazie, nie w skanerze.');
    console.log('Błędny egzemplarz można wypiąć z case komendą SQL: update egzemplarze set id_case = null where id = <ID>;');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
