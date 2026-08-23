import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { WydarzeniaService } from './wydarzenia.service';

@Controller('wydarzenia')
@UseGuards(AuthGuard('jwt'))
export class WydarzeniaController {
  constructor(private readonly wydarzeniaService: WydarzeniaService) {}

  @Get('slowniki-filtrow')
  getSlownikiFiltrow(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.wydarzeniaService.getSlownikiDoFiltrow(id_organizacji);
  }

  @Post('powiadomienia/masowe')
  wyslijPowiadomienia(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.wydarzeniaService.wyslijPowiadomieniaMasowe(id_organizacji, id_uzytkownika);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.wydarzeniaService.findAll(id_organizacji, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.wydarzeniaService.findOne(id, id_organizacji);
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.wydarzeniaService.create(dto, id_organizacji, id_uzytkownika);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.wydarzeniaService.update(id, dto, id_organizacji, id_uzytkownika);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.wydarzeniaService.remove(id, id_organizacji, id_uzytkownika);
  }

  // ===================================================================
  // NOWE ENDPOINTY DLA ZAKŁADEK I HARMONOGRAMU
  // ===================================================================

  @Post(':id/etapy')
  addEtap(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addEtap(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/etapy/:etapId')
  removeEtap(@Param('id', ParseIntPipe) id: number, @Param('etapId', ParseIntPipe) etapId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeEtap(etapId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/ekipa')
  addEkipa(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addEkipa(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/ekipa/:ekipaId')
  removeEkipa(@Param('id', ParseIntPipe) id: number, @Param('ekipaId', ParseIntPipe) ekipaId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeEkipa(ekipaId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/flota')
  addFlota(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addFlota(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/flota/:flotaId')
  removeFlota(@Param('id', ParseIntPipe) id: number, @Param('flotaId', ParseIntPipe) flotaId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeFlota(flotaId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/chat')
  addChatMsg(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addChatMessage(id, dto.message, Number((req.user as any).id_organizacji), Number((req.user as any).id));
  }

  @Post(':id/zalaczniki')
  addZalacznik(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addZalacznik(id, dto, Number((req.user as any).id_organizacji), Number((req.user as any).id));
  }

  @Delete(':id/zalaczniki/:zalacznikId')
  removeZalacznik(@Param('id', ParseIntPipe) id: number, @Param('zalacznikId', ParseIntPipe) zalacznikId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeZalacznik(zalacznikId, Number((req.user as any).id_organizacji));
  }
}