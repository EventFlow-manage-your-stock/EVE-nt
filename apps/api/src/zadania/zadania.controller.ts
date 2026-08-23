// EVENTFLOW_PRODUCT_POLISH_V5: trasa bez prefiksu api, bo main.ts ustawia app.setGlobalPrefix('api').
import { Controller, Get, Post, Put, Body, Param, Req, Query, UseGuards, ParseIntPipe, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ZadaniaService } from './zadania.service';

@Controller('zadania')
@UseGuards(AuthGuard('jwt'))
export class ZadaniaController {
  constructor(private readonly zadaniaService: ZadaniaService) {}

  @Get('slowniki')
  getDictionaries(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.zadaniaService.getDictionaries(id_organizacji);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.zadaniaService.findAll(id_organizacji, id_uzytkownika, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.zadaniaService.findOne(id, id_organizacji);
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.zadaniaService.create(dto, id_organizacji, id_uzytkownika);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.zadaniaService.update(id, dto, id_organizacji);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.zadaniaService.updateStatus(id, status, id_organizacji);
  }
}