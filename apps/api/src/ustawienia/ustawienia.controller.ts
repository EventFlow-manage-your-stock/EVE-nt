import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { UstawieniaService } from './ustawienia.service';
@Controller('ustawienia')
@UseGuards(AuthGuard('jwt'))
export class UstawieniaController {
  constructor(private readonly service: UstawieniaService) {}
  @Get('role') role(@Req() req: Request) { return this.service.getRole(Number((req.user as any).id_organizacji)); }
  @Get('uzytkownicy') users(@Req() req: Request) { return this.service.getUzytkownicy(Number((req.user as any).id_organizacji)); }
  @Post('role') createRole(@Body() dto: any, @Req() req: Request) { return this.service.createRole(dto, Number((req.user as any).id_organizacji)); }
  @Put('uzytkownicy/:id/role') setRoles(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.setUserRoles(id, dto.roleIds || [], Number((req.user as any).id_organizacji)); }
  @Get('typy-wydarzen') typy(@Req() req: Request) { return this.service.getTypyWydarzen(Number((req.user as any).id_organizacji)); }
  @Post('typy-wydarzen') createTyp(@Body() dto: any, @Req() req: Request) { return this.service.createTypWydarzenia(dto, Number((req.user as any).id_organizacji)); }
  @Put('typy-wydarzen/:id') updateTyp(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.updateTypWydarzenia(id, dto, Number((req.user as any).id_organizacji)); }
  @Get('statusy-wydarzen') statusy(@Req() req: Request) { return this.service.getStatusyWydarzen(Number((req.user as any).id_organizacji)); }
  @Post('statusy-wydarzen') createStatus(@Body() dto: any, @Req() req: Request) { return this.service.createStatusWydarzenia(dto, Number((req.user as any).id_organizacji)); }
  @Put('statusy-wydarzen/:id') updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) { return this.service.updateStatusWydarzenia(id, dto, Number((req.user as any).id_organizacji)); }
  @Put('role/:id')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.updateRole(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('role/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.deleteRole(id, Number((req.user as any).id_organizacji));
  }
}
