import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PakietyService } from './pakiety.service';

@Controller('pakiety')
@UseGuards(AuthGuard('jwt'))
export class PakietyController {
  constructor(private readonly pakietyService: PakietyService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.pakietyService.findAll(Number((req.user as any).id_organizacji));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.pakietyService.findOne(id, Number((req.user as any).id_organizacji));
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    return this.pakietyService.create(dto, Number((req.user as any).id_organizacji));
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.pakietyService.update(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.pakietyService.remove(id, Number((req.user as any).id_organizacji));
  }

  // --- Operacje na pozycjach wewnątrz pakietu ---

  @Post(':id/pozycje')
  addPozycja(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.pakietyService.addPozycja(id, dto, Number((req.user as any).id_organizacji));
  }

  @Put(':id/pozycje/:pozId')
  updatePozycja(@Param('pozId', ParseIntPipe) pozId: number, @Body() dto: any, @Req() req: Request) {
    return this.pakietyService.updatePozycja(pozId, dto, Number((req.user as any).id_organizacji));
  }

  @Delete(':id/pozycje/:pozId')
  removePozycja(@Param('pozId', ParseIntPipe) pozId: number, @Req() req: Request) {
    return this.pakietyService.removePozycja(pozId, Number((req.user as any).id_organizacji));
  }
}