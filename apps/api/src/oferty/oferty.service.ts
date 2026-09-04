import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OfertyService {
  constructor(private readonly prisma: PrismaService) {}
  private n(v: any) { return v === '' || v == null ? null : Number(v); }
  private lineBase(p: any) {
    const savedBase = Number(p.cena_przed_budzetem_netto || 0);
    if (savedBase > 0) return savedBase;
    const cena = Number(p.cena_netto || 0);
    const ilosc = Number(p.ilosc || 1);
    const dni = Number(p.dni_pracy || 1);
    const rabat = Number(p.rabat_proc || 0);
    return cena * ilosc * dni * (1 - rabat / 100);
  }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.oferta.findMany({
      where: { id_organizacji, aktywny: true },
      include: { kontrahent: true, wydarzenie: true, wynajem: true, status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } },
      orderBy: { data_utworzenia: 'desc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const oferta = await this.prisma.extendedClient.oferta.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        organizacja: true,
        kontrahent: true,
        wydarzenie: true,
        wynajem: true,
        status: true,
        wersje: {
          orderBy: { numer_wersji: 'desc' },
          include: {
            sekcje: {
              where: { aktywny: true },
              orderBy: [{ kolejnosc: 'asc' }, { id: 'asc' }], // Deterministyczne sortowanie sekcji
              include: {
                pozycje: {
                  where: { aktywny: true },
                  orderBy: [{ kolejnosc: 'asc' }, { id: 'asc' }], // Deterministyczne sortowanie pozycji
                  include: { model: true, kategoria: true },
                },
              },
            },
            pozycje: { where: { aktywny: true } },
          },
        },
      },
    });
    if (!oferta) throw new NotFoundException('Nie znaleziono oferty');
    return oferta;
  }

  async create(dto: any, id_organizacji: number, id_uzytkownika: number) {
    // EVENTFLOW_PRODUCT_POLISH_V5: nowa oferta może być utworzona z innej oferty jako szablonu.
    if (dto.id_oferty_szablonu) {
      const copied = await this.duplikujOferte(Number(dto.id_oferty_szablonu), id_organizacji, id_uzytkownika, { id_wydarzenia: dto.id_wydarzenia, id_wynajmu: dto.id_wynajmu });
      return this.update(copied.id, {
        nazwa: dto.nazwa || copied.nazwa,
        id_wydarzenia: dto.id_wydarzenia,
        id_wynajmu: dto.id_wynajmu,
        id_kontrahenta: dto.id_kontrahenta,
        budzet_netto: dto.budzet_netto,
        budzet_brutto: dto.budzet_brutto,
        warunki_zamowienia: dto.warunki_zamowienia,
        notatki_wewnetrzne: dto.notatki_wewnetrzne,
      }, id_organizacji);
    }

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const oferta = await tx.oferta.create({
        data: {
          id_organizacji,
          id_wydarzenia: this.n(dto.id_wydarzenia),
          id_wynajmu: this.n(dto.id_wynajmu),
          id_kontrahenta: this.n(dto.id_kontrahenta),
          id_kontaktu: this.n(dto.id_kontaktu),
          id_managera: this.n(dto.id_managera) || id_uzytkownika,
          id_statusu_oferty: this.n(dto.id_statusu_oferty),
          numer: dto.numer || `O/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
          nazwa: dto.nazwa || 'Nowa oferta',
          data_sporzadzenia: dto.data_sporzadzenia ? new Date(dto.data_sporzadzenia) : new Date(),
          budzet_netto: this.n(dto.budzet_netto),
          budzet_brutto: this.n(dto.budzet_brutto),
          termin_platnosci_dni: Number(dto.termin_platnosci_dni || 14),
        },
      });
      const wersja = await tx.wersjaOferty.create({
        data: { id_organizacji, id_oferty: oferta.id, numer_wersji: 1, nazwa: oferta.nazwa, id_uzytkownika_utworzyl: id_uzytkownika },
      });
      
      await tx.sekcjaOferty.create({ data: { id_organizacji, id_wersji_oferty: wersja.id, nazwa: 'Obsługa', kolejnosc: 1 } });
      await tx.sekcjaOferty.create({ data: { id_organizacji, id_wersji_oferty: wersja.id, nazwa: 'Sprzęt', kolejnosc: 2 } });
      await tx.sekcjaOferty.create({ data: { id_organizacji, id_wersji_oferty: wersja.id, nazwa: 'Usługi', kolejnosc: 3 } });
      await tx.sekcjaOferty.create({ data: { id_organizacji, id_wersji_oferty: wersja.id, nazwa: 'Transport', kolejnosc: 4 } });

      return oferta;
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.oferta.update({
      where: { id },
      data: {
        nazwa: dto.nazwa,
        id_statusu_oferty: dto.id_statusu_oferty !== undefined ? this.n(dto.id_statusu_oferty) : undefined, 
        termin_platnosci_dni: dto.termin_platnosci_dni !== undefined ? (Number(dto.termin_platnosci_dni) || 14) : undefined, 
        id_kontrahenta: dto.id_kontrahenta !== undefined ? this.n(dto.id_kontrahenta) : undefined,
        id_kontaktu: dto.id_kontaktu !== undefined ? this.n(dto.id_kontaktu) : undefined,
        id_managera: dto.id_managera !== undefined ? this.n(dto.id_managera) : undefined,
        id_wydarzenia: dto.id_wydarzenia !== undefined ? this.n(dto.id_wydarzenia) : undefined,
        id_wynajmu: dto.id_wynajmu !== undefined ? this.n(dto.id_wynajmu) : undefined,
        budzet_netto: dto.budzet_netto !== undefined ? this.n(dto.budzet_netto) : undefined,
        budzet_brutto: dto.budzet_brutto !== undefined ? this.n(dto.budzet_brutto) : undefined,
        warunki_zamowienia: dto.warunki_zamowienia !== undefined ? (dto.warunki_zamowienia || null) : undefined,
        notatki_wewnetrzne: dto.notatki_wewnetrzne !== undefined ? (dto.notatki_wewnetrzne || null) : undefined,
      },
    });
  }

  async remove(id: number, id_organizacji: number) {
    await this.findOne(id, id_organizacji); // Weryfikacja dostępu i istnienia
    return this.prisma.extendedClient.oferta.update({
      where: { id },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }

  private async aktualnaWersja(id_oferty: number, id_organizacji: number) {
    const wersja = await this.prisma.extendedClient.wersjaOferty.findFirst({ where: { id_organizacji, id_oferty, aktywny: true }, orderBy: { numer_wersji: 'desc' } });
    if (!wersja) throw new NotFoundException('Oferta nie ma wersji');
    return wersja;
  }

  async addSekcja(id_oferty: number, dto: any, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    return this.prisma.extendedClient.sekcjaOferty.create({ data: { id_organizacji, id_wersji_oferty: wersja.id, nazwa: dto.nazwa || 'Nowa sekcja', opis: dto.opis || null, kolor: dto.kolor || null, budzet_netto: this.n(dto.budzet_netto), kolejnosc: Number(dto.kolejnosc || 0) } });
  }

  async updateSekcja(id_oferty: number, id_sekcji: number, dto: any, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const section = await this.prisma.extendedClient.sekcjaOferty.findFirst({
      where: { id: id_sekcji, id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
    });
    if (!section) throw new NotFoundException('Nie znaleziono grupy sprzętowej');
    return this.prisma.extendedClient.sekcjaOferty.update({
      where: { id: id_sekcji },
      data: {
        nazwa: dto.nazwa ?? section.nazwa,
        opis: dto.opis ?? section.opis,
        kolor: dto.kolor ?? section.kolor,
        kolejnosc: dto.kolejnosc !== undefined ? Number(dto.kolejnosc) : section.kolejnosc,
        budzet_netto: dto.budzet_netto !== undefined ? this.n(dto.budzet_netto) : section.budzet_netto,
      },
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V16:
  // Usunięcie grupy sprzętowej nie kasuje fizycznie rekordu. Ukrywamy grupę i jej pozycje,
  // żeby historia oferty została odtwarzalna i bezpieczna audytowo.
  async deleteSekcja(id_oferty: number, id_sekcji: number, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const section = await this.prisma.extendedClient.sekcjaOferty.findFirst({
      where: { id: id_sekcji, id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
      include: { pozycje: { where: { aktywny: true } } },
    });
    if (!section) throw new NotFoundException('Nie znaleziono grupy sprzętowej');

    await this.prisma.extendedClient.$transaction(async (tx) => {
      await tx.pozycjaOferty.updateMany({
        where: { id_organizacji, id_wersji_oferty: wersja.id, id_sekcji, aktywny: true },
        data: { aktywny: false, data_usuniecia: new Date() },
      });
      await tx.sekcjaOferty.update({
        where: { id: id_sekcji },
        data: { aktywny: false, data_usuniecia: new Date() },
      });
    });

    await this.przelicz(id_oferty, id_organizacji);
    return { ok: true, usunieto_pozycji: section.pozycje.length };
  }

  async addPozycja(id_oferty: number, dto: any, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const ilosc = Number(dto.ilosc || 1);
    const dni = Number(dto.dni_pracy || 1);
    const cena = Number(dto.cena_netto || 0);
    const rabatProc = Number(dto.rabat_proc || 0);
    const nettoPrzedRabatem = cena * ilosc * dni;
    const rabatNetto = nettoPrzedRabatem * (rabatProc / 100);
    const razemNetto = nettoPrzedRabatem - rabatNetto;
    const vat = Number(dto.vat || 23);
    const razemVat = razemNetto * (vat / 100);
    const razemBrutto = razemNetto + razemVat;
    const pozycja = await this.prisma.extendedClient.pozycjaOferty.create({
      data: {
        id_organizacji,
        id_wersji_oferty: wersja.id,
        id_sekcji: this.n(dto.id_sekcji),
        id_kategorii: this.n(dto.id_kategorii),
        id_modelu: this.n(dto.id_modelu),
        id_ceny_sprzetu: this.n(dto.id_ceny_sprzetu),
        typ_pozycji: dto.typ_pozycji || 'sprzet',
        nazwa: dto.nazwa || 'Pozycja oferty',
        opis: dto.opis || null,
        uwagi: dto.uwagi || null,
        cena_netto: cena,
        ilosc,
        dni_pracy: dni,
        rabat_proc: rabatProc,
        rabat_netto: rabatNetto,
        cena_przed_budzetem_netto: razemNetto,
        vat,
        razem_netto: razemNetto,
        razem_vat: razemVat,
        razem_brutto: razemBrutto,
        kolejnosc: Number(dto.kolejnosc || 0),
      },
    });
    await this.przelicz(id_oferty, id_organizacji);
    return pozycja;
  }

  private policzPozycje(dto: any) {
    const ilosc = Number(dto.ilosc ?? 1);
    const dni = Number(dto.dni_pracy ?? 1);
    const cena = Number(dto.cena_netto ?? 0);
    const rabatProc = Number(dto.rabat_proc ?? 0);
    const vat = Number(dto.vat ?? 23);
    const nettoPrzedRabatem = cena * ilosc * dni;
    const rabatNetto = nettoPrzedRabatem * (rabatProc / 100);
    const razemNetto = nettoPrzedRabatem - rabatNetto;
    const razemVat = razemNetto * (vat / 100);
    const razemBrutto = razemNetto + razemVat;
    return {
      cena,
      ilosc,
      dni,
      rabatProc,
      rabatNetto,
      vat,
      razemNetto,
      razemVat,
      razemBrutto,
    };
  }

  // EVENTFLOW_PRODUCT_POLISH_V15:
  // Edycja pozycji oferty inline: sztuki, dni pracy, cena, rabat, VAT, typ pozycji i widoczność w PDF.
  async updatePozycja(id_oferty: number, id_pozycji: number, dto: any, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const existing = await this.prisma.extendedClient.pozycjaOferty.findFirst({
      where: { id: id_pozycji, id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
    });
    if (!existing) throw new NotFoundException('Nie znaleziono pozycji oferty');

    const merged = {
      ...existing,
      ...dto,
      cena_netto: dto.cena_netto !== undefined ? dto.cena_netto : existing.cena_netto,
      ilosc: dto.ilosc !== undefined ? dto.ilosc : existing.ilosc,
      dni_pracy: dto.dni_pracy !== undefined ? dto.dni_pracy : existing.dni_pracy,
      rabat_proc: dto.rabat_proc !== undefined ? dto.rabat_proc : existing.rabat_proc,
      vat: dto.vat !== undefined ? dto.vat : existing.vat,
    };
    const c = this.policzPozycje(merged);

    const updated = await this.prisma.extendedClient.pozycjaOferty.update({
      where: { id: id_pozycji },
      data: {
        id_sekcji: dto.id_sekcji !== undefined ? this.n(dto.id_sekcji) : existing.id_sekcji,
        id_kategorii: dto.id_kategorii !== undefined ? this.n(dto.id_kategorii) : existing.id_kategorii,
        id_modelu: dto.id_modelu !== undefined ? this.n(dto.id_modelu) : existing.id_modelu,
        typ_pozycji: dto.typ_pozycji ?? existing.typ_pozycji,
        nazwa: dto.nazwa ?? existing.nazwa,
        opis: dto.opis !== undefined ? dto.opis || null : existing.opis,
        uwagi: dto.uwagi !== undefined ? dto.uwagi || null : existing.uwagi,
        cena_netto: c.cena,
        ilosc: c.ilosc,
        dni_pracy: c.dni,
        rabat_proc: c.rabatProc,
        rabat_netto: c.rabatNetto,
        cena_przed_budzetem_netto: c.razemNetto,
        rabat_budzetowy_netto: 0,
        vat: c.vat,
        razem_netto: c.razemNetto,
        razem_vat: c.razemVat,
        razem_brutto: c.razemBrutto,
        kolejnosc: dto.kolejnosc !== undefined ? Number(dto.kolejnosc) : existing.kolejnosc,
        widoczna_w_pdf: dto.widoczna_w_pdf !== undefined ? Boolean(dto.widoczna_w_pdf) : existing.widoczna_w_pdf,
        zablokowana_przed_budzetem: dto.zablokowana_przed_budzetem !== undefined ? Boolean(dto.zablokowana_przed_budzetem) : existing.zablokowana_przed_budzetem,
      },
    });
    await this.przelicz(id_oferty, id_organizacji);
    return updated;
  }

  async deletePozycja(id_oferty: number, id_pozycji: number, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const existing = await this.prisma.extendedClient.pozycjaOferty.findFirst({
      where: { id: id_pozycji, id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
    });
    if (!existing) throw new NotFoundException('Nie znaleziono pozycji oferty');
    const deleted = await this.prisma.extendedClient.pozycjaOferty.update({
      where: { id: id_pozycji },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
    await this.przelicz(id_oferty, id_organizacji);
    return deleted;
  }

  async przelicz(id_oferty: number, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const pozycje = await this.prisma.extendedClient.pozycjaOferty.findMany({ where: { id_organizacji, id_wersji_oferty: wersja.id, aktywny: true } });
    const suma_netto = pozycje.reduce((a, p) => a + Number(p.razem_netto || 0), 0);
    const suma_vat = pozycje.reduce((a, p) => a + Number(p.razem_vat || 0), 0);
    const suma_brutto = pozycje.reduce((a, p) => a + Number(p.razem_brutto || 0), 0);
    const suma_sprzet_netto = pozycje.filter((p) => p.typ_pozycji === 'sprzet').reduce((a, p) => a + Number(p.razem_netto || 0), 0);
    const suma_transport_netto = pozycje.filter((p) => p.typ_pozycji === 'transport').reduce((a, p) => a + Number(p.razem_netto || 0), 0);
    const suma_obsluga_netto = pozycje.filter((p) => p.typ_pozycji === 'obsluga').reduce((a, p) => a + Number(p.razem_netto || 0), 0);
    const suma_nocleg_netto = pozycje.filter((p) => p.typ_pozycji === 'nocleg').reduce((a, p) => a + Number(p.razem_netto || 0), 0);
    const suma_inne_netto = suma_netto - suma_sprzet_netto - suma_transport_netto - suma_obsluga_netto - suma_nocleg_netto;
    await this.prisma.extendedClient.wersjaOferty.update({ where: { id: wersja.id }, data: { suma_netto, suma_vat, suma_brutto } });
    return this.prisma.extendedClient.oferta.update({ where: { id: id_oferty }, data: { suma_netto, suma_vat, suma_brutto, suma_sprzet_netto, suma_transport_netto, suma_obsluga_netto, suma_nocleg_netto, suma_inne_netto } });
  }

  // EVENTFLOW_PRODUCT_POLISH_V6: budżet klienta obniża proporcjonalnie tylko pozycje sprzętowe.
  // Pozycje typu obsługa, nocleg, transport i usługa pozostają bez zmian.
  // Dodatkowo można zablokować całe sekcje/grupy, np. światło albo multimedia.
  async zastosujBudzet(id_oferty: number, dto: any, id_organizacji: number) {
    const budget = this.n(dto.budzet_netto);
    if (!budget || budget <= 0) {
      return this.prisma.extendedClient.oferta.update({ where: { id: id_oferty }, data: { budzet_netto: budget, algorytm_budzetu: 'brak' } });
    }

    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const blockedSections = new Set((dto.pomin_sekcje_ids || []).map((x: any) => Number(x)));
    const positions = await this.prisma.extendedClient.pozycjaOferty.findMany({
      where: { id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
    });

    const fixed = positions.filter((p) => p.typ_pozycji !== 'sprzet' || (p.id_sekcji && blockedSections.has(p.id_sekcji)));
    const adjustable = positions.filter((p) => p.typ_pozycji === 'sprzet' && !(p.id_sekcji && blockedSections.has(p.id_sekcji)));
    const fixedSum = fixed.reduce((a, p) => a + this.lineBase(p), 0);
    const adjustableBase = adjustable.reduce((a, p) => a + this.lineBase(p), 0);
    const targetAdjustable = Math.max(0, budget - fixedSum);
    const factor = adjustableBase > 0 ? Math.min(1, targetAdjustable / adjustableBase) : 1;

    await this.prisma.extendedClient.$transaction(async (tx) => {
      for (const p of adjustable) {
        const base = this.lineBase(p);
        const newNetto = Number((base * factor).toFixed(2));
        const vatRate = Number(p.vat || 23);
        await tx.pozycjaOferty.update({
          where: { id: p.id },
          data: {
            cena_przed_budzetem_netto: base,
            rabat_budzetowy_netto: Number((base - newNetto).toFixed(2)),
            razem_netto: newNetto,
            razem_vat: Number((newNetto * vatRate / 100).toFixed(2)),
            razem_brutto: Number((newNetto * (1 + vatRate / 100)).toFixed(2)),
          },
        });
      }
      for (const p of fixed) {
        const base = this.lineBase(p);
        const vatRate = Number(p.vat || 23);
        await tx.pozycjaOferty.update({
          where: { id: p.id },
          data: {
            cena_przed_budzetem_netto: base,
            rabat_budzetowy_netto: 0,
            razem_netto: Number(base.toFixed(2)),
            razem_vat: Number((base * vatRate / 100).toFixed(2)),
            razem_brutto: Number((base * (1 + vatRate / 100)).toFixed(2)),
          },
        });
      }
    });

    await this.przelicz(id_oferty, id_organizacji);
    return this.prisma.extendedClient.oferta.update({
      where: { id: id_oferty },
      data: {
        budzet_netto: budget,
        suma_przed_budzetem_netto: Number((fixedSum + adjustableBase).toFixed(2)),
        rabat_budzetowy_netto: Number((adjustableBase - adjustableBase * factor).toFixed(2)),
        rabat_budzetowy_proc: Number(((1 - factor) * 100).toFixed(4)),
        algorytm_budzetu: 'proporcjonalnie_sprzet',
      },
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V4: pełna duplikacja oferty razem z aktualną wersją, sekcjami i pozycjami.
  async duplikujOferte(id_oferty: number, id_organizacji: number, id_uzytkownika: number, dto: any = {}) {
    const source = await this.findOne(id_oferty, id_organizacji);
    const latest = source.wersje?.[0];

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const oferta = await tx.oferta.create({
        data: {
          id_organizacji,
          // EVENTFLOW_PRODUCT_POLISH_V17:
          // Duplikat oferty nie przypina się już automatycznie "w ciemno" do starego eventu/wynajmu.
          // UI pyta użytkownika, do którego wydarzenia albo wynajmu przypisać kopię.
          id_wydarzenia: dto.id_wydarzenia !== undefined ? this.n(dto.id_wydarzenia) : source.id_wydarzenia,
          id_wynajmu: dto.id_wynajmu !== undefined ? this.n(dto.id_wynajmu) : source.id_wynajmu,
          id_kontrahenta: source.id_kontrahenta,
          id_kontaktu: source.id_kontaktu,
          id_managera: source.id_managera || id_uzytkownika,
          id_cennika: source.id_cennika,
          id_statusu_oferty: source.id_statusu_oferty,
          numer: `KOPIA-${source.numer || source.id}-${Date.now().toString().slice(-4)}`,
          nazwa: `${source.nazwa} - kopia`,
          data_sporzadzenia: new Date(),
          termin_platnosci_dni: source.termin_platnosci_dni,
          budzet_netto: source.budzet_netto,
          budzet_brutto: source.budzet_brutto,
          warunki_zamowienia: source.warunki_zamowienia,
          notatki_wewnetrzne: source.notatki_wewnetrzne,
        },
      });

      const wersja = await tx.wersjaOferty.create({
        data: {
          id_organizacji,
          id_oferty: oferta.id,
          numer_wersji: 1,
          nazwa: oferta.nazwa,
          powod_zmiany: `Duplikat oferty #${source.id}`,
          id_uzytkownika_utworzyl: id_uzytkownika,
        },
      });

      const sectionMap = new Map<number, number>();
      for (const section of latest?.sekcje || []) {
        const newSection = await tx.sekcjaOferty.create({
          data: {
            id_organizacji,
            id_wersji_oferty: wersja.id,
            nazwa: section.nazwa,
            opis: section.opis,
            kolor: section.kolor,
            kolejnosc: section.kolejnosc,
            budzet_netto: section.budzet_netto,
            widoczna_w_pdf: section.widoczna_w_pdf,
          },
        });
        sectionMap.set(section.id, newSection.id);
      }

      for (const section of latest?.sekcje || []) {
        for (const p of section.pozycje || []) {
          await tx.pozycjaOferty.create({
            data: {
              id_organizacji,
              id_wersji_oferty: wersja.id,
              id_sekcji: sectionMap.get(section.id),
              id_kategorii: p.id_kategorii,
              id_modelu: p.id_modelu,
              id_ceny_sprzetu: p.id_ceny_sprzetu,
              typ_pozycji: p.typ_pozycji,
              nazwa: p.nazwa,
              opis: p.opis,
              uwagi: p.uwagi,
              cena_netto: p.cena_netto,
              ilosc: p.ilosc,
              dni_pracy: p.dni_pracy,
              procent_pierwszego_dnia: p.procent_pierwszego_dnia,
              przelicznik: p.przelicznik,
              rabat_proc: p.rabat_proc,
              rabat_netto: p.rabat_netto,
              vat: p.vat,
              razem_netto: p.razem_netto,
              razem_vat: p.razem_vat,
              razem_brutto: p.razem_brutto,
              kolejnosc: p.kolejnosc,
              widoczna_w_pdf: p.widoczna_w_pdf,
            },
          });
        }
      }

      return oferta;
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V4: duplikacja grupy sprzętowej / sekcji w obrębie oferty.
  async duplikujSekcje(id_oferty: number, id_sekcji: number, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const section = await this.prisma.extendedClient.sekcjaOferty.findFirst({
      where: { id: id_sekcji, id_organizacji, id_wersji_oferty: wersja.id, aktywny: true },
      include: { pozycje: true },
    });
    if (!section) throw new NotFoundException('Nie znaleziono grupy sprzętowej');

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const newSection = await tx.sekcjaOferty.create({
        data: {
          id_organizacji,
          id_wersji_oferty: wersja.id,
          nazwa: `${section.nazwa} - kopia`,
          opis: section.opis,
          kolor: section.kolor,
          kolejnosc: Number(section.kolejnosc || 0) + 1,
          budzet_netto: section.budzet_netto,
          widoczna_w_pdf: section.widoczna_w_pdf,
        },
      });
      for (const p of section.pozycje || []) {
        await tx.pozycjaOferty.create({
          data: {
            id_organizacji,
            id_wersji_oferty: wersja.id,
            id_sekcji: newSection.id,
            id_kategorii: p.id_kategorii,
            id_modelu: p.id_modelu,
            id_ceny_sprzetu: p.id_ceny_sprzetu,
            typ_pozycji: p.typ_pozycji,
            nazwa: p.nazwa,
            opis: p.opis,
            uwagi: p.uwagi,
            cena_netto: p.cena_netto,
            ilosc: p.ilosc,
            dni_pracy: p.dni_pracy,
            procent_pierwszego_dnia: p.procent_pierwszego_dnia,
            przelicznik: p.przelicznik,
            rabat_proc: p.rabat_proc,
            rabat_netto: p.rabat_netto,
            vat: p.vat,
            razem_netto: p.razem_netto,
            razem_vat: p.razem_vat,
            razem_brutto: p.razem_brutto,
            kolejnosc: p.kolejnosc,
            widoczna_w_pdf: p.widoczna_w_pdf,
          },
        });
      }
      return newSection;
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V32:
  // Realna synchronizacja sprzętu między ofertą i wydarzeniem bez tworzenia ukrytych wynajmów.
  // Oferta i plan wydarzenia pracują na modelach + ilościach; WZ/PZ dalej pracują na egzemplarzach.
  async synchronizujZWydarzeniem(id_oferty: number, direction: 'event-to-offer' | 'offer-to-event', id_organizacji: number) {
    const oferta = await this.findOne(id_oferty, id_organizacji);
    const id_wydarzenia = Number(oferta.id_wydarzenia || 0);
    if (!id_wydarzenia) {
      throw new BadRequestException('Oferta nie jest przypisana do wydarzenia. Najpierw przypisz ofertę do wydarzenia.');
    }

    const aktualnaWersja = oferta.wersje?.[0];
    if (!aktualnaWersja) throw new NotFoundException('Oferta nie ma aktualnej wersji.');

    if (direction === 'offer-to-event') {
      const sprzet = (aktualnaWersja.sekcje || [])
        .flatMap((s: any) => s.pozycje || [])
        .filter((p: any) => p.aktywny !== false && p.typ_pozycji === 'sprzet' && p.id_modelu && Number(p.ilosc || 0) > 0);

      const byModel = new Map<number, { ilosc: number; uwagi: string }>();
      for (const p of sprzet) {
        const id_modelu = Number(p.id_modelu);
        const existing = byModel.get(id_modelu) || { ilosc: 0, uwagi: '' };
        existing.ilosc += Number(p.ilosc || 0);
        existing.uwagi = [existing.uwagi, p.nazwa ? `Oferta #${id_oferty}: ${p.nazwa}` : `Oferta #${id_oferty}`].filter(Boolean).join('\n');
        byModel.set(id_modelu, existing);
      }

      return this.prisma.extendedClient.$transaction(async (tx) => {
        const wydarzenie = await tx.wydarzenie.findFirst({
          where: { id: id_wydarzenia, id_organizacji, aktywny: true },
        });
        if (!wydarzenie) throw new NotFoundException('Nie znaleziono wydarzenia przypisanego do oferty.');

        // Wyślij ofertę do wydarzenia = plan wydarzenia ma odpowiadać aktualnej ofercie.
        await tx.pozycjaSprzetuWydarzenia.updateMany({
          where: { id_organizacji, id_wydarzenia, aktywny: true },
          data: { aktywny: false, data_usuniecia: new Date() },
        });

        let index = 1;
        for (const [id_modelu, data] of byModel.entries()) {
          const existing = await tx.pozycjaSprzetuWydarzenia.findFirst({
            where: { id_organizacji, id_wydarzenia, id_modelu },
          });
          if (existing) {
            await tx.pozycjaSprzetuWydarzenia.update({
              where: { id: existing.id },
              data: {
                ilosc_planowana: data.ilosc,
                uwagi: data.uwagi || null,
                kolejnosc: index,
                aktywny: true,
                data_usuniecia: null,
              },
            });
          } else {
            await tx.pozycjaSprzetuWydarzenia.create({
              data: {
                id_organizacji,
                id_wydarzenia,
                id_modelu,
                ilosc_planowana: data.ilosc,
                uwagi: data.uwagi || null,
                kolejnosc: index,
              },
            });
          }
          index++;
        }

        await tx.logZmian.create({
          data: {
            id_organizacji,
            typ_obiektu: 'Oferta',
            id_obiektu: id_oferty,
            akcja: 'PRZENIESIENIE_SPRZETU_Z_OFERTY_DO_PLANU_WYDARZENIA',
            nowa_wartosc: JSON.stringify({ id_wydarzenia, count: byModel.size }),
          },
        });

        return { success: true, direction, count: byModel.size, id_wydarzenia };
      });
    }

    if (direction === 'event-to-offer') {
      return this.prisma.extendedClient.$transaction(async (tx) => {
        const planPozycje = await tx.pozycjaSprzetuWydarzenia.findMany({
          where: { id_organizacji, id_wydarzenia, aktywny: true },
          include: { model: { include: { kategoria: true } } },
          orderBy: [{ kolejnosc: 'asc' }, { data_utworzenia: 'asc' }],
        });

        let sekcja = await tx.sekcjaOferty.findFirst({
          where: { id_organizacji, id_wersji_oferty: aktualnaWersja.id, aktywny: true, nazwa: 'Sprzęt z wydarzenia' },
        });

        if (!sekcja) {
          sekcja = await tx.sekcjaOferty.create({
            data: {
              id_organizacji,
              id_wersji_oferty: aktualnaWersja.id,
              nazwa: 'Sprzęt z wydarzenia',
              opis: 'Pozycje zaciągnięte z planu sprzętu wydarzenia',
              kolor: '#0891b2',
              kolejnosc: 999,
            },
          });
        }

        await tx.pozycjaOferty.updateMany({
          where: { id_organizacji, id_wersji_oferty: aktualnaWersja.id, id_sekcji: sekcja.id, aktywny: true },
          data: { aktywny: false, data_usuniecia: new Date() },
        });

        for (const p of planPozycje) {
          const cena = Number((p.model as any)?.wartosc_domyslna_egzemplarza || (p.model as any)?.wartosc || 0);
          const ilosc = Number(p.ilosc_planowana || 1);
          const razemNetto = cena * ilosc;
          await tx.pozycjaOferty.create({
            data: {
              id_organizacji,
              id_wersji_oferty: aktualnaWersja.id,
              id_sekcji: sekcja.id,
              id_kategorii: (p.model as any)?.id_kategorii || null,
              id_modelu: Number(p.id_modelu),
              typ_pozycji: 'sprzet',
              nazwa: (p.model as any)?.nazwa || `Model #${p.id_modelu}`,
              opis: 'Zaciągnięto z planu sprzętu wydarzenia',
              cena_netto: cena,
              ilosc,
              dni_pracy: 1,
              rabat_proc: 0,
              rabat_netto: 0,
              cena_przed_budzetem_netto: razemNetto,
              vat: 23,
              razem_netto: razemNetto,
              razem_vat: razemNetto * 0.23,
              razem_brutto: razemNetto * 1.23,
              widoczna_w_pdf: true,
            },
          });
        }

        await tx.logZmian.create({
          data: {
            id_organizacji,
            typ_obiektu: 'Oferta',
            id_obiektu: id_oferty,
            akcja: 'ZACIAGNIECIE_PLANU_SPRZETU_WYDARZENIA_DO_OFERTY',
            nowa_wartosc: JSON.stringify({ id_wydarzenia, count: planPozycje.length }),
          },
        });

        return { success: true, direction, count: planPozycje.length, id_wydarzenia };
      }).then(async (result) => {
        await this.przelicz(id_oferty, id_organizacji);
        return result;
      });
    }

    throw new BadRequestException('Nieznany kierunek synchronizacji.');
  }

  async dodajPakietDoOferty(id_oferty: number, id_sekcji: number, dto: any, id_organizacji: number) {
    const wersja = await this.aktualnaWersja(id_oferty, id_organizacji);
    const pakiet = await this.prisma.extendedClient.pakiet.findFirst({
      where: { id: Number(dto.id_pakietu), id_organizacji, aktywny: true },
      include: { pozycje: { include: { model: { include: { stawki: true } }, egzemplarz: { include: { model: { include: { stawki: true } } } } } } },
    });

    if (!pakiet) throw new NotFoundException('Pakiet nie istnieje');

    const mnoznik = Number(dto.ilosc_pakietow || 1);
    const dni = Number(dto.dni_pracy || 1);

    await this.prisma.extendedClient.$transaction(async (tx) => {
      for (const poz of pakiet.pozycje) {
        const sprzet = poz.egzemplarz ? poz.egzemplarz.model : poz.model;
        if (!sprzet) continue;

        // Pobieramy cenę podstawową modelu
        const cenaNetto = Number(sprzet.stawki?.find(s => s.nazwa_stawki === 'Podstawowa (PLN)')?.cena_netto || sprzet.wartosc_domyslna_egzemplarza || 0);
        const ilosc = Number(poz.ilosc) * mnoznik;
        const razemNetto = cenaNetto * ilosc * dni;

        await tx.pozycjaOferty.create({
          data: {
            id_organizacji,
            id_wersji_oferty: wersja.id,
            id_sekcji: Number(id_sekcji),
            id_kategorii: sprzet.id_kategorii,
            id_modelu: poz.id_modelu || poz.egzemplarz?.id_modelu,
            typ_pozycji: 'sprzet',
            nazwa: poz.egzemplarz ? `${sprzet.nazwa} (${poz.egzemplarz.nazwa})` : sprzet.nazwa,
            opis: `Z pakietu: ${pakiet.nazwa}`,
            cena_netto: cenaNetto,
            ilosc: ilosc,
            dni_pracy: dni,
            rabat_proc: 0,
            rabat_netto: 0,
            cena_przed_budzetem_netto: razemNetto,
            vat: 23,
            razem_netto: razemNetto,
            razem_vat: razemNetto * 0.23,
            razem_brutto: razemNetto * 1.23,
            widoczna_w_pdf: true,
          }
        });
      }
    });

    await this.przelicz(id_oferty, id_organizacji);
    return { success: true, count: pakiet.pozycje.length };
  }
}
