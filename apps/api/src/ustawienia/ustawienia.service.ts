import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
@Injectable()
export class UstawieniaService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}
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
  async getMyProfile(id_uzytkownika: number, id_organizacji: number) {
    const user = await this.prisma.extendedClient.uzytkownik.findFirst({
      where: { id: id_uzytkownika, id_organizacji, aktywny: true },
      include: {
        role: { include: { rola: true } },
        organizacja: { select: { nazwa: true, plan_abonamentu: true } }
      }
    });

    if (!user) throw new NotFoundException('Nie znaleziono Twojego konta.');

    // ROZWIĄZANIE: Generujemy bezpieczny URL w locie i osadzamy od razu w odpowiedzi do uzycia w <img src="..." />
    let avatarUrl: string | null = null;
    if (user.avatar) {
      try {
        avatarUrl = await this.storage.getPresignedDownloadUrl(user.avatar, 3600); // Ważne przez godzinę
      } catch (err) {
        console.error('Błąd pobierania presigned URL avatara:', err);
      }
    }

    return { ...user, avatarUrl };
  }

  async updateMyProfile(id_uzytkownika: number, dto: any, file: Express.Multer.File | undefined, id_organizacji: number) {
    const data: any = {
      imie: String(dto.imie || '').trim(),
      nazwisko: String(dto.nazwisko || '').trim(),
      telefon: String(dto.telefon || '').trim() || null,
    };

    if (file) {
      // Wgrywamy nowy avatar bezpiecznie do S3 (katalog avatarów)
      data.avatar = await this.storage.uploadFile(file, id_organizacji, 'avatars');
    }

    return this.prisma.extendedClient.uzytkownik.update({
      where: { id: id_uzytkownika },
      data
    });
  }
}
