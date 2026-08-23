import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { UzytkownicyService } from './uzytkownicy.service';

@Controller('uzytkownicy')
@UseGuards(AuthGuard('jwt'))
export class UzytkownicyController {
  constructor(private readonly service: UzytkownicyService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(Number((req.user as any).id_organizacji));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.findOne(id, Number((req.user as any).id_organizacji));
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    return this.service.create(dto, Number((req.user as any).id_organizacji));
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