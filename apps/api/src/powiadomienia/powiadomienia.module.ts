import { Module } from '@nestjs/common';
import { PowiadomieniaController } from './powiadomienia.controller';
import { PowiadomieniaService } from './powiadomienia.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PowiadomieniaController],
  providers: [PowiadomieniaService],
  exports: [PowiadomieniaService],
})
export class PowiadomieniaModule {}