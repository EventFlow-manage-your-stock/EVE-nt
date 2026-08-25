import { Controller, Get, Param, ParseIntPipe, Req, UseGuards, NotFoundException, Query, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('storage')
@UseGuards(AuthGuard('jwt'))
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService
  ) {}

  @Get('zalaczniki')
  async getAllZalaczniki(@Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    
    return this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, aktywny: true },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' }
    });
  }

  @Get('download/:id')
  async getDownloadUrl(
    @Param('id', ParseIntPipe) id: number, 
    @Query('expiresIn') expiresIn: string, 
    @Req() req: Request
  ) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id, id_organizacji, aktywny: true }
    });

    if (!zalacznik || !zalacznik.sciezka) {
      throw new NotFoundException('Załącznik nie istnieje lub brakuje pliku w chmurze.');
    }

    // Domyślnie link wygasa po 5 minutach, chyba że frontend zażąda dłuższego czasu (np. przy generowaniu do udostępnienia)
    const seconds = expiresIn ? parseInt(expiresIn) : 300;
    const url = await this.storageService.getPresignedDownloadUrl(zalacznik.sciezka, seconds);

    return { url, nazwa: zalacznik.nazwa_pliku };
  }

  @Delete('zalaczniki/:id')
  async deleteGlobalZalacznik(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const id_organizacji = Number((req.user as any).id_organizacji);
    
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id, id_organizacji }
    });
    
    // Usuwamy fizyczny plik z S3/MinIO
    if (zalacznik && zalacznik.sciezka && !zalacznik.sciezka.startsWith('data:')) {
      await this.storageService.deleteFile(zalacznik.sciezka);
    }
    
    // Ukrywamy w bazie
    return this.prisma.extendedClient.zalacznik.update({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }
}