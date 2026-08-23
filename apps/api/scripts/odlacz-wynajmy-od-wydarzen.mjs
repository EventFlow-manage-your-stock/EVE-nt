import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const before = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM wynajmy WHERE id_wydarzenia IS NOT NULL');
  const count = Array.isArray(before) ? before[0]?.count ?? 0 : 0;
  await prisma.$executeRawUnsafe('UPDATE wynajmy SET id_wydarzenia = NULL WHERE id_wydarzenia IS NOT NULL');
  console.log(`Odłączono wynajmy od wydarzeń: ${count}`);
  console.log('Od teraz wynajmy są osobnymi bytami. Wydanie sprzętu do wydarzenia obsługuje WZ/PZ.');
} catch (error) {
  console.error('Nie udało się odłączyć wynajmów od wydarzeń.');
  console.error(error?.message || error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
