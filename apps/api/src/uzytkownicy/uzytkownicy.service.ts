import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UzytkownicyService {
  constructor(private prisma: PrismaService) {}

  async findAll(id_organizacji: number) {
    const users = await this.prisma.extendedClient.uzytkownik.findMany({
      where: { id_organizacji, aktywny: true },
      include: { role: { include: { rola: true } } },
      orderBy: { nazwisko: 'asc' },
    });

    // Usuwamy hash hasła z wyników, aby uniknąć podwójnego hashowania przy edycji
    return users.map(user => {
      const { haslo, ...safeUser } = user;
      return safeUser;
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const user = await this.prisma.extendedClient.uzytkownik.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: { role: { include: { rola: true } } },
    });

    if (!user) throw new NotFoundException('Nie znaleziono użytkownika');

    // Usuwamy hash hasła z wyników
    const { haslo, ...safeUser } = user;
    return safeUser;
  }

  async create(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(dto.haslo || 'EventFlow123!', 10);
      const user = await tx.uzytkownik.create({
        data: {
          id_organizacji,
          imie: dto.imie,
          nazwisko: dto.nazwisko,
          email: dto.email,
          telefon: dto.telefon || null,
          stanowisko: dto.stanowisko || null,
          umiejetnosci: dto.umiejetnosci || null,
          haslo: hashedPassword,
          zablokowane_uprawnienia: Array.isArray(dto.zablokowane_uprawnienia) ? dto.zablokowane_uprawnienia : [],
        },
      });

      if (dto.roleIds && Array.isArray(dto.roleIds)) {
        await tx.uzytkownikRola.createMany({
          data: dto.roleIds.map((rId: string) => ({
            id_organizacji,
            id_uzytkownika: user.id,
            id_roli: Number(rId),
          })),
        });
      }
      return user;
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const dataToUpdate: any = {
        imie: dto.imie,
        nazwisko: dto.nazwisko,
        email: dto.email,
        telefon: dto.telefon || null,
        stanowisko: dto.stanowisko || null,
        umiejetnosci: dto.umiejetnosci || null,
        // ZAPIS ZABLOKOWANYCH UPRAWNIEŃ Z FRONTU
        zablokowane_uprawnienia: Array.isArray(dto.zablokowane_uprawnienia) ? dto.zablokowane_uprawnienia : [],
      };

      if (dto.haslo && dto.haslo.trim() !== '') {
        dataToUpdate.haslo = await bcrypt.hash(dto.haslo, 10);
      }

      const user = await tx.uzytkownik.update({
        where: { id, id_organizacji },
        data: dataToUpdate,
      });

      // AKTUALIZACJA RÓL
      if (dto.roleIds && Array.isArray(dto.roleIds)) {
        await tx.uzytkownikRola.deleteMany({ where: { id_uzytkownika: id, id_organizacji } });
        if (dto.roleIds.length > 0) {
          await tx.uzytkownikRola.createMany({
            data: dto.roleIds.map((rId: string) => ({
              id_organizacji,
              id_uzytkownika: id,
              id_roli: Number(rId),
            })),
          });
        }
      }
      return user;
    });
  }

  async remove(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.uzytkownik.update({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }
}