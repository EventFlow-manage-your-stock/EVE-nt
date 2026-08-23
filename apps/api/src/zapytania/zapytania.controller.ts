import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ZapytaniaService } from './zapytania.service';

@Controller('zapytania')
@UseGuards(AuthGuard('jwt'))
export class ZapytaniaController {
  constructor(private readonly service: ZapytaniaService) {}

  @Get('slowniki')
  getDictionaries(@Req() req: Request) {
    return this.service.getDictionaries(Number((req.user as any).id_organizacji));
  }

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(Number((req.user as any).id_organizacji));
  }
  @Get('archiwum')
  async getArchiwum(@Req() req: Request) {
    return this.service.getArchiwum(Number((req.user as any).id_organizacji));
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @Req() req: Request) {
    return this.service.updateStatus(id, status, Number((req.user as any).id_organizacji));
  }

  @Put(':id/archiwizuj')
  async archiwizuj(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.archiwizuj(id, Number((req.user as any).id_organizacji));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.findOne(id, Number((req.user as any).id_organizacji));
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_tworcy = Number((req.user as any).id);
    return this.service.create(dto, id_organizacji, id_tworcy);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.update(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, Number((req.user as any).id_organizacji));
  }
}