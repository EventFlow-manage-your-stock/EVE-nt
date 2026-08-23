import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { OfertyService } from './oferty.service';

@Controller('oferty')
@UseGuards(AuthGuard('jwt'))
export class OfertyController {
  constructor(private readonly service: OfertyService) {}
  @Get() findAll(@Req() req: Request) { return this.service.findAll(Number((req.user as any).id_organizacji)); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.findOne(id, Number((req.user as any).id_organizacji)); }
  @Post() create(@Body() dto: any, @Req() req: Request) { return this.service.create(dto, Number((req.user as any).id_organizacji), Number((req.user as any).id)); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.update(id, dto, Number((req.user as any).id_organizacji)); }
  @Post(':id/duplikuj') duplicate(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.duplikujOferte(id, Number((req.user as any).id_organizacji), Number((req.user as any).id), dto); }
  @Post(':id/sekcje') addSekcja(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.addSekcja(id, dto, Number((req.user as any).id_organizacji)); }
  @Put(':id/sekcje/:sekcjaId') updateSection(@Param('id', ParseIntPipe) id: number, @Param('sekcjaId', ParseIntPipe) sekcjaId: number, @Body() dto: any, @Req() req: Request) { return this.service.updateSekcja(id, sekcjaId, dto, Number((req.user as any).id_organizacji)); }
  // EVENTFLOW_PRODUCT_POLISH_V16: usuwanie grupy sprzętowej po potwierdzeniu w UI.
  @Delete(':id/sekcje/:sekcjaId') deleteSection(@Param('id', ParseIntPipe) id: number, @Param('sekcjaId', ParseIntPipe) sekcjaId: number, @Req() req: Request) { return this.service.deleteSekcja(id, sekcjaId, Number((req.user as any).id_organizacji)); }
  @Post(':id/sekcje/:sekcjaId/duplikuj') duplicateSection(@Param('id', ParseIntPipe) id: number, @Param('sekcjaId', ParseIntPipe) sekcjaId: number, @Req() req: Request) { return this.service.duplikujSekcje(id, sekcjaId, Number((req.user as any).id_organizacji)); }
  @Post(':id/pozycje') addPozycja(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.addPozycja(id, dto, Number((req.user as any).id_organizacji)); }
  @Put(':id/pozycje/:pozycjaId') updatePozycja(@Param('id', ParseIntPipe) id: number, @Param('pozycjaId', ParseIntPipe) pozycjaId: number, @Body() dto: any, @Req() req: Request) { return this.service.updatePozycja(id, pozycjaId, dto, Number((req.user as any).id_organizacji)); }
  @Delete(':id/pozycje/:pozycjaId') deletePozycja(@Param('id', ParseIntPipe) id: number, @Param('pozycjaId', ParseIntPipe) pozycjaId: number, @Req() req: Request) { return this.service.deletePozycja(id, pozycjaId, Number((req.user as any).id_organizacji)); }
  @Post(':id/synchronizuj') sync(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.synchronizujZWydarzeniem(id, dto.direction, Number((req.user as any).id_organizacji)); }
  @Post(':id/przelicz') przelicz(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.przelicz(id, Number((req.user as any).id_organizacji)); }
  @Post(':id/budzet') budzet(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.zastosujBudzet(id, dto, Number((req.user as any).id_organizacji)); }
  @Post(':id/sekcje/:sekcjaId/pakiety')
  addPakiet(@Param('id', ParseIntPipe) id: number, @Param('sekcjaId', ParseIntPipe) sekcjaId: number, @Body() dto: any, @Req() req: Request) {
    return this.service.dodajPakietDoOferty(id, sekcjaId, dto, Number((req.user as any).id_organizacji));
  }
}
