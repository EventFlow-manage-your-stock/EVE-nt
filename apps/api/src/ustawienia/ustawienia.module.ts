import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UstawieniaController } from './ustawienia.controller';
import { UstawieniaService } from './ustawienia.service';
@Module({ imports: [PrismaModule], controllers: [UstawieniaController], providers: [UstawieniaService] })
export class UstawieniaModule {}
