import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UrlopyController } from './urlopy.controller';
import { UrlopyService } from './urlopy.service';
@Module({ imports: [PrismaModule], controllers: [UrlopyController], providers: [UrlopyService] })
export class UrlopyModule {}
