import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { MagazynService } from './magazyn.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';

@Controller('magazyn')
@UseGuards(AuthGuard('jwt'))
export class MagazynController {
  constructor(private readonly magazynService: MagazynService) {}

  @Get('kategorie')
  async getKategorie(@Req() req: Request) {
    return this.magazynService.getKategorie(Number((req.user as any).id_organizacji));
  }

  @Get('kategorie/plasko')
  async getKategoriePlasko(@Req() req: Request) {
    return this.magazynService.getKategoriePlasko(Number((req.user as any).id_organizacji));
  }

  @Get('kategorie/:id')
  async getKategoriaById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getKategoriaById(id, Number((req.user as any).id_organizacji));
  }

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
    return this.magazynService.getWszystkieEgzemplarze(Number((req.user as any).id_organizacji), query);
  }

  @Get('modele')
  async getModele(@Req() req: Request, @Query() query: any) {
    return this.magazynService.getModeleSprzetu(Number((req.user as any).id_organizacji), query);
  }

  @Post('modele')
  async createModel(@Body() dto: any, @Req() req: Request) {
    return this.magazynService.createModelSprzetu(dto, Number((req.user as any).id_organizacji));
  }

  @Get('modele/:id')
  async getModelById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getModelById(id, Number((req.user as any).id_organizacji));
  }

  @Get('modele/:id/zajetosc')
  async getZajetoscModelu(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getZajetoscModelu(id, Number((req.user as any).id_organizacji));
  }

  @Put('modele/:id')
  async updateModel(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.updateModel(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('modele/:id')
  async deleteModel(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.usunModelSoft(id, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Get('slowniki/magazyny')
  async getMagazyny(@Req() req: Request) {
    return this.magazynService.getMagazyny(Number((req.user as any).id_organizacji));
  }

  @Get('slowniki/cases')
  async getCases(@Req() req: Request) {
    return this.magazynService.getFizyczneCase(Number((req.user as any).id_organizacji));
  }

  @Get('slowniki/dostepne-do-case/:id')
  async getDostepneDoCase(@Param('id', ParseIntPipe) id_case: number, @Req() req: Request) {
    return this.magazynService.getDostepneDoCase(Number((req.user as any).id_organizacji), id_case);
  }

  @Get('opakowania')
  async getOpakowania(@Req() req: Request) {
    return this.magazynService.getListaOpakowan(Number((req.user as any).id_organizacji));
  }

  @Get('opakowania/:id')
  async getOpakowanieById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getOpakowanieById(id, Number((req.user as any).id_organizacji));
  }

  @Post('opakowania')
  async createOpakowanie(@Body() dto: any, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.createOpakowanie(dto, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Get('egzemplarze/:id')
  async getEgzemplarzById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getEgzemplarzById(id, Number((req.user as any).id_organizacji));
  }

  @Post('modele/:modelId/egzemplarze')
  async createEgzemplarz(@Param('modelId', ParseIntPipe) modelId: number, @Body() dto: any, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.createEgzemplarz(modelId, dto, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Put('egzemplarze/:id')
  async updateEgzemplarz(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.updateEgzemplarz(id, dto, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Delete('egzemplarze/:id')
  async deleteEgzemplarz(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.deleteEgzemplarz(id, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Post('egzemplarze/:id/zawartosc')
  async modyfikujZawartoscCase(
    @Param('id', ParseIntPipe) id_case: number, 
    @Body() body: { itemIds: number[], action: 'add' | 'remove' }, 
    @Req() req: Request
  ) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.modyfikujZawartoscCase(id_case, body.itemIds, body.action, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Get('cennik')
  async getCennikGlobalny(@Req() req: Request, @Query('kategoriaId') kategoriaId?: string, @Query('search') search?: string) {
    return this.magazynService.getCennikGlobalny(
      Number((req.user as any).id_organizacji), 
      kategoriaId ? parseInt(kategoriaId) : undefined,
      search
    );
  }

  @Put('cennik/masowo')
  async updateCenyMasowo(@Body() body: { updates: { id_modelu: number, cena: number | null }[] }, @Req() req: Request) {
    return this.magazynService.updateCenyMasowo(body.updates, Number((req.user as any).id_organizacji));
  }

  @Post('modele/:modelId/stawki')
  async addStawka(@Param('modelId', ParseIntPipe) modelId: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.addStawkaToModel(modelId, dto, Number((req.user as any).id_organizacji));
  }

  @Put('stawki/:id')
  async updateStawka(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.updateStawka(id, dto, Number((req.user as any).id_organizacji));
  }

  @Delete('stawki/:id')
  async deleteStawka(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.deleteStawka(id, Number((req.user as any).id_organizacji));
  }

  @Get('skan') 
  async skanujSprzet(@Query('kod') kod: string, @Req() req: Request) {
    return this.magazynService.znajdzSprzetPoKodzie(kod, Number((req.user as any).id_organizacji));
  }
 
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

  @Post('transfer')
  async transferMiedzyWydarzeniami(@Body() dto: any, @Req() req: Request) {
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.transferMiedzyWydarzeniami(dto, Number((req.user as any).id_organizacji), rawUserId ? Number(rawUserId) : null);
  }

  @Get('wynajmy/:id/sprzet')
  async getSprzetWynajmu(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getSprzetWynajmu(id, Number((req.user as any).id_organizacji));
  }

  @Post('wynajmy/:id/sprzet')
  async dodajSprzetDoWynajmu(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: Request) {
    return this.magazynService.dodajSprzetDoWynajmu(id, dto, Number((req.user as any).id_organizacji));
  }

  @Get('niezwrocone')
  async getNiezwrocone(@Req() req: Request) {
    return this.magazynService.getNiezwrocone(Number((req.user as any).id_organizacji));
  }

  @Put('wydarzenia/:id/packlista')
  async updatePacklistaUwagi(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @Req() req: Request
  ) {
    return this.magazynService.updatePacklistaUwagi(
      id,
      dto,
      Number((req.user as any).id_organizacji)
    );
  }

  @Post('modele/:id/zalaczniki')
  @UseInterceptors(FileInterceptor('file')) // <-- Multer przetwarza "multipart/form-data" z frontendu
  async addZalacznik(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: any, 
    @UploadedFile() file: Express.Multer.File, // Odbiór do pamięci RAM na czas przesłania do MinIO
    @Req() req: Request
  ) {
    if (!file) throw new BadRequestException('Brak pliku w żądaniu. Upewnij się, że przesyłasz obiekt FormData z kluczem "file".');

    const id_uzytkownika = Number((req.user as any).id || (req.user as any).sub);
    return this.magazynService.addZalacznik(id, dto, file, Number((req.user as any).id_organizacji), id_uzytkownika);
  }

  @Delete('modele/:id/zalaczniki/:zalacznikId')
  async removeZalacznik(@Param('id', ParseIntPipe) id: number, @Param('zalacznikId', ParseIntPipe) zalacznikId: number, @Req() req: Request) {
    return this.magazynService.removeZalacznik(zalacznikId, Number((req.user as any).id_organizacji));
  }
  @Get('zalaczniki/:zalacznikId/download')
  async downloadZalacznik(@Param('zalacznikId', ParseIntPipe) id: number, @Req() req: Request) {
    return this.magazynService.getDownloadUrl(id, Number((req.user as any).id_organizacji));
  }

  @Get('egzemplarze/:id/zawartosc-ilosciowa')
  async getZawartoscIlosciowaCase(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    return this.magazynService.getZawartoscIlosciowaCase(id, id_organizacji);
  }

  @Post('egzemplarze/:id/zawartosc-ilosciowa')
  async modyfikujZawartoscIlosciowaCase(
    @Param('id', ParseIntPipe) id_case: number,
    @Body() body: { id_modelu: number; ilosc: number; action?: 'set' | 'remove' },
    @Req() req: Request,
  ) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    const rawUserId = (req.user as any).id || (req.user as any).sub;
    return this.magazynService.modyfikujZawartoscIlosciowaCase(
      id_case,
      Number(body.id_modelu),
      Number(body.ilosc || 0),
      body.action || 'set',
      id_organizacji,
      rawUserId ? Number(rawUserId) : null,
    );
  }
}