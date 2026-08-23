import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ZapytaniaController } from './zapytania.controller';
import { ZapytaniaService } from './zapytania.service';

@Module({
  imports: [PrismaModule],
  controllers: [ZapytaniaController],
  providers: [ZapytaniaService],
})
export class ZapytaniaModule {}