import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class UstawieniaService {
  constructor(private readonly prisma: PrismaService) {}
  async getRole(id_organizacji: number) { return this.prisma.extendedClient.rola.findMany({ where: { id_organizacji, aktywny: true }, orderBy: { kolejnosc: 'asc' } }); }
  async getUzytkownicy(id_organizacji: number) { return this.prisma.extendedClient.uzytkownik.findMany({ where: { id_organizacji, aktywny: true }, include: { role: { include: { rola: true } } }, orderBy: { nazwisko: 'asc' } }); }
  async createRole(dto: any, id_organizacji: number) { return this.prisma.extendedClient.rola.create({ data: { id_organizacji, nazwa: dto.nazwa, opis: dto.opis || null, kolejnosc: Number(dto.kolejnosc || 0) } }); }
  async setUserRoles(id_uzytkownika: number, roleIds: number[], id_organizacji: number) { return this.prisma.extendedClient.$transaction(async (tx) => { await tx.uzytkownikRola.deleteMany({ where: { id_organizacji, id_uzytkownika } }); if (roleIds.length) await tx.uzytkownikRola.createMany({ data: roleIds.map((id_roli) => ({ id_organizacji, id_uzytkownika, id_roli: Number(id_roli) })) }); return { success: true }; }); }
  async getTypyWydarzen(id_organizacji: number) { return this.prisma.extendedClient.typWydarzenia.findMany({ where: { id_organizacji, aktywny: true }, orderBy: { kolejnosc: 'asc' } }); }
  async createTypWydarzenia(dto: any, id_organizacji: number) { return this.prisma.extendedClient.typWydarzenia.create({ data: { id_organizacji, nazwa: dto.nazwa, kolor: dto.kolor || '#06B6D4', kolejnosc: Number(dto.kolejnosc || 0) } }); }
  async updateTypWydarzenia(id: number, dto: any, id_organizacji: number) { return this.prisma.extendedClient.typWydarzenia.update({ where: { id }, data: { nazwa: dto.nazwa, kolor: dto.kolor, kolejnosc: Number(dto.kolejnosc || 0), aktywny: dto.aktywny ?? true } }); }
  async getStatusyWydarzen(id_organizacji: number) { return this.prisma.extendedClient.statusWydarzenia.findMany({ where: { id_organizacji, aktywny: true }, orderBy: { kolejnosc: 'asc' } }); }
  async createStatusWydarzenia(dto: any, id_organizacji: number) { return this.prisma.extendedClient.statusWydarzenia.create({ data: { id_organizacji, nazwa: dto.nazwa, kolor: dto.kolor || '#64748B', ikona: dto.ikona || '●', kolejnosc: Number(dto.kolejnosc || 0) } }); }
  async updateStatusWydarzenia(id: number, dto: any, id_organizacji: number) { return this.prisma.extendedClient.statusWydarzenia.update({ where: { id }, data: { nazwa: dto.nazwa, kolor: dto.kolor, ikona: dto.ikona, kolejnosc: Number(dto.kolejnosc || 0), aktywny: dto.aktywny ?? true } }); }
  async updateRole(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.rola.update({
      where: { id, id_organizacji },
      data: {
        nazwa: dto.nazwa,
        opis: dto.opis || null,
        kolejnosc: dto.kolejnosc ? Number(dto.kolejnosc) : undefined,
        uprawnienia: dto.uprawnienia // Tablica stringów w formacie JSON
      }
    });
  }

  async deleteRole(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.rola.update({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }
}
