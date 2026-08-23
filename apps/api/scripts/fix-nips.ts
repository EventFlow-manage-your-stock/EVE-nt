import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Rozpoczynam audyt i czyszczenie NIP-ów...');

  // 1. Pobierz wszystkich kontrahentów
  const wszyscyKontrahenci = await prisma.kontrahent.findMany();
  
  let emptyFixed = 0;
  let dupsFixed = 0;

  // 2. Zamiana pustych stringów (lub samych spacji) na NULL
  for (const k of wszyscyKontrahenci) {
    if (k.nip !== null && k.nip.trim() === '') {
      await prisma.kontrahent.update({
        where: { id: k.id },
        data: { nip: null }
      });
      emptyFixed++;
    }
  }

  // 3. Wyszukiwanie faktycznych duplikatów
  const zaktualizowani = await prisma.kontrahent.findMany({
    where: { nip: { not: null } }
  });

  // Grupujemy w pamięci, aby ominąć ograniczenia middleware Prisma przy surowych logikach
  const byNip = new Map<string, typeof zaktualizowani>();
  
  for (const k of zaktualizowani) {
    const klucz = `${k.id_organizacji}_${k.nip}`;
    if (!byNip.has(klucz)) byNip.set(klucz, []);
    byNip.get(klucz)!.push(k);
  }

  for (const [klucz, rekordy] of byNip.entries()) {
    if (rekordy.length > 1) {
      // Sortujemy po dacie utworzenia, by zostawić najstarszy, oryginalny rekord
      rekordy.sort((a, b) => a.data_utworzenia.getTime() - b.data_utworzenia.getTime());
      
      // Pierwszy zostaje, resztę czyścimy (przenosząc NIP do uwag)
      for (let i = 1; i < rekordy.length; i++) {
        const dup = rekordy[i];
        const noweUwagi = dup.uwagi 
          ? `${dup.uwagi}\n[System]: Usunięto zduplikowany NIP: ${dup.nip}`
          : `[System]: Usunięto zduplikowany NIP: ${dup.nip}`;
          
        await prisma.kontrahent.update({
          where: { id: dup.id },
          data: { 
            nip: null,
            uwagi: noweUwagi
          }
        });
        console.log(`Usunięto zduplikowany NIP dla ID: ${dup.id} (${dup.nazwa})`);
        dupsFixed++;
      }
    }
  }

  console.log('\n--- PODSUMOWANIE ---');
  console.log(`Zamieniono pustych NIP-ów na NULL: ${emptyFixed}`);
  console.log(`Przeniesiono zduplikowanych NIP-ów do uwag: ${dupsFixed}`);
  console.log('Gotowe! Możesz teraz bezpiecznie uruchomić: npx prisma db push');
}

main()
  .catch(e => {
    console.error('Wystąpił błąd:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });