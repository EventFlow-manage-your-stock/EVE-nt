import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PakietyController } from './pakiety.controller';
import { PakietyService } from './pakiety.service';

@Module({
  imports: [PrismaModule],
  controllers: [PakietyController],
  providers: [PakietyService],
  exports: [PakietyService],
})
export class PakietyModule {}