import { Module } from '@nestjs/common';
import { SerwisController } from './serwis.controller';
import { SerwisService } from './serwis.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SerwisController],
  providers: [SerwisService],
})
export class SerwisModule {}