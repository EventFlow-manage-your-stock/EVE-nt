import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { SlownikiService } from './slowniki.service';

@Controller('slowniki')
@UseGuards(AuthGuard('jwt'))
export class SlownikiController {
  constructor(private readonly slownikiService: SlownikiService) {}

  private orgId(req: Request) {
    return Number((req.user as any).id_organizacji);
  }

  @Get('typy-wydarzen')
  async getTypyWydarzen(@Req() req: Request) {
    return this.slownikiService.getTypyWydarzen(this.orgId(req));
  }

  // EVENTFLOW_PRODUCT_POLISH_V9:
  // CRUD typów wydarzeń. Kolor ustawiony tutaj steruje kolorem paska w kalendarzu.
  @Get('typy-wydarzen/:id')
  getTypWydarzeniaById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.slownikiService.getTypWydarzeniaById(id, this.orgId(req));
  }

  @Post('typy-wydarzen')
  async createTypWydarzenia(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.createTypWydarzenia(this.orgId(req), dto);
  }

  @Put('typy-wydarzen-kolejnosc')
  async reorderTypyWydarzen(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.reorderTypyWydarzen(this.orgId(req), dto);
  }

  @Put('typy-wydarzen/:id')
  async updateTypWydarzenia(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    return this.slownikiService.updateTypWydarzenia(this.orgId(req), Number(id), dto);
  }

  @Delete('typy-wydarzen/:id')
  async deleteTypWydarzenia(@Req() req: Request, @Param('id') id: string) {
    return this.slownikiService.deleteTypWydarzenia(this.orgId(req), Number(id));
  }

  // EVENTFLOW_PRODUCT_POLISH_V11:
  // Pełny CRUD głównych statusów wydarzeń. Ikona statusu jest wyświetlana przed nazwą wydarzenia.
  @Get('statusy-wydarzenia')
  async getStatusyWydarzenia(@Req() req: Request) {
    return this.slownikiService.getStatusyWydarzenia(this.orgId(req));
  }

  // Alias, bo w starszych patchach pojawiały się oba warianty nazwy.
  @Get('statusy-wydarzen')
  async getStatusyWydarzenAlias(@Req() req: Request) {
    return this.slownikiService.getStatusyWydarzenia(this.orgId(req));
  }

  @Get('statusy-wydarzenia/:id')
  getStatusWydarzeniaById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.slownikiService.getStatusById('wydarzenia', id, this.orgId(req));
  }

  @Post('statusy-wydarzenia')
  createStatusWydarzenia(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.createStatus('wydarzenia', this.orgId(req), dto);
  }

  @Put('statusy-wydarzenia-kolejnosc')
  reorderStatusyWydarzenia(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.reorderStatuses('wydarzenia', this.orgId(req), dto);
  }

  @Put('statusy-wydarzenia/:id')
  updateStatusWydarzenia(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.slownikiService.updateStatus('wydarzenia', this.orgId(req), id, dto);
  }

  @Delete('statusy-wydarzenia/:id')
  deleteStatusWydarzenia(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.slownikiService.deleteStatus('wydarzenia', this.orgId(req), id);
  }

  @Get('statusy-magazynowe')
  async getStatusyMagazynowe(@Req() req: Request) {
    return this.slownikiService.getStatusyMagazynowe(this.orgId(req));
  }

  @Get('statusy-magazynowe/:id')
  getStatusMagazynowyById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.slownikiService.getStatusById('magazynowe', id, this.orgId(req));
  }

  @Post('statusy-magazynowe')
  createStatusMagazynowy(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.createStatus('magazynowe', this.orgId(req), dto);
  }

  @Put('statusy-magazynowe-kolejnosc')
  reorderStatusyMagazynowe(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.reorderStatuses('magazynowe', this.orgId(req), dto);
  }

  @Put('statusy-magazynowe/:id')
  updateStatusMagazynowy(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.slownikiService.updateStatus('magazynowe', this.orgId(req), id, dto);
  }

  @Delete('statusy-magazynowe/:id')
  deleteStatusMagazynowy(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.slownikiService.deleteStatus('magazynowe', this.orgId(req), id);
  }

  @Get('statusy-ksiegowe')
  async getStatusyKsiegowe(@Req() req: Request) {
    return this.slownikiService.getStatusyKsiegowe(this.orgId(req));
  }

  @Get('statusy-ksiegowe/:id')
  getStatusKsiegowyById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.slownikiService.getStatusById('ksiegowe', id, this.orgId(req));
  }

  @Post('statusy-ksiegowe')
  createStatusKsiegowy(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.createStatus('ksiegowe', this.orgId(req), dto);
  }

  @Put('statusy-ksiegowe-kolejnosc')
  reorderStatusyKsiegowe(@Req() req: Request, @Body() dto: any) {
    return this.slownikiService.reorderStatuses('ksiegowe', this.orgId(req), dto);
  }

  @Put('statusy-ksiegowe/:id')
  updateStatusKsiegowy(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.slownikiService.updateStatus('ksiegowe', this.orgId(req), id, dto);
  }

  @Delete('statusy-ksiegowe/:id')
  deleteStatusKsiegowy(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.slownikiService.deleteStatus('ksiegowe', this.orgId(req), id);
  }

  @Get('statusy-wynajmu')
  async getStatusyWynajmu(@Req() req: Request) {
    return this.slownikiService.getStatusyWynajmu(this.orgId(req));
  }

  @Get('kontrahenci')
  async getKontrahenci(@Req() req: Request) {
    return this.slownikiService.getKontrahenci(this.orgId(req));
  }

  @Get('miejsca')
  async getMiejsca(@Req() req: Request) {
    return this.slownikiService.getMiejsca(this.orgId(req));
  }

  @Get('uzytkownicy')
  async getUzytkownicy(@Req() req: Request) {
    return this.slownikiService.getUzytkownicy(this.orgId(req));
  }

  @Get('statusy-ofert')
  async getStatusyOfert(@Req() req: Request) {
    return this.slownikiService.getStatusyOfert(this.orgId(req));
  }
}
