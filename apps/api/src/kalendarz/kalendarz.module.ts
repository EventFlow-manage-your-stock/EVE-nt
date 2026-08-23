import { Module } from '@nestjs/common';
import { KalendarzController } from './kalendarz.controller';
import { KalendarzService } from './kalendarz.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [KalendarzController], providers: [KalendarzService] })
export class KalendarzModule {}
