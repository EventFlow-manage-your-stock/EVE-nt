import { Controller, Get, Put, Post, Delete, Patch, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { SerwisService } from './serwis.service';

@Controller('serwis')
@UseGuards(AuthGuard('jwt'))
export class SerwisController {
  constructor(private readonly serwisService: SerwisService) {}

  @Get()
  async getZgloszenia(@Req() req: Request) {
    return this.serwisService.getWszystkieZgloszenia(Number((req.user as any).id_organizacji));
  }

  @Post()
  async createZgloszenie(@Body() dto: any, @Req() req: Request) {
    return this.serwisService.createZgloszenie(dto, Number((req.user as any).id_organizacji), Number((req.user as any).id));
  }

  @Get('archiwum')
  async getArchiwum(@Req() req: Request) {
    return this.serwisService.getArchiwum(Number((req.user as any).id_organizacji));
  }

  @Put(':id/archiwizuj')
  async archiwizujZgloszenie(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_uzytkownika = Number((req.user as any).id || (req.user as any).sub || 0);
    return this.serwisService.archiwizujZgloszenie(id, Number((req.user as any).id_organizacji), id_uzytkownika);
  }
  
  @Patch(':id/status')
  async updateStatusZgloszenia(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_uzytkownika = Number((req.user as any).id || (req.user as any).sub || 0);
    return this.serwisService.updateStatusZgloszenia(id, dto.id_statusu_serwisu, Number((req.user as any).id_organizacji), id_uzytkownika);
  }

  @Get('statusy')
  async getStatusy(@Req() req: Request) {
    return this.serwisService.getStatusy(Number((req.user as any).id_organizacji));
  }

  @Get('statusy/:id')
  getStatusById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.serwisService.getStatusById(id, Number((req.user as any).id_organizacji));
  }

  @Post('statusy')
  async createStatus(@Body() dto: any, @Req() req: Request) {
    return this.serwisService.createStatus(dto, Number((req.user as any).id_organizacji));
  }

  @Put('statusy/:id')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.serwisService.updateStatus(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('statusy/:id')
  async deleteStatus(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.serwisService.deleteStatus(id, Number((req.user as any).id_organizacji));
  }

  @Get('model/:modelId')
  async getZgloszeniaDlaModelu(@Param('modelId', ParseIntPipe) modelId: number, @Req() req: Request) {
    return this.serwisService.getZgloszeniaDlaModelu(modelId, Number((req.user as any).id_organizacji));
  }

  @Get(':id')
  async getZgloszenieById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.serwisService.getZgloszenieById(id, Number((req.user as any).id_organizacji));
  }

  @Put(':id')
  async updateZgloszenie(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_uzytkownika = Number((req.user as any).id || (req.user as any).sub || 0);
    return this.serwisService.updateZgloszenie(id, dto, Number((req.user as any).id_organizacji), id_uzytkownika);
  }
}
