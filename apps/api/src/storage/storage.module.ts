import { Module, Global } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Moduł dostępny globalnie w całej aplikacji Nest.js
@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService], // Udostępniamy serwis dla innych modułów (np. dla MagazynService)
})
export class StorageModule {}