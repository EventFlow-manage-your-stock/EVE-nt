import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlotaController } from './flota.controller';
import { FlotaService } from './flota.service';
@Module({ imports: [PrismaModule], controllers: [FlotaController], providers: [FlotaService] })
export class FlotaModule {}
