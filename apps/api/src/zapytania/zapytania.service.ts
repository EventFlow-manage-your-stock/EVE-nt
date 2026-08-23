import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZapytaniaService {
  constructor(private readonly prisma: PrismaService) {}

  async getDictionaries(id_organizacji: number) {
    const kontrahenci = await this.prisma.extendedClient.kontrahent.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true }
    });
    return { kontrahenci };
  }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        tworca: { select: { imie: true, nazwisko: true, avatar: true } },
        kontrahent: { select: { nazwa: true } }
      },
      orderBy: { data_utworzenia: 'desc' }
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const z = await this.prisma.extendedClient.zapytanie.findFirst({
      where: { id, id_organizacji}
    });
    if (!z) throw new NotFoundException('Nie znaleziono zapytania');
    return z;
  }

  async create(dto: any, id_organizacji: number, id_tworcy: number) {
    return this.prisma.extendedClient.zapytanie.create({
      data: {
        id_organizacji,
        id_tworcy,
        tytul: dto.tytul || 'Nowe zapytanie',
        opis: dto.opis || null,
        id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
        kontrahent_reczny: dto.kontrahent_reczny || null,
        status: dto.status || 'nowe'
      }
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.update({
      where: { id, id_organizacji },
      data: {
        tytul: dto.tytul,
        opis: dto.opis,
        status: dto.status,
        id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
        kontrahent_reczny: dto.kontrahent_reczny || null,
      }
    });
  }

  async updateStatus(id: number, status: string, id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.update({
      where: { id, id_organizacji },
      data: { status }
    });
  }

  async remove(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.update({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }

  async getArchiwum(id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.findMany({
      where: { id_organizacji, aktywny: false },
      include: {
        tworca: { select: { imie: true, nazwisko: true, avatar: true } },
        kontrahent: { select: { nazwa: true } }
      },
      orderBy: { data_usuniecia: 'desc' }
    });
  }


  // Metoda archiwizacji
  async archiwizuj(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.zapytanie.update({
      where: { id, id_organizacji },
      data: {
        aktywny: false,
        data_usuniecia: new Date() // Ustawiamy datę archiwizacji
      }
    });
  }
}