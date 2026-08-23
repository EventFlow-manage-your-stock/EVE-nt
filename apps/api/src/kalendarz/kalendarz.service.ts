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
    const from = this.dateOrNull(query.od) ?? new Date(today.getFullYear(), today.getMonth(), 1);
    const to = this.dateOrNull(query.do) ?? new Date(today.getFullYear(), today.getMonth() + 1, 7);
    return { from, to };
  }

  async findAll(id_organizacji: number, query: any) {
    const { from, to } = this.range(query);

    const [wydarzenia, wynajmy, urlopy, pojazdy, pojazdyInfo, przegladyPojazdow] = await Promise.all([
      this.prisma.extendedClient.wydarzenie.findMany({
        where: { id_organizacji, aktywny: true, data_start: { lte: to }, data_koniec: { gte: from } },
        include: { typ: true, status: true, status_magazynowy: true, status_ksiegowy: true, miejsce: true, kontrahent: true },
        orderBy: { data_start: 'asc' },
      }),
      this.prisma.extendedClient.wynajem.findMany({
        // EVENTFLOW_PRODUCT_POLISH_V18:
        // Wynajmy powiązane z wydarzeniem nie dostają osobnego paska w kalendarzu.
        // Samo wydarzenie jest widoczne jako główny pasek, a wynajem/sprzęt obsługujemy w panelu wydarzenia.
        where: {
          id_organizacji,
          aktywny: true,
          // EVENTFLOW_PRODUCT_POLISH_V28: wynajem jest osobnym bytem. Stare powiązania z wydarzeniem są czyszczone skryptem SQL w komendach V28.
          data_wydania: { lte: to },
          data_zwrotu_planowana: { gte: from },
        },
        include: { status: true, kontrahent: true },
        orderBy: { data_wydania: 'asc' },
      }),
      this.prisma.extendedClient.nieobecnosc.findMany({
        where: { id_organizacji, aktywny: true, data_od: { lte: to }, data_do: { gte: from } },
        include: { uzytkownik: true },
        orderBy: { data_od: 'asc' },
      }),
      this.prisma.extendedClient.wydarzeniePojazd.findMany({
        where: { id_organizacji, aktywny: true, wydarzenie: { data_start: { lte: to }, data_koniec: { gte: from } } },
        include: { pojazd: true, wydarzenie: true },
      }),
      // EVENTFLOW_PRODUCT_POLISH_V7: daty OC i przeglądu z karty pojazdu pokazujemy jako wpisy informacyjne.
      // EVENTFLOW_PRODUCT_POLISH_V11: wpisy floty mają ikonę auta w kalendarzu ogólnym i kalendarzu floty.
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
      this.prisma.extendedClient.przegladPojazdu.findMany({
        where: { id_organizacji, aktywny: true, data_przegladu: { gte: from, lte: to } },
        include: { pojazd: true },
        orderBy: { data_przegladu: 'asc' },
      }),
    ]);

    const items = [
      ...wydarzenia.map((w) => ({
        id: `wydarzenie-${w.id}`,
        sourceId: w.id,
        typ: 'wydarzenie',
        tytul: w.nazwa,
        start: w.data_start,
        koniec: w.data_koniec,
        kolor: w.typ?.kolor ?? '#06B6D4',
        ikona: (w.status as any)?.ikona ?? '•',
        status: w.status?.nazwa ?? 'Bez statusu',
        statusMagazynowy: w.status_magazynowy?.nazwa ?? '',
        statusKsiegowy: w.status_ksiegowy?.nazwa ?? '',
        ikonaMagazynowa: (w.status_magazynowy as any)?.ikona ?? '',
        ikonaKsiegowa: (w.status_ksiegowy as any)?.ikona ?? '',
        miejsce: w.miejsce?.nazwa ?? (w as any).miejsce_reczne ?? '',
        opis: w.opis,
      })),
      ...wynajmy.map((w) => ({
        id: `wynajem-${w.id}`,
        sourceId: w.id,
        typ: 'wypozyczenie',
        tytul: w.numer ? `Wypożyczenie ${w.numer}` : `Wypożyczenie #${w.id}`,
        start: w.data_wydania,
        koniec: w.data_zwrotu_planowana,
        kolor: '#F97316',
        ikona: '•',
        status: w.status?.nazwa ?? 'Wynajem',
        miejsce: w.kontrahent?.nazwa ?? '',
      })),
      ...urlopy.map((u) => ({
        id: `urlop-${u.id}`,
        sourceId: u.id,
        typ: 'urlop',
        tytul: `${u.typ}: ${u.uzytkownik.imie} ${u.uzytkownik.nazwisko}`,
        start: u.data_od,
        koniec: u.data_do,
        kolor: '#22C55E',
        ikona: '•',
        status: 'Nieobecność',
        miejsce: '',
      })),
      ...pojazdyInfo.flatMap((p) => [
        p.data_przegladu ? {
          id: `flota-przeglad-${p.id}`,
          sourceId: p.id,
          typ: 'flota',
          tytul: `Przegląd techniczny: ${p.nazwa}`,
          start: p.data_przegladu,
          koniec: p.data_przegladu,
          kolor: '#0EA5E9',
          ikona: '•',
          status: 'Wpis informacyjny - przegląd',
          miejsce: p.nr_rejestracyjny,
          editable: false,
        } : null,
        p.data_oc ? {
          id: `flota-oc-${p.id}`,
          sourceId: p.id,
          typ: 'flota',
          tytul: `OC: ${p.nazwa}`,
          start: p.data_oc,
          koniec: p.data_oc,
          kolor: '#6366F1',
          ikona: '•',
          status: 'Wpis informacyjny - OC',
          miejsce: p.nr_rejestracyjny,
          editable: false,
        } : null,
      ].filter(Boolean)),
      ...przegladyPojazdow.map((p) => ({
        id: `flota-przeglad-hist-${p.id}`,
        sourceId: p.id,
        typ: 'flota',
        tytul: `Przegląd ${p.typ}: ${p.pojazd?.nazwa ?? ''}`,
        start: p.data_przegladu,
        koniec: p.data_przegladu,
        kolor: '#2563EB',
        ikona: '•',
        status: 'Wpis informacyjny - przegląd floty',
        miejsce: p.pojazd?.nr_rejestracyjny ?? '',
        editable: false,
      })),
      ...pojazdy.map((p) => ({
        id: `flota-${p.id}`,
        sourceId: p.id,
        typ: 'flota',
        tytul: `${p.pojazd.nazwa} - ${p.wydarzenie.nazwa}`,
        start: p.wydarzenie.data_start,
        koniec: p.wydarzenie.data_koniec,
        kolor: '#3B82F6',
        ikona: '•',
        status: p.rola_pojazdu ?? 'Rezerwacja auta',
        miejsce: p.pojazd.nr_rejestracyjny,
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

    // Spotkanie i wydarzenie prywatne trzymamy jako wydarzenia z odpowiednim typem.
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