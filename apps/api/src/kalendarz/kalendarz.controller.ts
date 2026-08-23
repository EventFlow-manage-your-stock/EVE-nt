import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { KalendarzService } from './kalendarz.service';

@Controller('kalendarz')
@UseGuards(AuthGuard('jwt'))
export class KalendarzController {
  constructor(private readonly service: KalendarzService) {}

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    return this.service.findAll(Number((req.user as any).id_organizacji), query);
  }

  @Post('szybkie-dodanie')
  quickAdd(@Req() req: Request, @Body() dto: any) {
    const user = req.user as any;
    return this.service.quickAdd(Number(user.id_organizacji), Number(user.id), dto);
  }
}
