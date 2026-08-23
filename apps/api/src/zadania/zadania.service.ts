import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZadaniaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(id_organizacji: number, id_uzytkownika: number, filters: any) {
    const where: any = { id_organizacji, aktywny: true };

    // Obsługa zakładek
    if (filters.tab === 'moje') {
      where.przypisani_uzytkownicy = { some: { id_uzytkownika } };
    } else if (filters.tab === 'zlecone') {
      where.id_tworcy = id_uzytkownika;
    } else if (filters.tab === 'wg_eventow') {
      where.id_wydarzenia = { not: null };
    }

    // Filtry z paska wyszukiwania
    if (filters.search) where.tytul = { contains: filters.search, mode: 'insensitive' };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.typ_zadania = filters.type;
    if (filters.eventId) where.id_wydarzenia = Number(filters.eventId);
    if (filters.userId) where.przypisani_uzytkownicy = { some: { id_uzytkownika: Number(filters.userId) } };

    if (filters.overdue === 'true') {
      where.data_koniec = { lt: new Date() };
      where.status = { notIn: ['zakończone', 'anulowane'] };
    }

    return this.prisma.extendedClient.zadanie.findMany({
      where,
      include: {
        tworca: { select: { imie: true, nazwisko: true } },
        wydarzenie: { select: { id: true, nazwa: true } },
        kontrahent: { select: { id: true, nazwa: true } },
        przypisani_uzytkownicy: {
          include: { uzytkownik: { select: { id: true, imie: true, nazwisko: true, avatar: true } } }
        }
      },
      orderBy: filters.sortBy === 'date_asc' ? { data_start: 'asc' } : { data_utworzenia: 'desc' }
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const zadanie = await this.prisma.extendedClient.zadanie.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        przypisani_uzytkownicy: { select: { id_uzytkownika: true } }
      }
    });
    if (!zadanie) throw new NotFoundException('Zadanie nie istnieje');
    return zadanie;
  }

  async getDictionaries(id_organizacji: number) {
    const [uzytkownicy, wydarzenia, kontrahenci, egzemplarze, pojazdy] = await Promise.all([
      this.prisma.extendedClient.uzytkownik.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, imie: true, nazwisko: true } }),
      this.prisma.extendedClient.wydarzenie.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, nazwa: true } }),
      this.prisma.extendedClient.kontrahent.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, nazwa: true } }),
      this.prisma.extendedClient.egzemplarz.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, nazwa: true, sn: true } }),
      this.prisma.extendedClient.pojazd.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, nazwa: true, nr_rejestracyjny: true } }),
    ]);
    return { uzytkownicy, wydarzenia, kontrahenci, egzemplarze, pojazdy };
  }

  async create(dto: any, id_organizacji: number, id_tworcy: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const zadanie = await tx.zadanie.create({
        data: {
          id_organizacji,
          id_tworcy,
          tytul: dto.tytul,
          opis: dto.opis,
          typ_zadania: dto.typ_zadania,
          status: dto.status || 'nowe',
          data_start: dto.data_start ? new Date(dto.data_start) : null,
          data_koniec: dto.data_koniec ? new Date(dto.data_koniec) : null,
          szacowany_czas_h: dto.szacowany_czas_h ? Number(dto.szacowany_czas_h) : null,
          szacowana_liczba_osob: dto.szacowana_liczba_osob ? Number(dto.szacowana_liczba_osob) : null,
          cykl: dto.cykl,
          id_wydarzenia: dto.id_wydarzenia ? Number(dto.id_wydarzenia) : null,
          id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
          id_egzemplarza: dto.id_egzemplarza ? Number(dto.id_egzemplarza) : null,
          id_pojazdu: dto.id_pojazdu ? Number(dto.id_pojazdu) : null,
        }
      });

      if (dto.przypisani && Array.isArray(dto.przypisani)) {
        await tx.zadanieUzytkownik.createMany({
          data: dto.przypisani.map((id_uzytkownika: string) => ({
            id_organizacji,
            id_zadania: zadanie.id,
            id_uzytkownika: Number(id_uzytkownika)
          }))
        });
      }

      return zadanie;
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const zadanie = await tx.zadanie.update({
        where: { id, id_organizacji },
        data: {
          tytul: dto.tytul,
          opis: dto.opis,
          typ_zadania: dto.typ_zadania,
          status: dto.status,
          data_start: dto.data_start ? new Date(dto.data_start) : null,
          data_koniec: dto.data_koniec ? new Date(dto.data_koniec) : null,
          szacowany_czas_h: dto.szacowany_czas_h ? Number(dto.szacowany_czas_h) : null,
          szacowana_liczba_osob: dto.szacowana_liczba_osob ? Number(dto.szacowana_liczba_osob) : null,
          cykl: dto.cykl,
          id_wydarzenia: dto.id_wydarzenia ? Number(dto.id_wydarzenia) : null,
          id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
          id_egzemplarza: dto.id_egzemplarza ? Number(dto.id_egzemplarza) : null,
          id_pojazdu: dto.id_pojazdu ? Number(dto.id_pojazdu) : null,
        }
      });

      if (dto.przypisani && Array.isArray(dto.przypisani)) {
        await tx.zadanieUzytkownik.deleteMany({ where: { id_zadania: id } });
        await tx.zadanieUzytkownik.createMany({
          data: dto.przypisani.map((id_uzytkownika: string) => ({
            id_organizacji,
            id_zadania: id,
            id_uzytkownika: Number(id_uzytkownika)
          }))
        });
      }

      return zadanie;
    });
  }

  async updateStatus(id: number, status: string, id_organizacji: number) {
    return this.prisma.extendedClient.zadanie.update({
      where: { id, id_organizacji },
      data: { status }
    });
  }
}