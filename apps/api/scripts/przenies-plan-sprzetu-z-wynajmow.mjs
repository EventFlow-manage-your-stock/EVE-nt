import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const technicalRentals = await prisma.wynajem.findMany({
    where: {
      aktywny: true,
      numer: { startsWith: 'SPRZET-EVENT' },
      id_wydarzenia: { not: null },
    },
    include: { pozycje: { where: { aktywny: true } } },
  });

  let moved = 0;
  let rentalsClosed = 0;

  for (const rental of technicalRentals) {
    const id_wydarzenia = rental.id_wydarzenia;
    if (!id_wydarzenia) continue;

    const byModel = new Map();
    for (const p of rental.pozycje || []) {
      if (!p.id_modelu) continue;
      byModel.set(p.id_modelu, (byModel.get(p.id_modelu) || 0) + Number(p.ilosc || 0));
    }

    let kolejnosc = 1;
    for (const [id_modelu, ilosc] of byModel.entries()) {
      if (ilosc <= 0) continue;
      const existing = await prisma.pozycjaSprzetuWydarzenia.findFirst({
        where: { id_organizacji: rental.id_organizacji, id_wydarzenia, id_modelu },
      });

      if (existing) {
        await prisma.pozycjaSprzetuWydarzenia.update({
          where: { id: existing.id },
          data: {
            ilosc_planowana: ilosc,
            aktywny: true,
            data_usuniecia: null,
            uwagi: `Przeniesiono ze starego technicznego wynajmu ${rental.numer || rental.id}`,
            kolejnosc,
          },
        });
      } else {
        await prisma.pozycjaSprzetuWydarzenia.create({
          data: {
            id_organizacji: rental.id_organizacji,
            id_wydarzenia,
            id_modelu,
            ilosc_planowana: ilosc,
            uwagi: `Przeniesiono ze starego technicznego wynajmu ${rental.numer || rental.id}`,
            kolejnosc,
          },
        });
      }
      moved++;
      kolejnosc++;
    }

    await prisma.pozycjaWynajmu.updateMany({
      where: { id_wynajmu: rental.id, aktywny: true },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
    await prisma.wynajem.update({
      where: { id: rental.id },
      data: { aktywny: false, data_usuniecia: new Date(), notatki_wewnetrzne: `${rental.notatki_wewnetrzne || ''}\n[V32] Techniczny plan sprzętu przeniesiony do pozycje_sprzetu_wydarzen.`.trim() },
    });
    rentalsClosed++;
  }

  console.log(`Przeniesiono pozycji planu: ${moved}`);
  console.log(`Zamknięto technicznych wynajmów SPRZET-EVENT: ${rentalsClosed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
