import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class UrlopyService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.nieobecnosc.findMany({ where: { id_organizacji, aktywny: true }, include: { uzytkownik: true }, orderBy: { data_od: 'desc' } });
  }
  async findOne(id: number, id_organizacji: number) {
    const item = await this.prisma.extendedClient.nieobecnosc.findFirst({ where: { id, id_organizacji, aktywny: true }, include: { uzytkownik: true } });
    if (!item) throw new NotFoundException('Nie znaleziono urlopu');
    return item;
  }
  async create(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.nieobecnosc.create({ data: { id_organizacji, id_uzytkownika: Number(dto.id_uzytkownika), typ: dto.typ || 'urlop', data_od: new Date(dto.data_od), data_do: new Date(dto.data_do), opis: dto.opis || null } });
  }
  async update(id: number, dto: any, id_organizacji: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.nieobecnosc.update({ where: { id }, data: { id_uzytkownika: Number(dto.id_uzytkownika), typ: dto.typ || 'urlop', data_od: new Date(dto.data_od), data_do: new Date(dto.data_do), opis: dto.opis || null } });
  }
  async remove(id: number, id_organizacji: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.nieobecnosc.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }
}
