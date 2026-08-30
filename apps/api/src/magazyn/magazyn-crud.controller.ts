import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { MagazynService } from './magazyn.service';

@Controller('magazyn/magazyny')
@UseGuards(AuthGuard('jwt'))
export class MagazynyCrudController {
  constructor(private readonly magazynService: MagazynService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getMagazynyFull(id_organizacji);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getMagazynById(id, id_organizacji);
  }

  @Post()
  async create(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.createMagazyn(dto, id_organizacji);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.updateMagazyn(id, dto, id_organizacji);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.deleteMagazyn(id, id_organizacji);
  }
}