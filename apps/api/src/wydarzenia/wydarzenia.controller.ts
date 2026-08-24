import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { WydarzeniaService } from './wydarzenia.service';
import { Public } from '../auth/decorators/public.decorator';

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

  // ===================================================================
  // WIDOK GOŚCIA (DLA PRACOWNIKÓW ZEWNĘTRZNYCH Z LINKU E-MAIL)
  // ===================================================================
  @Public()
  @Get('guest/:id')
  getGuestEvent(@Param('id', ParseIntPipe) id: number, @Query('token') token: string) {
    return this.wydarzeniaService.getGuestEvent(id, token);
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
  // ZARZĄDZANIE MANAGERAMI
  // ===================================================================
  @Post(':id/managerowie')
  addManager(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addManager(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/managerowie/:managerId')
  removeManager(@Param('id', ParseIntPipe) id: number, @Param('managerId', ParseIntPipe) managerId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeManager(id, managerId, Number((req.user as any).id_organizacji));
  }

  // ===================================================================
  // HARMONOGRAM / ETAPY I PRZYPISANIA DO NICH
  // ===================================================================
  @Post(':id/etapy')
  addEtap(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addEtap(id, dto, Number((req.user as any).id_organizacji));
  }

  @Put(':id/etapy/:etapId')
  updateEtap(@Param('id', ParseIntPipe) id: number, @Param('etapId', ParseIntPipe) etapId: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.updateEtap(etapId, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/etapy/:etapId')
  removeEtap(@Param('id', ParseIntPipe) id: number, @Param('etapId', ParseIntPipe) etapId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeEtap(etapId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/etapy/:etapId/ekipa')
  addEtapEkipa(@Param('id', ParseIntPipe) id: number, @Param('etapId', ParseIntPipe) etapId: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addEtapEkipa(etapId, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/etapy/ekipa/:przypisanieId')
  removeEtapEkipa(@Param('id', ParseIntPipe) id: number, @Param('przypisanieId', ParseIntPipe) przypisanieId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeEtapEkipa(przypisanieId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/etapy/:etapId/flota')
  addEtapPojazd(@Param('id', ParseIntPipe) id: number, @Param('etapId', ParseIntPipe) etapId: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addEtapPojazd(etapId, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/etapy/flota/:przypisanieId')
  removeEtapPojazd(@Param('id', ParseIntPipe) id: number, @Param('przypisanieId', ParseIntPipe) przypisanieId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeEtapPojazd(przypisanieId, Number((req.user as any).id_organizacji));
  }

  @Post(':id/ekipa/:uzytkownikId/etapy')
  assignUserToStages(@Param('id', ParseIntPipe) id: number, @Param('uzytkownikId', ParseIntPipe) uzytkownikId: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.assignUserToStages(id, uzytkownikId, dto.stageIds, Number((req.user as any).id_organizacji));
  }

  @Post(':id/flota/:pojazdId/etapy')
  assignVehicleToStages(@Param('id', ParseIntPipe) id: number, @Param('pojazdId', ParseIntPipe) pojazdId: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.assignVehicleToStages(id, pojazdId, dto.stageIds, Number((req.user as any).id_organizacji));
  }

  // ===================================================================
  // EKIPA I FLOTA (OGÓLNE)
  // ===================================================================
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

  @Post(':id/powiadomienia/ekipa')
  wyslijPowiadomienieEkipa(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.wyslijPowiadomienieEkipa(id, dto.userIds, Number((req.user as any).id_organizacji));
  }

  // ===================================================================
  // NOCLEGI
  // ===================================================================
  @Post(':id/noclegi')
  addNocleg(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.wydarzeniaService.addNocleg(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/noclegi/:noclegId')
  removeNocleg(@Param('id', ParseIntPipe) id: number, @Param('noclegId', ParseIntPipe) noclegId: number, @Req() req: Request) {
    return this.wydarzeniaService.removeNocleg(noclegId, Number((req.user as any).id_organizacji));
  }

  // ===================================================================
  // CHAT I ZAŁĄCZNIKI
  // ===================================================================
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