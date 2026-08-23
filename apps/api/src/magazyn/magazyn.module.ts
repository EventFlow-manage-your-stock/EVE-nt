import { Module } from '@nestjs/common';
import { MagazynController } from './magazyn.controller';
import { MagazynService } from './magazyn.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MagazynController],
  providers: [MagazynService],
  exports: [MagazynService],
})
export class MagazynModule {}