import { Module } from '@nestjs/common';
import { GusController } from './gus.controller';
import { GusService } from './gus.service';
@Module({ controllers: [GusController], providers: [GusService] })
export class GusModule {}
