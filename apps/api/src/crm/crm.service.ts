import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(id_organizacji: number, search?: string) {
    const where: any = { id_organizacji, aktywny: true };
    if (search) {
      where.OR = [
        { nazwa: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.extendedClient.kontrahent.findMany({
      where,
      include: { _count: { select: { kontakty: { where: { aktywny: true } }, wydarzenia: { where: { aktywny: true } } } } },
      orderBy: { nazwa: 'asc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const client = await this.prisma.extendedClient.kontrahent.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        kontakty: { where: { aktywny: true }, orderBy: [{ glowny: 'desc' }, { nazwisko: 'asc' }] },
        wydarzenia: { where: { aktywny: true }, orderBy: { data_start: 'desc' }, include: { manager: true, typ: true, status: true } },
        // DODANO: Pobieranie ofert powiązanych z klientem
        oferty: { where: { aktywny: true }, orderBy: { data_utworzenia: 'desc' }, include: { status: true } }
      }
    });
    if (!client) throw new NotFoundException('Nie znaleziono kontrahenta');
    return client;
  }

  private async checkNipUnique(nip: string | undefined | null, id_organizacji: number, excludeId?: number) {
    if (!nip) return;
    
    // Usuwamy ewentualne myślniki i spacje
    const cleanNip = nip.replace(/[\s-]/g, '');
    
    const existing = await this.prisma.extendedClient.kontrahent.findFirst({
      where: { 
        id_organizacji, 
        nip: cleanNip,
        id: excludeId ? { not: excludeId } : undefined
      }
    });

    if (existing) {
      throw new BadRequestException(`Kontrahent z numerem NIP ${cleanNip} już istnieje w Twojej bazie (zobacz: ${existing.nazwa}).`);
    }
  }

  async create(dto: any, id_organizacji: number) {
    await this.checkNipUnique(dto.nip, id_organizacji);

    return this.prisma.extendedClient.kontrahent.create({
      data: {
        id_organizacji,
        nazwa: dto.nazwa,
        nazwa_skrocona: dto.nazwa_skrocona,
        nip: dto.nip ? dto.nip.replace(/[\s-]/g, '') : null,
        regon: dto.regon,
        krs: dto.krs,
        kraj: dto.kraj || 'Polska',
        miasto: dto.miasto,
        ulica: dto.ulica,
        kod_pocztowy: dto.kod_pocztowy,
        email: dto.email,
        telefon: dto.telefon,
        nr_konta: dto.nr_konta,
        czy_klient: dto.czy_klient ?? true,
        czy_dostawca: !!dto.czy_dostawca,
        uwagi: dto.uwagi,
        zrodlo_danych: dto.zrodlo_danych || 'recznie',
        data_pobrania_gus: dto.data_pobrania_gus ? new Date(dto.data_pobrania_gus) : null,
      }
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    await this.checkNipUnique(dto.nip, id_organizacji, id);

    return this.prisma.extendedClient.kontrahent.update({
      where: { id },
      data: {
        nazwa: dto.nazwa,
        nazwa_skrocona: dto.nazwa_skrocona,
        nip: dto.nip ? dto.nip.replace(/[\s-]/g, '') : null,
        regon: dto.regon,
        krs: dto.krs,
        kraj: dto.kraj,
        miasto: dto.miasto,
        ulica: dto.ulica,
        kod_pocztowy: dto.kod_pocztowy,
        email: dto.email,
        telefon: dto.telefon,
        nr_konta: dto.nr_konta,
        czy_klient: dto.czy_klient,
        czy_dostawca: dto.czy_dostawca,
        uwagi: dto.uwagi,
      }
    });
  }

  async remove(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.kontrahent.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }

  // EVENTFLOW_PRODUCT_POLISH_V3: kontakty są osobnym kafelkiem w module kontrahentów.
  async getContacts(id_organizacji: number, id_kontrahenta?: number) {
    return this.prisma.extendedClient.kontaktKontrahenta.findMany({
      where: { id_organizacji, aktywny: true, ...(id_kontrahenta ? { id_kontrahenta } : {}) },
      include: { kontrahent: { select: { id: true, nazwa: true } } },
      orderBy: [{ glowny: 'desc' }, { nazwisko: 'asc' }],
    });
  }

  async getContactById(id: number, id_organizacji: number) {
    const contact = await this.prisma.extendedClient.kontaktKontrahenta.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        kontrahent: {
          select: {
            id: true,
            nazwa: true,
            nip: true,
            email: true,
            telefon: true,
            // Pobieramy inne kontakty z tego samego kontrahenta (z wyłączeniem aktualnego)
            kontakty: {
              where: { aktywny: true, id: { not: id } },
              orderBy: [{ glowny: 'desc' }, { nazwisko: 'asc' }],
              select: { id: true, imie: true, nazwisko: true, stanowisko: true, glowny: true }
            }
          }
        },
        wydarzenia: {
          where: { aktywny: true },
          include: { status: true },
          orderBy: { data_start: 'desc' }
        }
      },
    });

    if (!contact) throw new NotFoundException('Nie znaleziono kontaktu');

    // Niezależne, szybkie dociągnięcie wynajmów, do których przypisany jest ten kontakt
    const wynajmy = await this.prisma.extendedClient.wynajem.findMany({
      where: { id_kontaktu: id, id_organizacji, aktywny: true },
      include: { status: true },
      orderBy: { data_wydania: 'desc' }
    });

    return { ...contact, wynajmy };
  }
  
  async createContact(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.kontaktKontrahenta.create({
      data: {
        id_organizacji,
        id_kontrahenta: Number(dto.id_kontrahenta),
        imie: dto.imie || null,
        nazwisko: dto.nazwisko || null,
        stanowisko: dto.stanowisko || null,
        email: dto.email || null,
        telefon: dto.telefon || null,
        telefon_2: dto.telefon_2 || null,
        notatki_wewnetrzne: dto.notatki_wewnetrzne || null,
        glowny: !!dto.glowny,
      },
    });
  }

  async updateContact(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.kontaktKontrahenta.update({
      where: { id },
      data: {
        id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : undefined,
        imie: dto.imie || null,
        nazwisko: dto.nazwisko || null,
        stanowisko: dto.stanowisko || null,
        email: dto.email || null,
        telefon: dto.telefon || null,
        telefon_2: dto.telefon_2 || null,
        notatki_wewnetrzne: dto.notatki_wewnetrzne || null,
        glowny: !!dto.glowny,
      },
    });
  }

  async removeContact(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.kontaktKontrahenta.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }
}
