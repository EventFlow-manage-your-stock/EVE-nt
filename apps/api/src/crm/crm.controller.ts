import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CrmService } from './crm.service';

@Controller('crm')
@UseGuards(AuthGuard('jwt'))
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('kontrahenci')
  findAll(@Req() req: Request, @Query('search') search?: string) {
    return this.crmService.findAll(Number((req.user as any).id_organizacji), search);
  }

  @Get('kontrahenci/:id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.crmService.findOne(id, Number((req.user as any).id_organizacji));
  }

  @Post('kontrahenci')
  create(@Body() dto: any, @Req() req: Request) {
    return this.crmService.create(dto, Number((req.user as any).id_organizacji));
  }

  @Put('kontrahenci/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.crmService.update(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('kontrahenci/:id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.crmService.remove(id, Number((req.user as any).id_organizacji));
  }

  @Get('kontakty')
  contacts(@Req() req: Request, @Query('kontrahentId') kontrahentId?: string) {
    return this.crmService.getContacts(Number((req.user as any).id_organizacji), kontrahentId ? Number(kontrahentId) : undefined);
  }

  @Get('kontakty/:id')
  getContactById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.crmService.getContactById(id, Number((req.user as any).id_organizacji));
  }

  @Post('kontakty')
  createContact(@Body() dto: any, @Req() req: Request) {
    return this.crmService.createContact(dto, Number((req.user as any).id_organizacji));
  }

  @Put('kontakty/:id')
  updateContact(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.crmService.updateContact(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('kontakty/:id')
  removeContact(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.crmService.removeContact(id, Number((req.user as any).id_organizacji));
  }
}
