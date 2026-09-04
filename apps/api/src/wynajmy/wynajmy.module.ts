import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WynajmyController } from './wynajmy.controller';
import { WynajmyService } from './wynajmy.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [WynajmyController],
  providers: [WynajmyService],
  exports: [WynajmyService],
})
export class WynajmyModule {}