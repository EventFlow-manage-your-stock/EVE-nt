import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PowiadomieniaService {
  constructor(private readonly prisma: PrismaService) {}

  // Pobieranie powiadomień spersonalizowanych dla konkretnego użytkownika i jego uprawnień
  async getUserNotifications(id_organizacji: number, id_uzytkownika: number, userPermissions: string[], query: any = {}) {
    await this.generateContextualNotifications(id_organizacji);

    const where: any = {
      id_organizacji,
      aktywny: true,
      OR: [
        { id_odbiorcy: id_uzytkownika },
        { id_odbiorcy: null },
      ],
    };

    if (query.priorytet && query.priorytet !== 'all') {
      where.priorytet = query.priorytet;
    }

    if (query.typ && query.typ !== 'all') {
      where.typ = query.typ;
    }

    if (query.status === 'unread') {
      where.przeczytane = false;
    } else if (query.status === 'read') {
      where.przeczytane = true;
    }

    const items = await this.prisma.extendedClient.powiadomienie.findMany({
      where,
      include: {
        nadawca: { select: { id: true, imie: true, nazwisko: true, avatar: true } },
      },
      orderBy: { data_utworzenia: 'desc' },
      take: query.limit ? Number(query.limit) : 50,
    });

    // Filtrowanie według uprawnień użytkownika (jeśli powiadomienie wymaga uprawnienia)
    const filtered = items.filter((n: any) => {
      if (!n.wymagane_uprawnienie) return true;
      return userPermissions.includes(n.wymagane_uprawnienie);
    });

    const unreadCount = filtered.filter((n: any) => !n.przeczytane).length;

    return {
      items: filtered,
      unreadCount,
    };
  }

  async markAsRead(id: number, id_organizacji: number, id_uzytkownika: number) {
    const notif = await this.prisma.extendedClient.powiadomienie.findFirst({
      where: { id, id_organizacji, aktywny: true },
    });
    if (!notif) throw new NotFoundException('Nie znaleziono powiadomienia');

    return this.prisma.extendedClient.powiadomienie.update({
      where: { id },
      data: { przeczytane: true, data_odczytania: new Date() },
    });
  }

  async markAllAsRead(id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.powiadomienie.updateMany({
      where: {
        id_organizacji,
        przeczytane: false,
        OR: [{ id_odbiorcy: id_uzytkownika }, { id_odbiorcy: null }],
      },
      data: { przeczytane: true, data_odczytania: new Date() },
    });
  }

  async removeNotification(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.powiadomienie.update({
      where: { id },
      data: { aktywny: false },
    });
  }

  // Tworzenie powiadomienia ręcznego (do wszystkich lub wybranych osób)
  async createManualNotification(dto: any, id_organizacji: number, id_nadawcy: number) {
    const { tytul, tresc, priorytet = 'normalny', odbiorcy_ids = [], dla_wszystkich = true, link, wymagane_uprawnienie } = dto;
    if (!tytul || !tresc) throw new BadRequestException('Tytuł i treść są wymagane.');

    if (dla_wszystkich || !odbiorcy_ids.length) {
      return this.prisma.extendedClient.powiadomienie.create({
        data: {
          id_organizacji,
          id_nadawcy,
          id_odbiorcy: null,
          tytul,
          tresc,
          typ: 'manual',
          priorytet,
          link: link || null,
          wymagane_uprawnienie: wymagane_uprawnienie || null,
        },
      });
    }

    const created = await Promise.all(
      odbiorcy_ids.map((id_odbiorcy: number) =>
        this.prisma.extendedClient.powiadomienie.create({
          data: {
            id_organizacji,
            id_nadawcy,
            id_odbiorcy: Number(id_odbiorcy),
            tytul,
            tresc,
            typ: 'manual',
            priorytet,
            link: link || null,
            wymagane_uprawnienie: wymagane_uprawnienie || null,
          },
        })
      )
    );

    return { count: created.length };
  }

  // POWIADOMIENIA CYKLICZNE
  async getCyclicRules(id_organizacji: number) {
    return this.prisma.extendedClient.powiadomienieCykliczne.findMany({
      where: { id_organizacji, aktywny: true },
      include: { tworca: { select: { id: true, imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });
  }

  async createCyclicRule(dto: any, id_organizacji: number, id_tworcy: number) {
    return this.prisma.extendedClient.powiadomienieCykliczne.create({
      data: {
        id_organizacji,
        id_tworcy,
        tytul: dto.tytul,
        tresc: dto.tresc,
        priorytet: dto.priorytet || 'normalny',
        cykl: dto.cykl || 'codziennie',
        godzina: dto.godzina || '08:00',
        dni_tygodnia: dto.dni_tygodnia || [],
        dzien_miesiaca: dto.dzien_miesiaca ? Number(dto.dzien_miesiaca) : null,
        dla_wszystkich: dto.dla_wszystkich ?? true,
        odbiorcy_ids: dto.odbiorcy_ids || [],
        wymagane_uprawnienie: dto.wymagane_uprawnienie || null,
      },
    });
  }

  async removeCyclicRule(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.powiadomienieCykliczne.update({
      where: { id },
      data: { aktywny: false },
    });
  }

  // Generator automatycznych powiadomień operacyjnych (Alert Engine)
  private async generateContextualNotifications(id_organizacji: number) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Alerty floty (przeterminowane przeglądy SKP i polisy OC)
    const pojazdy = await this.prisma.extendedClient.pojazd.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, nr_rejestracyjny: true, data_przegladu: true, data_oc: true },
    });

    for (const p of pojazdy) {
      if (p.data_przegladu && new Date(p.data_przegladu) < now) {
        await this.createOrSkipSystemNotification(
          id_organizacji,
          `FLOTA_SKP_${p.id}_${todayStr}`,
          `Przegląd SKP po terminie: ${p.nazwa}`,
          `Pojazd ${p.nazwa} (${p.nr_rejestracyjny}) ma nieważne badanie techniczne od ${new Date(p.data_przegladu).toLocaleDateString('pl-PL')}.`,
          'fleet',
          'krytyczny',
          `/dashboard/fleet/${p.id}`,
          'fleet:view'
        );
      }
      if (p.data_oc && new Date(p.data_oc) < now) {
        await this.createOrSkipSystemNotification(
          id_organizacji,
          `FLOTA_OC_${p.id}_${todayStr}`,
          `Polisa OC wygasła: ${p.nazwa}`,
          `Ubezpieczenie OC pojazdu ${p.nazwa} (${p.nr_rejestracyjny}) utraciło ważność.`,
          'fleet',
          'krytyczny',
          `/dashboard/fleet/${p.id}`,
          'fleet:view'
        );
      }
    }

    // 2. Alerty aktywnych usterek serwisowych sprzętu
    const urgentServices = await this.prisma.extendedClient.serwisSprzetu.findMany({
      where: { id_organizacji, aktywny: true, data_rozwiazania: null },
      include: { egzemplarz: { include: { model: true } } },
      take: 5,
    });

    for (const s of urgentServices) {
      await this.createOrSkipSystemNotification(
        id_organizacji,
        `SERWIS_ALERT_${s.id}`,
        `Awaria sprzętu: ${s.egzemplarz?.model?.nazwa || 'Sprzęt'}`,
        `Zgłoszono usterkę "${s.tytul}" dla egzemplarza S/N: ${s.egzemplarz?.sn || s.egzemplarz?.numer_egzemplarza || '-'}.`,
        'service',
        'wysoki',
        `/dashboard/service/${s.id}`,
        'service:view'
      );
    }
  }

  private async createOrSkipSystemNotification(
    id_organizacji: number,
    dedupKey: string,
    tytul: string,
    tresc: string,
    typ: string,
    priorytet: string,
    link: string,
    wymagane_uprawnienie?: string
  ) {
    const exists = await this.prisma.extendedClient.powiadomienie.findFirst({
      where: { id_organizacji, tytul, typ, aktywny: true, data_utworzenia: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (exists) return;

    await this.prisma.extendedClient.powiadomienie.create({
      data: {
        id_organizacji,
        tytul,
        tresc,
        typ,
        priorytet,
        link,
        wymagane_uprawnienie: wymagane_uprawnienie || null,
      },
    });
  }
}