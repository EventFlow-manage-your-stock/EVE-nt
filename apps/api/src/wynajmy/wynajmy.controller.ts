import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { WynajmyService } from './wynajmy.service';

@Controller('wynajmy')
@UseGuards(AuthGuard('jwt'))
export class WynajmyController {
  constructor(private readonly service: WynajmyService) {}

  private orgId(req: Request): number {
    return Number((req.user as any).id_organizacji);
  }

  private userId(req: Request): number {
    return Number((req.user as any).id || (req.user as any).sub);
  }

  // --- PODSTAWOWY CRUD WYPOŻYCZENIA ---

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(this.orgId(req));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.findOne(id, this.orgId(req));
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    return this.service.create(dto, this.orgId(req), this.userId(req));
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.update(id, dto, this.orgId(req), this.userId(req));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, this.orgId(req), this.userId(req));
  }

  // --- ZARZĄDZANIE OPIEKUNAMI / MANAGERAMI WYNAJMU ---

  @Post(':id/managerowie')
  addManager(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addManager(id, dto, this.orgId(req));
  }

  @Delete(':id/managerowie/:managerId')
  removeManager(
    @Param('id', ParseIntPipe) id: number,
    @Param('managerId', ParseIntPipe) managerId: number,
    @Req() req: Request,
  ) {
    return this.service.removeManager(id, managerId, this.orgId(req));
  }

  // --- HARMONOGRAM / ETAPY WYNAJMU ---

  @Post(':id/etapy')
  addEtap(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addEtap(id, dto, this.orgId(req));
  }

  @Put(':id/etapy/:etapId')
  updateEtap(
    @Param('id', ParseIntPipe) id: number,
    @Param('etapId', ParseIntPipe) etapId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.updateEtap(etapId, dto, this.orgId(req));
  }

  @Delete(':id/etapy/:etapId')
  removeEtap(
    @Param('id', ParseIntPipe) id: number,
    @Param('etapId', ParseIntPipe) etapId: number,
    @Req() req: Request,
  ) {
    return this.service.removeEtap(etapId, this.orgId(req));
  }

  @Post(':id/etapy/:etapId/ekipa')
  addEtapEkipa(
    @Param('id', ParseIntPipe) id: number,
    @Param('etapId', ParseIntPipe) etapId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.addEtapEkipa(etapId, dto, this.orgId(req));
  }

  @Delete(':id/etapy/ekipa/:przypisanieId')
  removeEtapEkipa(
    @Param('id', ParseIntPipe) id: number,
    @Param('przypisanieId', ParseIntPipe) przypisanieId: number,
    @Req() req: Request,
  ) {
    return this.service.removeEtapEkipa(przypisanieId, this.orgId(req));
  }

  @Post(':id/etapy/:etapId/flota')
  addEtapPojazd(
    @Param('id', ParseIntPipe) id: number,
    @Param('etapId', ParseIntPipe) etapId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.addEtapPojazd(etapId, dto, this.orgId(req));
  }

  @Delete(':id/etapy/flota/:przypisanieId')
  removeEtapPojazd(
    @Param('id', ParseIntPipe) id: number,
    @Param('przypisanieId', ParseIntPipe) przypisanieId: number,
    @Req() req: Request,
  ) {
    return this.service.removeEtapPojazd(przypisanieId, this.orgId(req));
  }

  @Post(':id/flota/etapy-przypisanie')
  assignVehicleToStagesBody(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { id_pojazdu?: number | null; pojazd_zewnetrzny?: string | null; stageIds: number[] },
    @Req() req: Request,
  ) {
    return this.service.assignVehicleToStages(
      id,
      dto.id_pojazdu ?? dto.pojazd_zewnetrzny ?? '',
      dto.stageIds || [],
      this.orgId(req),
    );
  }

  @Post(':id/flota/:pojazdKey/etapy')
  assignVehicleToStages(
    @Param('id', ParseIntPipe) id: number,
    @Param('pojazdKey') pojazdKey: string,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.assignVehicleToStages(
      id,
      pojazdKey,
      dto.stageIds || [],
      this.orgId(req),
    );
  }

  @Post(':id/ekipa/:uzytkownikId/etapy')
  assignUserToStages(
    @Param('id', ParseIntPipe) id: number,
    @Param('uzytkownikId', ParseIntPipe) uzytkownikId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.assignUserToStages(id, uzytkownikId, dto.stageIds || [], this.orgId(req));
  }

  // --- EKIPA (PERSONEL WYNAJMU) ---

  @Post(':id/ekipa')
  addEkipa(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addEkipa(id, dto, this.orgId(req));
  }

  @Put(':id/ekipa/:ekipaId')
  updateEkipa(
    @Param('id', ParseIntPipe) id: number,
    @Param('ekipaId', ParseIntPipe) ekipaId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.updateEkipa(ekipaId, dto, this.orgId(req));
  }

  @Delete(':id/ekipa/:ekipaId')
  removeEkipa(
    @Param('id', ParseIntPipe) id: number,
    @Param('ekipaId', ParseIntPipe) ekipaId: number,
    @Req() req: Request,
  ) {
    return this.service.removeEkipa(ekipaId, this.orgId(req));
  }

  @Post(':id/powiadomienia/ekipa')
  wyslijPowiadomienieEkipa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { userIds: number[] },
    @Req() req: Request,
  ) {
    return this.service.wyslijPowiadomienieEkipa(id, dto.userIds || [], this.orgId(req));
  }

  // --- FLOTA (TRANSPORT WYNAJMU) ---

  @Post(':id/flota')
  addFlota(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addFlota(id, dto, this.orgId(req));
  }

  @Delete(':id/flota/:flotaId')
  removeFlota(
    @Param('id', ParseIntPipe) id: number,
    @Param('flotaId', ParseIntPipe) flotaId: number,
    @Req() req: Request,
  ) {
    return this.service.removeFlota(flotaId, this.orgId(req));
  }

  // --- NOCLEGI ---

  @Post(':id/noclegi')
  addNocleg(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addNocleg(id, dto, this.orgId(req));
  }

  @Put(':id/noclegi/:noclegId')
  updateNocleg(
    @Param('id', ParseIntPipe) id: number,
    @Param('noclegId', ParseIntPipe) noclegId: number,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.service.updateNocleg(noclegId, dto, this.orgId(req));
  }

  @Delete(':id/noclegi/:noclegId')
  removeNocleg(
    @Param('id', ParseIntPipe) id: number,
    @Param('noclegId', ParseIntPipe) noclegId: number,
    @Req() req: Request,
  ) {
    return this.service.removeNocleg(noclegId, this.orgId(req));
  }

  // --- CHAT I ZAŁĄCZNIKI ---

  @Post(':id/chat')
  addChat(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.service.addChat(id, dto.message, this.orgId(req), this.userId(req));
  }

  @Post(':id/zalaczniki')
  @UseInterceptors(FileInterceptor('file'))
  async addZalacznik(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Brak pliku w żądaniu.');
    return this.service.addZalacznik(id, dto, file, this.orgId(req), this.userId(req));
  }

  @Delete(':id/zalaczniki/:zalacznikId')
  removeZalacznik(
    @Param('id', ParseIntPipe) id: number,
    @Param('zalacznikId', ParseIntPipe) zalacznikId: number,
    @Req() req: Request,
  ) {
    return this.service.removeZalacznik(zalacznikId, this.orgId(req));
  }
}