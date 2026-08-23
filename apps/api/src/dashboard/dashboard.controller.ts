import { Controller, Get, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: Request) {
    const user = req.user as any;
    return this.dashboardService.getSummary(Number(user.id_organizacji), Number(user.id));
  }

  @Post('preferences')
  async savePreferences(@Req() req: Request, @Body() body: { layout: string[] }) {
    const user = req.user as any;
    return this.dashboardService.savePreferences(Number(user.id), body.layout);
  }

  @Get('search')
  async globalSearch(@Query('q') query: string, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.dashboardService.globalSearch(id_organizacji, query);
  }

  @Get('notifications')
  async getNotifications(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const id_uzytkownika = Number((req.user as any).id);
    return this.dashboardService.getNotifications(id_organizacji, id_uzytkownika);
  }
  
}