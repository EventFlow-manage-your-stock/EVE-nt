import { Module } from '@nestjs/common';
import { MagazynController } from './magazyn.controller';
import { MagazynService } from './magazyn.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MagazynyCrudController } from './magazyn-crud.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MagazynController, MagazynyCrudController],
  providers: [MagazynService],
  exports: [MagazynService],
})
export class MagazynModule {}