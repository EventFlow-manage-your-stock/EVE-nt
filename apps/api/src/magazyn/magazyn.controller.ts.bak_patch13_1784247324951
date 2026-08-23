import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { MagazynService } from './magazyn.service';

@Controller('magazyn')
@UseGuards(AuthGuard('jwt'))
export class MagazynController {
  constructor(private readonly magazynService: MagazynService) {}

  @Get('kategorie')
  async getKategorie(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getKategorie(id_organizacji);
  }

  @Get('kategorie/plasko')
  async getKategoriePlasko(@Req() req: Request) {
    return this.magazynService.getKategoriePlasko(Number((req.user as any).id_organizacji));
  }

  @Get('kategorie/:id')
  async getKategoriaById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getKategoriaById(id, Number((req.user as any).id_organizacji));
  }

  // EVENTFLOW_PRODUCT_POLISH_V3: zarządzanie kategoriami sprzętu z poziomu panelu.
  @Post('kategorie')
  async createKategoria(@Body() dto: any, @Req() req: Request) {
    return this.magazynService.createKategoria(dto, Number((req.user as any).id_organizacji));
  }

  @Put('kategorie/:id')
  async updateKategoria(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.updateKategoria(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('kategorie/:id')
  async deleteKategoria(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.deleteKategoria(id, Number((req.user as any).id_organizacji));
  }

  @Get('wszystkie-egzemplarze')
  async getWszystkieEgzemplarze(@Req() req: Request, @Query() query: any) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getWszystkieEgzemplarze(id_organizacji, query);
  }

  @Get('modele')
  async getModele(@Req() req: Request, @Query() query: any) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getModeleSprzetu(id_organizacji, query);
  }

  @Post('modele')
  async createModel(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.createModelSprzetu(dto, id_organizacji);
  }

  @Get('modele/:id')
  async getModelById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getModelById(id, id_organizacji);
  }

  @Get('modele/:id/zajetosc')
  async getZajetoscModelu(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getZajetoscModelu(id, Number((req.user as any).id_organizacji));
  }

  @Put('modele/:id')
  async updateModel(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.updateModel(id, dto, id_organizacji);
  }

  @Delete('modele/:id')
  async deleteModel(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.usunModelSoft(id, id_organizacji, id_uzytkownika as number);
  }

  @Get('slowniki/magazyny')
  async getMagazyny(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getMagazyny(id_organizacji);
  }

  @Get('slowniki/cases')
  async getCases(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getFizyczneCase(id_organizacji);
  }

  @Get('slowniki/dostepne-do-case/:id')
  async getDostepneDoCase(@Param('id', ParseIntPipe) id_case: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getDostepneDoCase(id_organizacji, id_case);
  }

  @Get('opakowania')
  async getOpakowania(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getListaOpakowan(id_organizacji);
  }

  @Get('opakowania/:id')
  async getOpakowanieById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getOpakowanieById(id, Number((req.user as any).id_organizacji));
  }



  // EVENTFLOW_PRODUCT_POLISH_V5: szybkie dodawanie opakowania/case z zakładki Opakowania.
  @Post('opakowania')
  async createOpakowanie(@Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.createOpakowanie(dto, id_organizacji, id_uzytkownika as number);
  }

  @Get('egzemplarze/:id')
  async getEgzemplarzById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getEgzemplarzById(id, id_organizacji);
  }

  @Post('modele/:modelId/egzemplarze')
  async createEgzemplarz(@Param('modelId', ParseIntPipe) modelId: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.createEgzemplarz(modelId, dto, id_organizacji, id_uzytkownika as number);
  }

  @Put('egzemplarze/:id')
  async updateEgzemplarz(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.updateEgzemplarz(id, dto, id_organizacji, id_uzytkownika as number);
  }

  @Delete('egzemplarze/:id')
  async deleteEgzemplarz(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.deleteEgzemplarz(id, id_organizacji, id_uzytkownika as number);
  }

  @Post('egzemplarze/:id/zawartosc')
  async modyfikujZawartoscCase(
    @Param('id', ParseIntPipe) id_case: number, 
    @Body() body: { itemIds: number[], action: 'add' | 'remove' }, 
    @Req() req: Request
  ) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    const id_uzytkownika = rawUserId ? Number(rawUserId) : null;
    return this.magazynService.modyfikujZawartoscCase(id_case, body.itemIds, body.action, id_organizacji, id_uzytkownika as number);
  }

  @Get('cennik')
  async getCennikGlobalny(@Req() req: Request, @Query('kategoriaId') kategoriaId?: string, @Query('search') search?: string) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getCennikGlobalny(
      id_organizacji, 
      kategoriaId ? parseInt(kategoriaId) : undefined,
      search
    );
  }

  @Put('cennik/masowo')
  async updateCenyMasowo(@Body() body: { updates: { id_modelu: number, cena: number | null }[] }, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.updateCenyMasowo(body.updates, id_organizacji);
  }

  @Post('modele/:modelId/stawki')
  async addStawka(@Param('modelId', ParseIntPipe) modelId: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.addStawkaToModel(modelId, dto, id_organizacji);
  }

  @Put('stawki/:id')
  async updateStawka(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.updateStawka(id, dto, id_organizacji);
  }

  @Delete('stawki/:id')
  async deleteStawka(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.deleteStawka(id, id_organizacji);
  }


  // EVENTFLOW_PRODUCT_POLISH_V13: skanowanie kodów kreskowych/QR/SN podczas wydań i przyjęć.
  @Get('skan')
  async skanujSprzet(@Query('kod') kod: string, @Req() req: Request) {
    return this.magazynService.znajdzSprzetPoKodzie(kod, Number((req.user as any).id_organizacji));
  }

  // EVENTFLOW_PRODUCT_POLISH_V12: dokumenty magazynowe WZ/PZ z podpisem i pozycjami.
  @Get('dokumenty')
  async getDokumentyMagazynowe(@Req() req: Request, @Query() query: any) {
    return this.magazynService.getDokumentyMagazynowe(Number((req.user as any).id_organizacji), query);
  }

  @Get('dokumenty/:id')
  async getDokumentMagazynowyById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getDokumentMagazynowyById(id, Number((req.user as any).id_organizacji));
  }

  @Post('dokumenty')
  async createDokumentMagazynowy(@Body() dto: any, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.createDokumentMagazynowy(dto, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Get('wydarzenia/:id/sprzet')
  async getSprzetWydarzenia(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getSprzetWydarzenia(id, Number((req.user as any).id_organizacji));
  }

  @Post('wydarzenia/:id/sprzet')
  async dodajSprzetDoWydarzenia(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.dodajSprzetDoWydarzenia(id, dto, Number((req.user as any).id_organizacji));
  }

}