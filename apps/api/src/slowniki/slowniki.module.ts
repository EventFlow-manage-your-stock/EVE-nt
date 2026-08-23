import { Module } from '@nestjs/common';
import { SlownikiController } from './slowniki.controller';
import { SlownikiService } from './slowniki.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SlownikiController],
  providers: [SlownikiService],
  exports: [SlownikiService],
})
export class SlownikiModule {}