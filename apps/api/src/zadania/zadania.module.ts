import { Module } from '@nestjs/common';
import { ZadaniaController } from './zadania.controller';
import { ZadaniaService } from './zadania.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ZadaniaController],
  providers: [ZadaniaService],
})
export class ZadaniaModule {}