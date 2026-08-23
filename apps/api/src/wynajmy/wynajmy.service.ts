import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WynajmyService {
  constructor(private readonly prisma: PrismaService) {}

  private n(v: any) { return v === '' || v == null ? null : Number(v); }
  private d(v: any) { return v ? new Date(v) : null; }
  private cleanString(v: any) { return v === null || v === undefined ? null : String(v).trim(); }
  private cleanNumber(v: any) { const parsed = Number(v); return isNaN(parsed) || v === '' || v === null ? null : parsed; }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.wynajem.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        kontrahent: true,
        status: true,
        oferta: true,
        // EVENTFLOW_PRODUCT_POLISH_V8: wiele ofert bezpośrednio przypisanych do jednego wynajmu.
        oferty: { where: { aktywny: true }, include: { status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } }, orderBy: { data_utworzenia: 'desc' } },
        pozycje: { include: { model: true, egzemplarz: true } },
      },
      orderBy: { data_wydania: 'desc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const item = await this.prisma.extendedClient.wynajem.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        kontrahent: true,
        kontakt: true,
        manager: true,
        miejsce: true,
        status: true,
        status_magazynowy: true,
        status_ksiegowy: true,
        oferta: true,
        oferty: { where: { aktywny: true }, include: { status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } }, orderBy: { data_utworzenia: 'desc' } },
        pozycje: { include: { model: true, egzemplarz: true } },
        ekipa: { where: { aktywny: true }, include: { uzytkownik: true } },
        pojazdy: { where: { aktywny: true }, include: { pojazd: true } },
        zadania: { where: { aktywny: true }, include: { przypisani_uzytkownicy: { include: { uzytkownik: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Nie znaleziono wynajmu');

    const historia = await this.prisma.extendedClient.logZmian.findMany({
      where: { id_organizacji, typ_obiektu: 'Wynajem', id_obiektu: id },
      orderBy: { data_utworzenia: 'desc' },
      include: { uzytkownik: true },
    });

    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'Wynajem', id_obiektu: id, aktywny: true },
      orderBy: { data_utworzenia: 'desc' },
      include: { dodal: { select: { imie: true, nazwisko: true } } }
    });

    return { ...item, historia, zalaczniki };
  }

  async create(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wynajem.create({
      data: {
        id_organizacji,
        numer: dto.numer || `W/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
        nazwa: dto.nazwa || null,
        id_oferty: this.n(dto.id_oferty),
        id_kontrahenta: this.n(dto.id_kontrahenta),
        id_kontaktu: this.n(dto.id_kontaktu),
        id_managera: this.n(dto.id_managera),
        id_miejsca: this.n(dto.id_miejsca),
        id_statusu_wynajmu: this.n(dto.id_statusu_wynajmu),
        id_statusu_magazynowego: this.n(dto.id_statusu_magazynowego),
        id_statusu_ksiegowego: this.n(dto.id_statusu_ksiegowego),
        budzet_netto: dto.budzet_netto ? Number(dto.budzet_netto) : null,
        miejsce_reczne: dto.miejsce_reczne || null,
        adres_reczny: dto.adres_reczny || null,
        data_wydania: this.d(dto.data_wydania),
        data_zwrotu_planowana: this.d(dto.data_zwrotu_planowana),
        data_zwrotu_rzeczywista: this.d(dto.data_zwrotu_rzeczywista),
        notatki_wewnetrzne: dto.notatki_wewnetrzne || null,
      },
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.wynajem.update({
      where: { id },
      data: {
        numer: dto.numer || undefined,
        nazwa: dto.nazwa !== undefined ? dto.nazwa : undefined,
        id_oferty: dto.id_oferty !== undefined ? this.n(dto.id_oferty) : undefined,
        id_kontrahenta: dto.id_kontrahenta !== undefined ? this.n(dto.id_kontrahenta) : undefined,
        id_kontaktu: dto.id_kontaktu !== undefined ? this.n(dto.id_kontaktu) : undefined,
        id_managera: dto.id_managera !== undefined ? this.n(dto.id_managera) : undefined,
        id_miejsca: dto.id_miejsca !== undefined ? this.n(dto.id_miejsca) : undefined,
        id_statusu_wynajmu: dto.id_statusu_wynajmu !== undefined ? this.n(dto.id_statusu_wynajmu) : undefined,
        id_statusu_magazynowego: dto.id_statusu_magazynowego !== undefined ? this.n(dto.id_statusu_magazynowego) : undefined,
        id_statusu_ksiegowego: dto.id_statusu_ksiegowego !== undefined ? this.n(dto.id_statusu_ksiegowego) : undefined,
        budzet_netto: dto.budzet_netto !== undefined ? this.n(dto.budzet_netto) : undefined,
        miejsce_reczne: dto.miejsce_reczne !== undefined ? dto.miejsce_reczne : undefined,
        adres_reczny: dto.adres_reczny !== undefined ? dto.adres_reczny : undefined,
        data_wydania: dto.data_wydania !== undefined ? this.d(dto.data_wydania) : undefined,
        data_zwrotu_planowana: dto.data_zwrotu_planowana !== undefined ? this.d(dto.data_zwrotu_planowana) : undefined,
        data_zwrotu_rzeczywista: dto.data_zwrotu_rzeczywista !== undefined ? this.d(dto.data_zwrotu_rzeczywista) : undefined,
        notatki_wewnetrzne: dto.notatki_wewnetrzne !== undefined ? dto.notatki_wewnetrzne : undefined,
      },
    });
  }

  async remove(id: number, id_organizacji: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.wynajem.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }

  async addPozycja(id_wynajmu: number, dto: any, id_organizacji: number) {
    await this.findOne(id_wynajmu, id_organizacji);
    return this.prisma.extendedClient.pozycjaWynajmu.create({
      data: {
        id_organizacji,
        id_wynajmu,
        id_modelu: Number(dto.id_modelu),
        id_egzemplarza: this.n(dto.id_egzemplarza),
        ilosc: Number(dto.ilosc || 1),
        notatki_wewnetrzne: dto.notatki_wewnetrzne || null,
      },
    });
  }

  // --- LOGIKA DO PLANU ZAKŁADKI "SPRZĘT" WYNAJMU ---

  async getSprzetWynajmu(id_wynajmu: number, id_organizacji: number) {
    const [wynajem, planPozycje, dokumenty] = await Promise.all([
      this.prisma.extendedClient.wynajem.findFirst({
        where: { id: id_wynajmu, id_organizacji, aktywny: true },
        include: { oferty: { where: { aktywny: true } } }
      }),
      this.prisma.extendedClient.pozycjaWynajmu.findMany({
        where: { id_organizacji, id_wynajmu, aktywny: true },
        include: { model: { include: { kategoria: true } }, egzemplarz: true },
        orderBy: [{ data_utworzenia: 'asc' }]
      }),
      this.prisma.extendedClient.wydanieMagazynowe.findMany({
        where: { id_organizacji, id_wynajmu, aktywny: true },
        include: {
          pozycje: {
            where: { aktywny: true },
            include: {
              model: { include: { kategoria: true } },
              egzemplarz: { include: { model: { include: { kategoria: true } }, magazyn: true, case: { include: { model: true } } } },
            },
          },
        },
        orderBy: { data_operacji: 'desc' },
      }),
    ]);

    if (!wynajem) throw new NotFoundException('Nie znaleziono wynajmu');

    const toNumber = (value: any) => Number(value || 0);
    const keyFor = (p: any) => String(p.id_modelu || p.model?.id || p.egzemplarz?.id_modelu || p.egzemplarz?.model?.id || p.nazwa);
    const nameFor = (p: any) => p.nazwa || p.model?.nazwa || p.egzemplarz?.model?.nazwa || p.egzemplarz?.nazwa || 'Pozycja sprzętu';
    const categoryFor = (p: any) => p.model?.kategoria?.nazwa || p.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii';
    const codeFor = (p: any) => p.egzemplarz?.kod_kreskowy || p.egzemplarz?.zewnetrzny_kod_kreskowy || p.egzemplarz?.zewnetrzny_qr_kod || p.egzemplarz?.qr_kod || p.egzemplarz?.sn || p.model?.kod_kreskowy || '';

    const planowane = planPozycje.map((p: any) => ({
      ...p,
      zrodlo: 'plan',
      klucz_sprzetu: keyFor(p),
      nazwa: nameFor(p),
      kategoria: categoryFor(p),
      kod: '',
      ilosc: toNumber(p.ilosc || 1),
      planowana_ilosc: toNumber(p.ilosc || 1)
    }));

    const dokumentowe = dokumenty.flatMap((d: any) =>
      (d.pozycje || []).map((p: any) => ({
        ...p,
        zrodlo: d.typ,
        id_dokumentu: d.id,
        numer_dokumentu: d.numer,
        klucz_sprzetu: keyFor(p),
        nazwa: nameFor(p),
        kategoria: categoryFor(p),
        kod: codeFor(p),
        ilosc: toNumber(p.ilosc || 1),
      }))
    );

    const summary = new Map<string, any>();
    for (const p of planowane) {
      const key = p.klucz_sprzetu;
      if (!summary.has(key)) summary.set(key, { ...p, planowana_ilosc: 0, wydana_ilosc: 0, przyjeta_ilosc: 0, dodatkowa_ilosc: 0 });
      summary.get(key).planowana_ilosc += toNumber(p.ilosc);
    }
    for (const p of dokumentowe) {
      const key = p.klucz_sprzetu;
      if (!summary.has(key)) summary.set(key, { ...p, planowana_ilosc: 0, wydana_ilosc: 0, przyjeta_ilosc: 0, dodatkowa_ilosc: 0 });
      if (p.zrodlo === 'wydanie') summary.get(key).wydana_ilosc += toNumber(p.ilosc);
      if (p.zrodlo === 'przyjecie') summary.get(key).przyjeta_ilosc += toNumber(p.ilosc);
      if (p.status === 'dodatkowy' || (!p.id_modelu && !p.id_egzemplarza)) summary.get(key).dodatkowa_ilosc += toNumber(p.ilosc);
    }

    const pozycje = Array.from(summary.values()).map((p: any) => ({
      ...p,
      do_wydania: Math.max(0, toNumber(p.planowana_ilosc) - toNumber(p.wydana_ilosc)),
      do_przyjecia: Math.max(0, toNumber(p.wydana_ilosc) - toNumber(p.przyjeta_ilosc)),
      stan_operacyjny: toNumber(p.wydana_ilosc) > toNumber(p.przyjeta_ilosc) ? 'wydany' : toNumber(p.planowana_ilosc) > 0 ? 'zaplanowany' : 'dodatkowy',
    }));

    const kategorie = pozycje.reduce((acc: any[], p: any) => {
      const nazwa = p.kategoria || 'Bez kategorii';
      let group = acc.find((g: any) => g.nazwa === nazwa);
      if (!group) {
        group = { nazwa, pozycje: [], planowana_ilosc: 0, wydana_ilosc: 0, przyjeta_ilosc: 0 };
        acc.push(group);
      }
      group.pozycje.push(p);
      group.planowana_ilosc += toNumber(p.planowana_ilosc);
      group.wydana_ilosc += toNumber(p.wydana_ilosc);
      group.przyjeta_ilosc += toNumber(p.przyjeta_ilosc);
      return acc;
    }, []).sort((a: any, b: any) => a.nazwa.localeCompare(b.nazwa, 'pl'));

    return {
      wynajem,
      dokumenty,
      planowane,
      pozycje_dokumentow: dokumentowe,
      pozycje,
      kategorie,
      podsumowanie: {
        planowane: planowane.reduce((s: number, p: any) => s + toNumber(p.ilosc), 0),
        wydane: dokumentowe.filter((p: any) => p.zrodlo === 'wydanie').reduce((s: number, p: any) => s + toNumber(p.ilosc), 0),
        przyjete: dokumentowe.filter((p: any) => p.zrodlo === 'przyjecie').reduce((s: number, p: any) => s + toNumber(p.ilosc), 0),
      },
    };
  }

  async updatePlanSprzetu(id_wynajmu: number, dto: any, id_organizacji: number) {
    const pozycje = Array.isArray(dto.pozycje) ? dto.pozycje : [];

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const wynajem = await tx.wynajem.findFirst({ where: { id: id_wynajmu, id_organizacji, aktywny: true } });
      if (!wynajem) throw new NotFoundException('Nie znaleziono wynajmu');

      if (dto?.replace === true) {
        await tx.pozycjaWynajmu.updateMany({
          where: { id_organizacji, id_wynajmu, aktywny: true },
          data: { aktywny: false, data_usuniecia: new Date() },
        });
      }

      const byModel = new Map<number, { ilosc: number; uwagi?: string | null | undefined }>();

      for (const p of pozycje) {
        let id_modelu = this.cleanNumber(p.id_modelu);
        const id_egzemplarza = this.cleanNumber(p.id_egzemplarza);
        const ilosc = this.cleanNumber(p.ilosc) || 0;

        if (ilosc <= 0) continue;

        if (!id_modelu && id_egzemplarza) {
          const egz = await tx.egzemplarz.findFirst({ where: { id: id_egzemplarza, id_organizacji }, select: { id_modelu: true } });
          id_modelu = egz?.id_modelu || null;
        }

        if (!id_modelu) continue;

        const existing = byModel.get(id_modelu) || { ilosc: 0, uwagi: p.uwagi || null };
        existing.ilosc += ilosc;
        byModel.set(id_modelu, existing);
      }

      for (const [id_modelu, data] of byModel.entries()) {
        const existing = await tx.pozycjaWynajmu.findFirst({
          where: { id_organizacji, id_wynajmu, id_modelu, aktywny: true },
        });

        if (existing) {
          await tx.pozycjaWynajmu.update({
            where: { id: existing.id },
            data: {
              ilosc: data.ilosc,
              notatki_wewnetrzne: data.uwagi || null,
              aktywny: true,
              data_usuniecia: null,
            },
          });
        } else {
          await tx.pozycjaWynajmu.create({
            data: {
              id_organizacji,
              id_wynajmu,
              id_modelu,
              ilosc: data.ilosc,
              notatki_wewnetrzne: data.uwagi || null,
            },
          });
        }
      }

      return { success: true };
    });
  }
  async addChat(id: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.logZmian.create({
      data: { id_organizacji, id_uzytkownika, typ_obiektu: 'Wynajem', id_obiektu: id, akcja: 'CHAT', nowa_wartosc: dto.message }
    });
  }

  async addCrew(id_wynajmu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemUzytkownik.create({
      data: { id_organizacji, id_wynajmu, id_uzytkownika: Number(dto.id_uzytkownika), rola_w_wynajmie: dto.rola }
    });
  }

  async removeCrew(id_wynajmu: number, id_ekipy: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemUzytkownik.updateMany({
      where: { id: id_ekipy, id_wynajmu, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }

  async addFleet(id_wynajmu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemPojazd.create({
      data: { id_organizacji, id_wynajmu, id_pojazdu: Number(dto.id_pojazdu), rola_pojazdu: dto.rola }
    });
  }

  async removeFleet(id_wynajmu: number, id_floty: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemPojazd.updateMany({
      where: { id: id_floty, id_wynajmu, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }

  async addAttachment(id: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.zalacznik.create({
      data: { id_organizacji, typ_obiektu: 'Wynajem', id_obiektu: id, nazwa: dto.nazwa, nazwa_pliku: dto.nazwa_pliku, rozmiar_bajtow: dto.rozmiar, mime: dto.mime, id_uzytkownika_dodal: id_uzytkownika }
    });
  }

  async removeAttachment(id: number, zalId: number, id_organizacji: number) {
    return this.prisma.extendedClient.zalacznik.updateMany({
      where: { id: zalId, id_obiektu: id, typ_obiektu: 'Wynajem', id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }
}