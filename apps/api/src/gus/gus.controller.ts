import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GusService } from './gus.service';

// EVENTFLOW_PRODUCT_POLISH_V5:
// Bez prefiksu api, bo globalPrefix('api') jest ustawiony w main.ts.
// Dajemy też alias /gus/:nip, żeby działał przycisk ze starszego frontu.
@Controller('gus')
@UseGuards(AuthGuard('jwt'))
export class GusController {
  constructor(private readonly service: GusService) {}

  @Get('nip/:nip')
  lookup(@Param('nip') nip: string) {
    return this.service.lookupByNip(nip);
  }

  @Get(':nip')
  lookupShort(@Param('nip') nip: string) {
    return this.service.lookupByNip(nip);
  }
}
