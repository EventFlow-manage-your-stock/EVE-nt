import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class WynajmyService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  private n(v: any): number | null {
    return v === '' || v === undefined || v === null ? null : Number(v);
  }

  private d(v: any): Date | null {
    return v === '' || v === undefined || v === null ? null : new Date(v);
  }

  private s(v: any): string | null {
    return v === '' || v === undefined || v === null ? null : String(v).trim();
  }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.wynajem.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        kontrahent: true,
        status: true,
        status_magazynowy: true,
        status_ksiegowy: true,
        oferta: true,
        oferty: {
          where: { aktywny: true },
          include: { status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } },
          orderBy: { data_utworzenia: 'desc' },
        },
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
        oferty: {
          where: { aktywny: true },
          include: { status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } },
          orderBy: { data_utworzenia: 'desc' },
        },
        managerowie: { where: { aktywny: true }, include: { uzytkownik: true } },
        etapy: {
          orderBy: { data_start: 'asc' },
          include: {
            przypisani_uzytkownicy: { where: { aktywny: true }, include: { uzytkownik: true } },
            przypisane_pojazdy: { where: { aktywny: true }, include: { pojazd: true } },
          },
        },
        noclegi: { where: { aktywny: true } },
        powiadomienia: true,
        ekipa: { include: { uzytkownik: true } },
        pojazdy: { include: { pojazd: true } },
        zadania: {
          where: { aktywny: true },
          include: { przypisani_uzytkownicy: { include: { uzytkownik: true } } },
          orderBy: { data_utworzenia: 'desc' },
        },
      },
    });

    if (!item) throw new NotFoundException('Nie znaleziono wynajmu');

    const historia = await this.prisma.extendedClient.logZmian.findMany({
      where: { id_organizacji, typ_obiektu: 'Wynajem', id_obiektu: id },
      orderBy: { data_utworzenia: 'desc' },
      include: { uzytkownik: { select: { imie: true, nazwisko: true, avatar: true } } },
    });

    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'Wynajem', id_obiektu: id, aktywny: true },
      orderBy: { data_utworzenia: 'desc' },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
    });

    return { ...item, historia, zalaczniki };
  }

  async create(dto: any, id_organizacji: number, id_uzytkownika: number) {
    const numer = this.s(dto.numer) || `W/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`;
    const adres = this.s(dto.adres_reczny);
    const linkMaps = adres
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`
      : this.s(dto.link_google_maps);

    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      const wynajem = await tx.wynajem.create({
        data: {
          id_organizacji,
          numer,
          nazwa: this.s(dto.nazwa),
          opis: this.s(dto.opis),
          uwagi_packlista: this.s(dto.uwagi_packlista),
          id_oferty: this.n(dto.id_oferty),
          id_kontrahenta: this.n(dto.id_kontrahenta),
          id_kontaktu: this.n(dto.id_kontaktu),
          id_managera: this.n(dto.id_managera),
          id_tworcy: id_uzytkownika,
          id_miejsca: this.n(dto.id_miejsca),
          id_statusu_wynajmu: this.n(dto.id_statusu_wynajmu),
          id_statusu_magazynowego: this.n(dto.id_statusu_magazynowego),
          id_statusu_ksiegowego: this.n(dto.id_statusu_ksiegowego),
          budzet_netto: this.n(dto.budzet_netto),
          budzet_brutto: this.n(dto.budzet_brutto),
          miejsce_reczne: this.s(dto.miejsce_reczne),
          adres_reczny: adres,
          link_google_maps: linkMaps,
          data_wydania: this.d(dto.data_wydania),
          data_zwrotu_planowana: this.d(dto.data_zwrotu_planowana),
          data_zwrotu_rzeczywista: this.d(dto.data_zwrotu_rzeczywista),
          notatki_wewnetrzne: this.s(dto.notatki_wewnetrzne),
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wynajem',
          id_obiektu: wynajem.id,
          akcja: 'UTWORZENIE',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      return wynajem;
    });
  }

  async update(id: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    await this.findOne(id, id_organizacji);
    const adres = this.s(dto.adres_reczny);
    const linkMaps = adres
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`
      : this.s(dto.link_google_maps);

    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      const updated = await tx.wynajem.update({
        where: { id },
        data: {
          numer: dto.numer !== undefined ? this.s(dto.numer) : undefined,
          nazwa: dto.nazwa !== undefined ? this.s(dto.nazwa) : undefined,
          opis: dto.opis !== undefined ? this.s(dto.opis) : undefined,
          uwagi_packlista: dto.uwagi_packlista !== undefined ? this.s(dto.uwagi_packlista) : undefined,
          id_oferty: dto.id_oferty !== undefined ? this.n(dto.id_oferty) : undefined,
          id_kontrahenta: dto.id_kontrahenta !== undefined ? this.n(dto.id_kontrahenta) : undefined,
          id_kontaktu: dto.id_kontaktu !== undefined ? this.n(dto.id_kontaktu) : undefined,
          id_managera: dto.id_managera !== undefined ? this.n(dto.id_managera) : undefined,
          id_miejsca: dto.id_miejsca !== undefined ? this.n(dto.id_miejsca) : undefined,
          id_statusu_wynajmu: dto.id_statusu_wynajmu !== undefined ? this.n(dto.id_statusu_wynajmu) : undefined,
          id_statusu_magazynowego: dto.id_statusu_magazynowego !== undefined ? this.n(dto.id_statusu_magazynowego) : undefined,
          id_statusu_ksiegowego: dto.id_statusu_ksiegowego !== undefined ? this.n(dto.id_statusu_ksiegowego) : undefined,
          budzet_netto: dto.budzet_netto !== undefined ? this.n(dto.budzet_netto) : undefined,
          budzet_brutto: dto.budzet_brutto !== undefined ? this.n(dto.budzet_brutto) : undefined,
          miejsce_reczne: dto.miejsce_reczne !== undefined ? this.s(dto.miejsce_reczne) : undefined,
          adres_reczny: dto.adres_reczny !== undefined ? adres : undefined,
          link_google_maps: linkMaps !== undefined ? linkMaps : undefined,
          data_wydania: dto.data_wydania !== undefined ? this.d(dto.data_wydania) : undefined,
          data_zwrotu_planowana: dto.data_zwrotu_planowana !== undefined ? this.d(dto.data_zwrotu_planowana) : undefined,
          data_zwrotu_rzeczywista: dto.data_zwrotu_rzeczywista !== undefined ? this.d(dto.data_zwrotu_rzeczywista) : undefined,
          notatki_wewnetrzne: dto.notatki_wewnetrzne !== undefined ? this.s(dto.notatki_wewnetrzne) : undefined,
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wynajem',
          id_obiektu: id,
          akcja: 'EDYCJA',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      return updated;
    });
  }

  async remove(id: number, id_organizacji: number, id_uzytkownika: number) {
    await this.findOne(id, id_organizacji);
    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wynajem',
          id_obiektu: id,
          akcja: 'USUNIECIE',
        },
      });
      return tx.wynajem.update({
        where: { id },
        data: { aktywny: false, data_usuniecia: new Date() },
      });
    });
  }

  // --- MANAGEROWIE PROJEKTU ---

  async addManager(id_wynajmu: number, dto: any, id_organizacji: number) {
    if (!dto.id_uzytkownika) throw new BadRequestException('Brak ID użytkownika');
    return this.prisma.extendedClient.wynajemManager.create({
      data: { id_organizacji, id_wynajmu, id_uzytkownika: Number(dto.id_uzytkownika) },
    });
  }

  async removeManager(id_wynajmu: number, managerId: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemManager.delete({
      where: { id: managerId, id_organizacji, id_wynajmu },
    });
  }

  // --- HARMONOGRAM / ETAPY ---

  async addEtap(id_wynajmu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.etapWynajmu.create({
      data: {
        id_organizacji,
        id_wynajmu,
        nazwa: dto.nazwa,
        opis: dto.opis || null,
        data_start: new Date(dto.data_start),
        data_koniec: new Date(dto.data_koniec),
      },
    });
  }

  async updateEtap(id_etapu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.etapWynajmu.update({
      where: { id: id_etapu, id_organizacji },
      data: {
        nazwa: dto.nazwa,
        opis: dto.opis || null,
        data_start: new Date(dto.data_start),
        data_koniec: new Date(dto.data_koniec),
      },
    });
  }

  async removeEtap(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.etapWynajmu.delete({ where: { id, id_organizacji } });
  }

  async addEtapEkipa(id_etapu: number, dto: any, id_organizacji: number) {
    const id_uzytkownika = Number(dto.id_uzytkownika);
    const exists = await this.prisma.extendedClient.etapWynajmuUzytkownik.findFirst({
      where: { id_organizacji, id_etapu, id_uzytkownika },
    });
    if (exists) return exists;
    return this.prisma.extendedClient.etapWynajmuUzytkownik.create({
      data: { id_organizacji, id_etapu, id_uzytkownika },
    });
  }

  async removeEtapEkipa(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.etapWynajmuUzytkownik.delete({ where: { id, id_organizacji } });
  }

  async addEtapPojazd(id_etapu: number, dto: any, id_organizacji: number) {
    const id_pojazdu = dto.id_pojazdu ? Number(dto.id_pojazdu) : null;
    const pojazd_zewnetrzny = dto.pojazd_zewnetrzny ? String(dto.pojazd_zewnetrzny).trim() : null;

    if (id_pojazdu) {
      const exists = await this.prisma.extendedClient.etapWynajmuPojazd.findFirst({
        where: { id_organizacji, id_etapu, id_pojazdu },
      });
      if (exists) return exists;
    } else if (pojazd_zewnetrzny) {
      const exists = await this.prisma.extendedClient.etapWynajmuPojazd.findFirst({
        where: { id_organizacji, id_etapu, pojazd_zewnetrzny },
      });
      if (exists) return exists;
    }

    return this.prisma.extendedClient.etapWynajmuPojazd.create({
      data: { id_organizacji, id_etapu, id_pojazdu, pojazd_zewnetrzny },
    });
  }

  async removeEtapPojazd(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.etapWynajmuPojazd.delete({ where: { id, id_organizacji } });
  }

  async assignUserToStages(id_wynajmu: number, id_uzytkownika: number, stageIds: number[], id_organizacji: number) {
    const stages = await this.prisma.extendedClient.etapWynajmu.findMany({
      where: { id_wynajmu, id_organizacji },
      select: { id: true },
    });
    const validStageIds = stages.map((s: any) => s.id);

    await this.prisma.extendedClient.etapWynajmuUzytkownik.deleteMany({
      where: { id_organizacji, id_uzytkownika, id_etapu: { in: validStageIds } },
    });

    if (stageIds && stageIds.length > 0) {
      await this.prisma.extendedClient.etapWynajmuUzytkownik.createMany({
        data: stageIds
          .filter((sid) => validStageIds.includes(sid))
          .map((id_etapu) => ({ id_organizacji, id_uzytkownika, id_etapu })),
      });
    }
    return { success: true };
  }

  async assignVehicleToStages(
    id_wynajmu: number,
    vehicleKey: string | number,
    stageIds: number[],
    id_organizacji: number,
  ) {
    const stages = await this.prisma.extendedClient.etapWynajmu.findMany({
      where: { id_wynajmu, id_organizacji },
      select: { id: true },
    });
    const validStageIds = stages.map((s: any) => s.id);

    const isId =
      typeof vehicleKey === 'number' ||
      (!isNaN(Number(vehicleKey)) && !String(vehicleKey).includes(' ') && String(Number(vehicleKey)) === String(vehicleKey));
    const id_pojazdu = isId && Number(vehicleKey) > 0 ? Number(vehicleKey) : null;
    const pojazd_zewnetrzny = !id_pojazdu ? String(vehicleKey).trim() : null;

    const deleteWhere: any = { id_organizacji, id_etapu: { in: validStageIds } };
    if (id_pojazdu) deleteWhere.id_pojazdu = id_pojazdu;
    else if (pojazd_zewnetrzny) deleteWhere.pojazd_zewnetrzny = pojazd_zewnetrzny;

    await this.prisma.extendedClient.etapWynajmuPojazd.deleteMany({ where: deleteWhere });

    if (stageIds && stageIds.length > 0) {
      await this.prisma.extendedClient.etapWynajmuPojazd.createMany({
        data: stageIds
          .filter((sid) => validStageIds.includes(sid))
          .map((id_etapu) => ({
            id_organizacji,
            id_pojazdu,
            pojazd_zewnetrzny,
            id_etapu,
          })),
      });
    }
    return { success: true };
  }

  // --- EKIPA (PERSONEL WYNAJMU) ---

  async addEkipa(id_wynajmu: number, dto: any, id_organizacji: number) {
    let id_uzytkownika: number | null = dto.id_uzytkownika ? Number(dto.id_uzytkownika) : null;

    if (dto.isExternal) {
      const email = dto.email ? String(dto.email).trim() : null;
      let existingUser: any = null;
      if (email) {
        existingUser = await this.prisma.extendedClient.uzytkownik.findFirst({
          where: { id_organizacji, email },
        });
      }

      if (existingUser) {
        id_uzytkownika = Number(existingUser.id);
        await this.prisma.extendedClient.uzytkownik.update({
          where: { id: existingUser.id },
          data: {
            imie: dto.imie || existingUser.imie,
            nazwisko: dto.nazwisko || existingUser.nazwisko,
            telefon: dto.telefon || existingUser.telefon,
            stanowisko: 'Współpracownik Zewnętrzny',
          },
        });
      } else {
        const uniqueEmail = email || `external_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@temp.eventflow.pl`;
        const newUser = await this.prisma.extendedClient.uzytkownik.create({
          data: {
            id_organizacji,
            imie: dto.imie || 'Freelancer',
            nazwisko: dto.nazwisko || '',
            email: uniqueEmail,
            telefon: dto.telefon || null,
            stanowisko: 'Współpracownik Zewnętrzny',
            haslo: 'none',
            aktywny: true,
          },
        });
        id_uzytkownika = Number(newUser.id);
      }
    }

    if (!id_uzytkownika) throw new BadRequestException('Nie wybrano użytkownika.');

    const existingAssignment = await this.prisma.extendedClient.wynajemUzytkownik.findFirst({
      where: { id_organizacji, id_wynajmu, id_uzytkownika },
    });

    if (existingAssignment) {
      return this.prisma.extendedClient.wynajemUzytkownik.update({
        where: { id: existingAssignment.id },
        data: {
          rola_w_wynajmie: dto.rola || existingAssignment.rola_w_wynajmie,
          aktywny: true,
          data_usuniecia: null,
        },
      });
    }

    return this.prisma.extendedClient.wynajemUzytkownik.create({
      data: {
        id_organizacji,
        id_wynajmu,
        id_uzytkownika,
        rola_w_wynajmie: dto.rola || 'Obsługa logistyczna',
      },
    });
  }

  async updateEkipa(ekipaId: number, dto: any, id_organizacji: number) {
    const existing = await this.prisma.extendedClient.wynajemUzytkownik.findFirst({
      where: { id: ekipaId, id_organizacji },
      include: { uzytkownik: true },
    });
    if (!existing) throw new NotFoundException('Nie znaleziono przypisania ekipy');

    if (dto.imie || dto.nazwisko || dto.telefon !== undefined || dto.email !== undefined) {
      await this.prisma.extendedClient.uzytkownik.update({
        where: { id: existing.id_uzytkownika },
        data: {
          imie: dto.imie || existing.uzytkownik.imie,
          nazwisko: dto.nazwisko || existing.uzytkownik.nazwisko,
          telefon: dto.telefon !== undefined ? dto.telefon : existing.uzytkownik.telefon,
          email: dto.email !== undefined ? dto.email : existing.uzytkownik.email,
        },
      });
    }

    return this.prisma.extendedClient.wynajemUzytkownik.update({
      where: { id: ekipaId },
      data: {
        rola_w_wynajmie: dto.rola || dto.rola_w_wynajmie || existing.rola_w_wynajmie,
      },
      include: { uzytkownik: true },
    });
  }

  async removeEkipa(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemUzytkownik.delete({ where: { id, id_organizacji } });
  }

  async wyslijPowiadomienieEkipa(id_wynajmu: number, user_ids: number[], id_organizacji: number) {
    const wynajem = await this.findOne(id_wynajmu, id_organizacji);
    const ekipa = await this.prisma.extendedClient.uzytkownik.findMany({
      where: { id: { in: user_ids.map(Number) }, id_organizacji, aktywny: true },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let wyslano = 0;

    for (const user of ekipa) {
      if (!user.email || user.email.includes('@temp.eventflow.pl')) continue;
      const rentalLink = `${baseUrl}/dashboard/rentals/${id_wynajmu}`;
      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || '"EventFlow WMS" <no-reply@eventflow.pl>',
          to: user.email,
          subject: `[EventFlow] Przypisano Cię do wypożyczenia: ${wynajem.nazwa || wynajem.numer}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #06B6D4;">Witaj ${user.imie},</h2>
              <p>Zostałeś przypisany do obsługi wypożyczenia: <b>${wynajem.nazwa || wynajem.numer}</b>.</p>
              <p><b>Ramy czasowe wypożyczenia:</b><br/>
                ${wynajem.data_wydania ? wynajem.data_wydania.toLocaleString('pl-PL') : 'Brak danych'} - 
                ${wynajem.data_zwrotu_planowana ? wynajem.data_zwrotu_planowana.toLocaleString('pl-PL') : 'Brak danych'}
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${rentalLink}" style="display: inline-block; padding: 14px 28px; background-color: #06B6D4; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Zobacz szczegóły w EventFlow</a>
              </div>
            </div>
          `,
        });

        await this.prisma.extendedClient.powiadomienieWynajemEkipa.create({
          data: { id_organizacji, id_wynajmu, id_uzytkownika: user.id },
        });
        wyslano++;
      } catch (err) {
        console.error(`Błąd wysyłki SMTP do ${user.email}:`, err);
      }
    }

    await this.prisma.extendedClient.logZmian.create({
      data: {
        id_organizacji,
        id_uzytkownika: null,
        typ_obiektu: 'Wynajem',
        id_obiektu: id_wynajmu,
        akcja: 'WYSLANIE_POWIADOMIEN_EKIPA',
        nowa_wartosc: JSON.stringify({ wyslano_do: wyslano }),
      },
    });

    return { success: true, count: wyslano };
  }

  // --- FLOTA (TRANSPORT WYNAJMU) ---

  async addFlota(id_wynajmu: number, dto: any, id_organizacji: number) {
    const id_pojazdu = dto.id_pojazdu ? Number(dto.id_pojazdu) : null;
    const pojazd_zewnetrzny = dto.pojazd_zewnetrzny ? String(dto.pojazd_zewnetrzny).trim() : null;

    if (id_pojazdu) {
      const existing = await this.prisma.extendedClient.wynajemPojazd.findFirst({
        where: { id_organizacji, id_wynajmu, id_pojazdu, aktywny: true },
      });
      if (existing) {
        return this.prisma.extendedClient.wynajemPojazd.update({
          where: { id: existing.id },
          data: { rola_pojazdu: dto.rola || dto.rola_pojazdu || existing.rola_pojazdu },
        });
      }
    }

    return this.prisma.extendedClient.wynajemPojazd.create({
      data: {
        id_organizacji,
        id_wynajmu,
        id_pojazdu,
        pojazd_zewnetrzny,
        rola_pojazdu: dto.rola || dto.rola_pojazdu || 'Transport sprzętu',
      },
    });
  }

  async removeFlota(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemPojazd.delete({ where: { id, id_organizacji } });
  }

  // --- NOCLEGI ---

  async addNocleg(id_wynajmu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemNocleg.create({
      data: {
        id_organizacji,
        id_wynajmu,
        nazwa_obiektu: dto.nazwa_obiektu,
        adres: dto.adres || null,
        data_zameldowania: dto.data_zameldowania ? new Date(dto.data_zameldowania) : null,
        data_wymeldowania: dto.data_wymeldowania ? new Date(dto.data_wymeldowania) : null,
        liczba_osob: dto.liczba_osob ? Number(dto.liczba_osob) : null,
        opis: dto.opis || null,
      },
    });
  }

  async updateNocleg(id_noclegu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemNocleg.update({
      where: { id: id_noclegu, id_organizacji },
      data: {
        nazwa_obiektu: dto.nazwa_obiektu,
        adres: dto.adres || null,
        data_zameldowania: dto.data_zameldowania ? new Date(dto.data_zameldowania) : null,
        data_wymeldowania: dto.data_wymeldowania ? new Date(dto.data_wymeldowania) : null,
        liczba_osob: dto.liczba_osob ? Number(dto.liczba_osob) : null,
        opis: dto.opis || null,
      },
    });
  }

  async removeNocleg(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.wynajemNocleg.delete({ where: { id, id_organizacji } });
  }

  // --- CHAT I ZAŁĄCZNIKI ---

  async addChat(id_wynajmu: number, message: string, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.logZmian.create({
      data: {
        id_organizacji,
        id_uzytkownika,
        typ_obiektu: 'Wynajem',
        id_obiektu: id_wynajmu,
        akcja: 'CHAT',
        nowa_wartosc: message,
      },
    });
  }

  async addZalacznik(id_wynajmu: number, dto: any, file: Express.Multer.File, id_organizacji: number, id_uzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, id_organizacji, 'wynajmy_zalaczniki');
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji,
        typ_obiektu: 'Wynajem',
        id_obiektu: id_wynajmu,
        nazwa: dto.nazwa || file.originalname,
        nazwa_pliku: file.originalname,
        rozmiar_bajtow: file.size,
        mime: file.mimetype,
        sciezka: objectKey,
        id_uzytkownika_dodal: id_uzytkownika,
      },
    });
  }

  async removeZalacznik(id: number, id_organizacji: number) {
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id, id_organizacji },
    });

    if (zalacznik && zalacznik.sciezka && !zalacznik.sciezka.startsWith('data:')) {
      await this.storage.deleteFile(zalacznik.sciezka);
    }

    return this.prisma.extendedClient.zalacznik.update({
      where: { id, id_organizacji },
      data: { aktywny: false },
    });
  }
}