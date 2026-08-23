import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { FlotaService } from './flota.service';
@Controller('flota')
@UseGuards(AuthGuard('jwt'))
export class FlotaController {
  constructor(private readonly service: FlotaService) {}
  @Get('pojazdy') findAll(@Req() req: Request) { return this.service.findAll(Number((req.user as any).id_organizacji)); }
  @Get('pojazdy/:id') findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.findOne(id, Number((req.user as any).id_organizacji)); }
  @Post('pojazdy') create(@Body() dto: any, @Req() req: Request) { return this.service.create(dto, Number((req.user as any).id_organizacji)); }
  @Put('pojazdy/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.update(id, dto, Number((req.user as any).id_organizacji)); }
  @Delete('pojazdy/:id') remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.remove(id, Number((req.user as any).id_organizacji)); }
  @Get('pojazdy/:id/dostepnosc') availability(@Param('id', ParseIntPipe) id: number, @Query() q: any, @Req() req: Request) { return this.service.availability(id, Number((req.user as any).id_organizacji), q); }
  @Post('rezerwacje') reserve(@Body() dto: any, @Req() req: Request) { return this.service.reserve(dto, Number((req.user as any).id_organizacji)); }
}
