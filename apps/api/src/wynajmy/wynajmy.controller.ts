import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { WynajmyService } from './wynajmy.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';

@Controller('wynajmy')
@UseGuards(AuthGuard('jwt'))
export class WynajmyController {
  constructor(private readonly service: WynajmyService) {}

  @Get()
  findAll(@Req() req: Request) { return this.service.findAll(Number((req.user as any).id_organizacji)); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.findOne(id, Number((req.user as any).id_organizacji)); }

  @Post()
  create(@Body() dto: any, @Req() req: Request) { return this.service.create(dto, Number((req.user as any).id_organizacji)); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.update(id, dto, Number((req.user as any).id_organizacji)); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.remove(id, Number((req.user as any).id_organizacji)); }

  @Post(':id/pozycje')
  addPozycja(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.addPozycja(id, dto, Number((req.user as any).id_organizacji)); }

  // NOWE ENDPOINTY DLA ZAKŁADKI SPRZĘTÓW DLA WYNAJMU:
  @Get(':id/sprzet')
  getSprzetWynajmu(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.getSprzetWynajmu(id, Number((req.user as any).id_organizacji));
  }

  @Post(':id/sprzet')
  updatePlanSprzetu(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.updatePlanSprzetu(id, dto, Number((req.user as any).id_organizacji));
  }
  @Post(':id/chat')
  async addChat(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addChat(id, dto, Number((req.user as any).id_organizacji), Number((req.user as any).id));
  }

  @Post(':id/ekipa')
  async addCrew(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addCrew(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/ekipa/:ekipaId')
  async removeCrew(@Param('id', ParseIntPipe) id: number, @Param('ekipaId', ParseIntPipe) ekipaId: number, @Req() req: Request) {
    return this.service.removeCrew(id, ekipaId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/flota')
  async addFleet(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addFleet(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/flota/:flotaId')
  async removeFleet(@Param('id', ParseIntPipe) id: number, @Param('flotaId', ParseIntPipe) flotaId: number, @Req() req: Request) {
    return this.service.removeFleet(id, flotaId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/zalaczniki')
  @UseInterceptors(FileInterceptor('file'))
  async addZalacznik(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request
  ) {
    if (!file) throw new BadRequestException('Brak pliku w żądaniu');
    const id_uzytkownika = Number((req.user as any).id || (req.user as any).sub);
    return this.service.addZalacznik(id, dto, file, Number((req.user as any).id_organizacji), id_uzytkownika);
  }

  @Delete(':id/zalaczniki/:zalacznikId')
  async removeZalacznik(@Param('id', ParseIntPipe) id: number, @Param('zalacznikId', ParseIntPipe) zalacznikId: number, @Req() req: Request) {
    return this.service.removeZalacznik(zalacznikId, Number((req.user as any).id_organizacji));
  }
}