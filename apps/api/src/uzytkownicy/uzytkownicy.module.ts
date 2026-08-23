import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UzytkownicyController } from './uzytkownicy.controller';
import { UzytkownicyService } from './uzytkownicy.service';
@Module({ imports: [PrismaModule], controllers: [UzytkownicyController], providers: [UzytkownicyService] })
export class UzytkownicyModule {}
