import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfertyController } from './oferty.controller';
import { OfertyService } from './oferty.service';
@Module({ imports: [PrismaModule], controllers: [OfertyController], providers: [OfertyService] })
export class OfertyModule {}
