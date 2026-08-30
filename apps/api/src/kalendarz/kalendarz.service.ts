import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KalendarzService {
  constructor(private readonly prisma: PrismaService) {}

  private dateOrNull(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private range(query: any) {
    const today = new Date();
    const from = this.dateOrNull(query.od) ?? new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = this.dateOrNull(query.do) ?? new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { from, to };
  }

  async findAll(id_organizacji: number, query: any) {
    const { from, to } = this.range(query);

    const [
      wydarzenia,
      wynajmy,
      urlopy,
      serwisy,
      pojazdyInfo,
      serwisyPojazdow,
      przegladyPojazdow,
      zadania,
    ] = await Promise.all([
      // 1. Wydarzenia
      this.prisma.extendedClient.wydarzenie.findMany({
        where: {
          id_organizacji,
          aktywny: true,
          data_start: { lte: to },
          data_koniec: { gte: from },
        },
        include: {
          typ: true,
          status: true,
          status_magazynowy: true,
          status_ksiegowy: true,
          miejsce: true,
          kontrahent: true,
        },
        orderBy: { data_start: 'asc' },
      }),

      // 2. Wynajmy
      this.prisma.extendedClient.wynajem.findMany({
        where: {
          id_organizacji,
          aktywny: true,
          data_wydania: { lte: to },
          data_zwrotu_planowana: { gte: from },
        },
        include: { status: true, kontrahent: true },
        orderBy: { data_wydania: 'asc' },
      }),

      // 3. Urlopy i nieobecności
      this.prisma.extendedClient.nieobecnosc.findMany({
        where: {
          id_organizacji,
          aktywny: true,
          data_od: { lte: to },
          data_do: { gte: from },
        },
        include: { uzytkownik: true },
        orderBy: { data_od: 'asc' },
      }),

      // 4. Serwis sprzętu
      this.prisma.extendedClient.serwisSprzetu.findMany({
        where: { id_organizacji, aktywny: true, data_zgloszenia: { lte: to } },
        include: { status: true, egzemplarz: { include: { model: true } } },
        take: 100,
        orderBy: { data_zgloszenia: 'desc' },
      }),

      // 5. Daty badań technicznych (SKP) i polis OC z kart aut
      this.prisma.extendedClient.pojazd.findMany({
        where: {
          id_organizacji,
          aktywny: true,
          OR: [
            { data_przegladu: { gte: from, lte: to } },
            { data_oc: { gte: from, lte: to } },
          ],
        },
      }),

      // 6. Zgłoszenia serwisowe floty (naprawy, awarie)
      this.prisma.extendedClient.serwisPojazdu.findMany({
        where: { id_organizacji, aktywny: true, data_serwisu: { gte: from, lte: to } },
        include: { pojazd: true },
        orderBy: { data_serwisu: 'asc' },
      }),

      // 7. Przeglądy okresowe floty
      this.prisma.extendedClient.przegladPojazdu.findMany({
        where: { id_organizacji, aktywny: true, data_przegladu: { gte: from, lte: to } },
        include: { pojazd: true },
        orderBy: { data_przegladu: 'asc' },
      }),

      // 8. Zadania
      this.prisma.extendedClient.zadanie.findMany({
        where: {
          id_organizacji,
          aktywny: true,
          data_start: { lte: to },
          data_koniec: { gte: from },
        },
        include: { przypisani_uzytkownicy: { include: { uzytkownik: true } } },
      }),
    ]);

    const items = [
      // Wydarzenia
      ...wydarzenia.map((w: any) => ({
        id: `wydarzenie-${w.id}`,
        sourceId: w.id,
        typ: 'wydarzenie',
        tytul: w.nazwa,
        start: w.data_start,
        koniec: w.data_koniec,
        kolor: w.typ?.kolor ?? '#06B6D4',
        ikona: w.status?.ikona ?? '●',
        status: w.status?.nazwa ?? 'Bez statusu',
        statusMagazynowy: w.status_magazynowy?.nazwa ?? '',
        statusKsiegowy: w.status_ksiegowy?.nazwa ?? '',
        ikonaMagazynowa: w.status_magazynowy?.ikona ?? '',
        ikonaKsiegowa: w.status_ksiegowy?.ikona ?? '',
        miejsce: w.miejsce?.nazwa ?? w.miejsce_reczne ?? '',
        opis: w.opis,
      })),

      // Wynajmy
      ...wynajmy.map((w: any) => ({
        id: `wynajem-${w.id}`,
        sourceId: w.id,
        typ: 'wypozyczenie',
        tytul: w.numer ? `Wypożyczenie ${w.numer}` : `Wypożyczenie #${w.id}`,
        start: w.data_wydania,
        koniec: w.data_zwrotu_planowana,
        kolor: '#F97316',
        ikona: '📦',
        status: w.status?.nazwa ?? 'Wynajem',
        miejsce: w.kontrahent?.nazwa ?? '',
      })),

      // Urlopy
      ...urlopy.map((u: any) => ({
        id: `urlop-${u.id}`,
        sourceId: u.id,
        typ: 'urlop',
        tytul: `${u.typ || 'Urlop'}: ${u.uzytkownik?.imie || ''} ${u.uzytkownik?.nazwisko || ''}`.trim(),
        start: u.data_od,
        koniec: u.data_do,
        kolor: '#242527',
        ikona: '🌴',
        status: 'Nieobecność',
        miejsce: '',
      })),

      // Serwisy sprzętu
      ...serwisy.map((s: any) => ({
        id: `serwis-${s.id}`,
        sourceId: s.id,
        typ: 'serwis',
        tytul: `Serwis: ${s.egzemplarz?.model?.nazwa ?? s.tytul}`,
        start: s.data_zgloszenia,
        koniec: s.data_rozwiazania,
        kolor: s.status?.kolor ?? '#EF4444',
        ikona: '🔧',
        status: s.status?.nazwa ?? 'Serwis',
        miejsce: s.egzemplarz?.nazwa ?? '',
      })),

      // Informacyjne wpisy floty (SKP / OC)
      ...pojazdyInfo.flatMap((p: any) => [
        p.data_przegladu
          ? {
              id: `flota-przeglad-${p.id}`,
              sourceId: p.id,
              typ: 'flota',
              tytul: `Przegląd techniczny SKP: ${p.nazwa}`,
              start: p.data_przegladu,
              koniec: p.data_przegladu,
              kolor: '#0EA5E9',
              ikona: '🚗',
              status: 'Wpis informacyjny - przegląd',
              miejsce: p.nr_rejestracyjny,
              editable: false,
            }
          : null,
        p.data_oc
          ? {
              id: `flota-oc-${p.id}`,
              sourceId: p.id,
              typ: 'flota',
              tytul: `Ważność OC: ${p.nazwa}`,
              start: p.data_oc,
              koniec: p.data_oc,
              kolor: '#6366F1',
              ikona: '🛡️',
              status: 'Wpis informacyjny - OC',
              miejsce: p.nr_rejestracyjny,
              editable: false,
            }
          : null,
      ].filter(Boolean)),

      // Zgłoszenia serwisowe floty (naprawy, usterki)
      ...serwisyPojazdow.map((s: any) => ({
        id: `flota-serwis-${s.id}`,
        sourceId: s.id,
        typ: 'flota',
        tytul: `Serwis pojazdu: ${s.pojazd?.nazwa || 'Pojazd'}`,
        start: s.data_serwisu,
        koniec: s.data_serwisu,
        kolor: '#F59E0B',
        ikona: '🔧',
        status: 'Serwis pojazdu',
        miejsce: s.pojazd?.nr_rejestracyjny || '',
        editable: false,
      })),

      // Przeglądy okresowe floty
      ...przegladyPojazdow.map((p: any) => ({
        id: `flota-przeglad-hist-${p.id}`,
        sourceId: p.id,
        typ: 'flota',
        tytul: `Przegląd ${p.typ}: ${p.pojazd?.nazwa || 'Pojazd'}`,
        start: p.data_przegladu,
        koniec: p.data_przegladu,
        kolor: '#2563EB',
        ikona: '🚗',
        status: 'Przegląd floty',
        miejsce: p.pojazd?.nr_rejestracyjny || '',
        editable: false,
      })),

      // Zadania
      ...zadania.map((z: any) => ({
        id: `zadanie-${z.id}`,
        sourceId: z.id,
        typ: 'zadanie',
        tytul: z.tytul,
        start: z.data_start,
        koniec: z.data_koniec,
        kolor: '#8B5CF6',
        ikona: '📋',
        status: z.status || 'nowe',
        miejsce: z.przypisani_uzytkownicy?.map((u: any) => u.uzytkownik?.imie).filter(Boolean).join(', ') || '',
      })),
    ].filter((item) => item.start);

    return { from, to, items };
  }

  async quickAdd(id_organizacji: number, id_uzytkownika: number, dto: any) {
    const typ = dto.typ;
    if (!typ) throw new BadRequestException('Brak typu wpisu kalendarza');

    if (typ === 'urlop') {
      return this.prisma.extendedClient.nieobecnosc.create({
        data: {
          id_organizacji,
          id_uzytkownika: Number(dto.id_uzytkownika || id_uzytkownika),
          typ: dto.rodzaj || 'urlop',
          data_od: new Date(dto.data_start),
          data_do: new Date(dto.data_koniec || dto.data_start),
          opis: dto.opis || null,
        },
      });
    }

    if (typ === 'wypozyczenie') {
      return this.prisma.extendedClient.wynajem.create({
        data: {
          id_organizacji,
          numer: dto.numer || `W/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
          id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
          data_wydania: new Date(dto.data_start),
          data_zwrotu_planowana: new Date(dto.data_koniec || dto.data_start),
          notatki_wewnetrzne: dto.opis || null,
        },
      });
    }

    return this.prisma.extendedClient.wydarzenie.create({
      data: {
        id_organizacji,
        id_tworcy: id_uzytkownika,
        nazwa: dto.nazwa || (typ === 'spotkanie' ? 'Spotkanie' : typ === 'prywatne' ? 'Wydarzenie prywatne' : 'Nowe wydarzenie'),
        opis: dto.opis || null,
        data_start: new Date(dto.data_start),
        data_koniec: new Date(dto.data_koniec || dto.data_start),
        id_typu_wydarzenia: dto.id_typu_wydarzenia ? Number(dto.id_typu_wydarzenia) : null,
        id_statusu_wydarzenia: dto.id_statusu_wydarzenia ? Number(dto.id_statusu_wydarzenia) : null,
        id_kontrahenta: dto.id_kontrahenta ? Number(dto.id_kontrahenta) : null,
        id_miejsca: dto.id_miejsca ? Number(dto.id_miejsca) : null,
        miejsce_reczne: dto.miejsce_reczne || null,
        adres_reczny: dto.adres_reczny || null,
        link_google_maps: dto.adres_reczny ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dto.adres_reczny)}` : null,
      },
    });
  }
}