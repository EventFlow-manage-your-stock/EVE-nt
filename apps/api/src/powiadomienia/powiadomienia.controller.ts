import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PowiadomieniaService } from './powiadomienia.service';

@Controller('powiadomienia')
@UseGuards(AuthGuard('jwt'))
export class PowiadomieniaController {
  constructor(private readonly service: PowiadomieniaService) {}

  @Get()
  getUserNotifications(@Req() req: Request, @Query() query: any) {
    const user = req.user as any;
    const permissions = user.permissions || [];
    return this.service.getUserNotifications(Number(user.id_organizacji), Number(user.id), permissions, query);
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.markAsRead(id, Number(user.id_organizacji), Number(user.id));
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: Request) {
    const user = req.user as any;
    return this.service.markAllAsRead(Number(user.id_organizacji), Number(user.id));
  }

  @Delete(':id')
  removeNotification(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.removeNotification(id, Number(user.id_organizacji));
  }

  @Post('reczne')
  createManual(@Body() dto: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.createManualNotification(dto, Number(user.id_organizacji), Number(user.id));
  }

  @Get('cykliczne')
  getCyclicRules(@Req() req: Request) {
    const user = req.user as any;
    return this.service.getCyclicRules(Number(user.id_organizacji));
  }

  @Post('cykliczne')
  createCyclicRule(@Body() dto: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.createCyclicRule(dto, Number(user.id_organizacji), Number(user.id));
  }

  @Delete('cykliczne/:id')
  removeCyclicRule(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.removeCyclicRule(id, Number(user.id_organizacji));
  }
}