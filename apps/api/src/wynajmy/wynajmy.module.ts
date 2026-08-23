import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WynajmyController } from './wynajmy.controller';
import { WynajmyService } from './wynajmy.service';

@Module({ imports: [PrismaModule], controllers: [WynajmyController], providers: [WynajmyService] })
export class WynajmyModule {}
