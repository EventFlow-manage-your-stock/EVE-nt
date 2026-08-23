import { Module } from '@nestjs/common';
import { WydarzeniaService } from './wydarzenia.service';
import { WydarzeniaController } from './wydarzenia.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Dostosuj ścieżkę

@Module({
  imports: [PrismaModule],
  controllers: [WydarzeniaController],
  providers: [WydarzeniaService],
})
export class WydarzeniaModule {}