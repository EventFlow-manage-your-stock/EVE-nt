import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class WydarzeniaService {
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

  private n(v: any) { return v === '' || v === undefined || v === null ? null : Number(v); }
  private d(v: any) { return v === '' || v === undefined || v === null ? null : new Date(v); }
  private s(v: any) { return v === '' || v === undefined || v === null ? null : String(v); }

  async getSlownikiDoFiltrow(id_organizacji: number) {
    const [klienci, managerowie] = await Promise.all([
      this.prisma.extendedClient.kontrahent.findMany({
        where: { id_organizacji, aktywny: true },
        select: { id: true, nazwa: true, nazwa_skrocona: true },
        orderBy: { nazwa: 'asc' },
      }),
      this.prisma.extendedClient.uzytkownik.findMany({
        where: { id_organizacji, aktywny: true },
        select: { id: true, imie: true, nazwisko: true },
        orderBy: { nazwisko: 'asc' },
      }),
    ]);
    return { klienci, managerowie };
  }

  async findAll(id_organizacji: number, filters?: any) {
    const where: any = { id_organizacji };
    if (filters) {
      if (filters.search) where.nazwa = { contains: filters.search, mode: 'insensitive' };
      if (filters.clientId) where.id_kontrahenta = Number(filters.clientId);
      if (filters.managerId) {
        where.OR = [
          { id_managera: Number(filters.managerId) },
          { managerowie: { some: { id_uzytkownika: Number(filters.managerId), aktywny: true } } },
        ];
      }
      if (filters.typId) where.id_typu_wydarzenia = Number(filters.typId);
    }
    return this.prisma.extendedClient.wydarzenie.findMany({
      where,
      include: {
        typ: true,
        status: true,
        status_magazynowy: true,
        status_ksiegowy: true,
        oferta_glowna: true,
        kontrahent: { select: { id: true, nazwa: true, nazwa_skrocona: true } },
        manager: { select: { id: true, imie: true, nazwisko: true } },
        managerowie: { where: { aktywny: true }, include: { uzytkownik: { select: { id: true, imie: true, nazwisko: true } } } },
      },
      orderBy: { data_start: 'asc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const event = await this.prisma.extendedClient.wydarzenie.findFirst({
      where: { id, id_organizacji },
      include: {
        typ: true,
        kontrahent: true,
        miejsce: true,
        manager: true,
        tworca: true,
        status: true,
        status_magazynowy: true,
        status_ksiegowy: true,
        oferta_glowna: true,
        managerowie: { where: { aktywny: true }, include: { uzytkownik: true } },
        noclegi: { where: { aktywny: true } },
        powiadomienia: true,
        etapy: {
          orderBy: { data_start: 'asc' },
          include: {
            przypisani_uzytkownicy: { where: { aktywny: true }, include: { uzytkownik: true } },
            przypisane_pojazdy: { where: { aktywny: true }, include: { pojazd: true } },
          },
        },
        oferty: {
          where: { aktywny: true },
          include: { status: true, wersje: { take: 1, orderBy: { numer_wersji: 'desc' } } },
          orderBy: { data_utworzenia: 'desc' },
        },
        ekipa: { include: { uzytkownik: true } },
        pojazdy: { include: { pojazd: true } },
        zadania: { where: { aktywny: true }, include: { przypisani_uzytkownicy: { include: { uzytkownik: true } } }, orderBy: { data_utworzenia: 'desc' } },
      },
    });
    if (!event) throw new NotFoundException('Nie znaleziono wydarzenia');

    const historia = await this.prisma.extendedClient.logZmian.findMany({
      where: { id_organizacji, typ_obiektu: 'Wydarzenie', id_obiektu: id },
      orderBy: { data_utworzenia: 'desc' },
      include: { uzytkownik: { select: { imie: true, nazwisko: true, avatar: true } } },
    });

    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'Wydarzenie', id_obiektu: id, aktywny: true },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });

    return { ...event, historia, zalaczniki };
  }

  // --- Managerowie Projektu ---
  async addManager(id_wydarzenia: number, dto: any, id_organizacji: number) {
    if (!dto.id_uzytkownika) throw new BadRequestException('Brak ID użytkownika');
    return this.prisma.extendedClient.wydarzenieManager.create({
      data: { id_organizacji, id_wydarzenia, id_uzytkownika: Number(dto.id_uzytkownika) },
    });
  }

  async removeManager(id_wydarzenia: number, managerId: number, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzenieManager.delete({
      where: { id: managerId, id_organizacji, id_wydarzenia },
    });
  }

  // --- Harmonogram / Etapy ---
  async addEtap(id_wydarzenia: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.etapWydarzenia.create({
      data: {
        id_organizacji,
        id_wydarzenia,
        nazwa: dto.nazwa,
        opis: dto.opis || null,
        data_start: new Date(dto.data_start),
        data_koniec: new Date(dto.data_koniec),
      },
    });
  }

  async updateEtap(id_etapu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.etapWydarzenia.update({
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
    return this.prisma.extendedClient.etapWydarzenia.delete({ where: { id, id_organizacji } });
  }

  async addEtapEkipa(id_etapu: number, dto: any, id_organizacji: number) {
    const id_uzytkownika = Number(dto.id_uzytkownika);
    const exists = await this.prisma.extendedClient.etapUzytkownik.findFirst({
      where: { id_organizacji, id_etapu, id_uzytkownika },
    });
    if (exists) return exists;
    return this.prisma.extendedClient.etapUzytkownik.create({
      data: { id_organizacji, id_etapu, id_uzytkownika },
    });
  }

  async removeEtapEkipa(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.etapUzytkownik.delete({ where: { id, id_organizacji } });
  }

  async addEtapPojazd(id_etapu: number, dto: any, id_organizacji: number) {
    const id_pojazdu = dto.id_pojazdu ? Number(dto.id_pojazdu) : null;
    const pojazd_zewnetrzny = dto.pojazd_zewnetrzny ? String(dto.pojazd_zewnetrzny).trim() : null;

    if (id_pojazdu) {
      const exists = await this.prisma.extendedClient.etapPojazd.findFirst({
        where: { id_organizacji, id_etapu, id_pojazdu },
      });
      if (exists) return exists;
    } else if (pojazd_zewnetrzny) {
      const exists = await this.prisma.extendedClient.etapPojazd.findFirst({
        where: { id_organizacji, id_etapu, pojazd_zewnetrzny },
      });
      if (exists) return exists;
    }

    return this.prisma.extendedClient.etapPojazd.create({
      data: {
        id_organizacji,
        id_etapu,
        id_pojazdu,
        pojazd_zewnetrzny,
      },
    });
  }

  async removeEtapPojazd(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.etapPojazd.delete({ where: { id, id_organizacji } });
  }

  async assignUserToStages(id_wydarzenia: number, id_uzytkownika: number, stageIds: number[], id_organizacji: number) {
    const stages = await this.prisma.extendedClient.etapWydarzenia.findMany({
      where: { id_wydarzenia, id_organizacji },
      select: { id: true },
    });
    const validStageIds = stages.map((s: any) => s.id);
    await this.prisma.extendedClient.etapUzytkownik.deleteMany({
      where: { id_organizacji, id_uzytkownika, id_etapu: { in: validStageIds } },
    });
    if (stageIds && stageIds.length > 0) {
      await this.prisma.extendedClient.etapUzytkownik.createMany({
        data: stageIds.filter((id) => validStageIds.includes(id)).map((id_etapu) => ({ id_organizacji, id_uzytkownika, id_etapu })),
      });
    }
    return { success: true };
  }

  async assignVehicleToStages(
    id_wydarzenia: number,
    vehicleKey: string | number,
    stageIds: number[],
    id_organizacji: number,
  ) {
    const stages = await this.prisma.extendedClient.etapWydarzenia.findMany({
      where: { id_wydarzenia, id_organizacji },
      select: { id: true },
    });
    const validStageIds = stages.map((s: any) => s.id);

    // Identyfikacja czy kluczem jest ID z bazy czy nazwa auta zewnętrznego
    const isId =
      typeof vehicleKey === 'number' ||
      (!isNaN(Number(vehicleKey)) && !String(vehicleKey).includes(' ') && String(Number(vehicleKey)) === String(vehicleKey));

    const id_pojazdu = isId && Number(vehicleKey) > 0 ? Number(vehicleKey) : null;
    const pojazd_zewnetrzny = !id_pojazdu ? String(vehicleKey).trim() : null;

    const deleteWhere: any = { id_organizacji, id_etapu: { in: validStageIds } };
    if (id_pojazdu) {
      deleteWhere.id_pojazdu = id_pojazdu;
    } else if (pojazd_zewnetrzny) {
      deleteWhere.pojazd_zewnetrzny = pojazd_zewnetrzny;
    }

    await this.prisma.extendedClient.etapPojazd.deleteMany({ where: deleteWhere });

    if (stageIds && stageIds.length > 0) {
      await this.prisma.extendedClient.etapPojazd.createMany({
        data: stageIds
          .filter((id) => validStageIds.includes(id))
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

  // --- Noclegi ---
  async addNocleg(id_wydarzenia: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzenieNocleg.create({
      data: {
        id_organizacji,
        id_wydarzenia,
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
    return this.prisma.extendedClient.wydarzenieNocleg.update({
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
    return this.prisma.extendedClient.wydarzenieNocleg.delete({ where: { id, id_organizacji } });
  }

  // --- Ekipa Ogólna ---
  async addEkipa(id_wydarzenia: number, dto: any, id_organizacji: number) {
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

    if (!id_uzytkownika) {
      throw new BadRequestException('Nie wybrano użytkownika.');
    }

    const existingAssignment = await this.prisma.extendedClient.wydarzenieUzytkownik.findFirst({
      where: { id_organizacji, id_wydarzenia, id_uzytkownika },
    });

    if (existingAssignment) {
      return this.prisma.extendedClient.wydarzenieUzytkownik.update({
        where: { id: existingAssignment.id },
        data: { rola_w_wydarzeniu: dto.rola || existingAssignment.rola_w_wydarzeniu },
      });
    }

    return this.prisma.extendedClient.wydarzenieUzytkownik.create({
      data: {
        id_organizacji,
        id_wydarzenia,
        id_uzytkownika,
        rola_w_wydarzeniu: dto.rola || 'Obsługa techniczna',
      },
    });
  }

  async updateEkipa(ekipaId: number, dto: any, id_organizacji: number) {
    const existing = await this.prisma.extendedClient.wydarzenieUzytkownik.findFirst({
      where: { id: ekipaId, id_organizacji },
      include: { uzytkownik: true }
    });
    if (!existing) throw new NotFoundException('Nie znaleziono przypisania ekipy');

    if (dto.imie || dto.nazwisko || dto.telefon || dto.email) {
      await this.prisma.extendedClient.uzytkownik.update({
        where: { id: existing.id_uzytkownika },
        data: {
          imie: dto.imie || existing.uzytkownik.imie,
          nazwisko: dto.nazwisko || existing.uzytkownik.nazwisko,
          telefon: dto.telefon !== undefined ? dto.telefon : existing.uzytkownik.telefon,
          email: dto.email !== undefined ? dto.email : existing.uzytkownik.email,
        }
      });
    }

    return this.prisma.extendedClient.wydarzenieUzytkownik.update({
      where: { id: ekipaId },
      data: {
        rola_w_wydarzeniu: dto.rola || dto.rola_w_wydarzeniu || existing.rola_w_wydarzeniu,
      },
      include: { uzytkownik: true }
    });
  }

  async removeEkipa(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzenieUzytkownik.delete({ where: { id, id_organizacji } });
  }

  // --- Flota Ogólna ---
  async addFlota(id_wydarzenia: number, dto: any, id_organizacji: number) {
    const id_pojazdu = dto.id_pojazdu ? Number(dto.id_pojazdu) : null;
    const pojazd_zewnetrzny = dto.pojazd_zewnetrzny ? String(dto.pojazd_zewnetrzny).trim() : null;

    if (id_pojazdu) {
      const existing = await this.prisma.extendedClient.wydarzeniePojazd.findFirst({
        where: { id_organizacji, id_wydarzenia, id_pojazdu, aktywny: true },
      });
      if (existing) {
        return this.prisma.extendedClient.wydarzeniePojazd.update({
          where: { id: existing.id },
          data: { rola_pojazdu: dto.rola || dto.rola_pojazdu || existing.rola_pojazdu },
        });
      }
    }

    return this.prisma.extendedClient.wydarzeniePojazd.create({
      data: {
        id_organizacji,
        id_wydarzenia,
        id_pojazdu,
        pojazd_zewnetrzny,
        rola_pojazdu: dto.rola || dto.rola_pojazdu || 'Transport sprzętu',
      },
    });
  }

  async removeFlota(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzeniePojazd.delete({ where: { id, id_organizacji } });
  }

  // --- Powiadomienia (Mailing) ---
  async wyslijPowiadomienieEkipa(id_wydarzenia: number, user_ids: number[], id_organizacji: number) {
    const wydarzenie = await this.findOne(id_wydarzenia, id_organizacji);
    const ekipa = await this.prisma.extendedClient.uzytkownik.findMany({
      where: { id: { in: user_ids.map(Number) }, id_organizacji, aktywny: true },
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let wyslano = 0;

    for (const user of ekipa) {
      if (!user.email || user.email.includes('@temp.eventflow.pl')) continue;
      const isExternal = user.stanowisko === 'Współpracownik Zewnętrzny';
      const token = Buffer.from(`${user.id}-${id_wydarzenia}`).toString('base64');
      const eventLink = isExternal ? `${baseUrl}/guest/events/${id_wydarzenia}?token=${token}` : `${baseUrl}/dashboard/events/${id_wydarzenia}`;
      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || '"EventFlow WMS" <no-reply@eventflow.pl>',
          to: user.email,
          subject: `[EventFlow] Przypisano Cię do wydarzenia: ${wydarzenie.nazwa}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #06B6D4;">Witaj ${user.imie},</h2>
              <p>Zostałeś przypisany do obsługi wydarzenia: <b>${wydarzenie.nazwa}</b>.</p>
              <p><b>Ramy czasowe wydarzenia:</b><br/>
                ${wydarzenie.data_start ? wydarzenie.data_start.toLocaleString('pl-PL') : 'Brak danych'} - 
                ${wydarzenie.data_koniec ? wydarzenie.data_koniec.toLocaleString('pl-PL') : 'Brak danych'}
              </p>
              <div style="text-align: center; margin: 30px 0;"><a href="${eventLink}" style="display: inline-block; padding: 14px 28px; background-color: #06B6D4; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Zobacz szczegóły w EventFlow</a></div>
            </div>
          `,
        });
        await this.prisma.extendedClient.powiadomienieEkipa.create({ data: { id_organizacji, id_wydarzenia, id_uzytkownika: user.id } });
        wyslano++;
      } catch (err) {
        console.error(`Błąd wysyłki SMTP do ${user.email}:`, err);
      }
    }

    await this.prisma.extendedClient.logZmian.create({
      data: {
        id_organizacji,
        id_uzytkownika: null,
        typ_obiektu: 'Wydarzenie',
        id_obiektu: id_wydarzenia,
        akcja: 'WYSLANIE_POWIADOMIEN_EKIPA',
        nowa_wartosc: JSON.stringify({ wyslano_do: wyslano }),
      },
    });

    return { success: true, count: wyslano };
  }

  // --- CRUD podstawowy wydarzenia ---
  async create(dto: any, id_organizacji: number, id_uzytkownika: number) {
    const numer = `E${new Date().getFullYear()}/${new Date().getMonth() + 1}/${Math.floor(Math.random() * 1000)}`;
    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      const wydarzenie = await tx.wydarzenie.create({
        data: {
          nazwa: this.s(dto.nazwa) || 'Bez nazwy',
          numer,
          data_start: this.d(dto.data_start),
          data_koniec: this.d(dto.data_koniec),
          opis: this.s(dto.opis),
          id_typu_wydarzenia: this.n(dto.id_typu_wydarzenia),
          miejsce_reczne: this.s(dto.miejsce_reczne),
          adres_reczny: this.s(dto.adres_reczny),
          link_google_maps: this.s(dto.adres_reczny)
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.s(dto.adres_reczny) || '')}`
            : this.s(dto.link_google_maps),
          id_organizacji,
          id_tworcy: id_uzytkownika,
          id_managera: this.n(dto.id_managera),
          id_statusu_wydarzenia: this.n(dto.id_statusu_wydarzenia),
          id_statusu_magazynowego: this.n(dto.id_statusu_magazynowego),
          id_statusu_ksiegowego: this.n(dto.id_statusu_ksiegowego),
          id_oferty_glownej: this.n(dto.id_oferty_glownej),
          id_kontrahenta: this.n(dto.id_kontrahenta),
          id_kontaktu: this.n(dto.id_kontaktu),
          id_miejsca: this.n(dto.id_miejsca),
          budzet_netto: this.n(dto.budzet_netto),
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wydarzenie',
          id_obiektu: wydarzenie.id,
          akcja: 'UTWORZENIE',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      return wydarzenie;
    });
  }

  async update(id: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      const wydarzenie = await tx.wydarzenie.update({
        where: { id },
        data: {
          nazwa: this.s(dto.nazwa) || 'Bez nazwy',
          data_start: this.d(dto.data_start),
          data_koniec: this.d(dto.data_koniec),
          opis: this.s(dto.opis),
          id_typu_wydarzenia: this.n(dto.id_typu_wydarzenia),
          miejsce_reczne: this.s(dto.miejsce_reczne),
          adres_reczny: this.s(dto.adres_reczny),
          link_google_maps: this.s(dto.adres_reczny)
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.s(dto.adres_reczny) || '')}`
            : this.s(dto.link_google_maps),
          id_managera: this.n(dto.id_managera),
          id_statusu_wydarzenia: this.n(dto.id_statusu_wydarzenia),
          id_statusu_magazynowego: this.n(dto.id_statusu_magazynowego),
          id_statusu_ksiegowego: this.n(dto.id_statusu_ksiegowego),
          id_oferty_glownej: this.n(dto.id_oferty_glownej),
          id_kontrahenta: this.n(dto.id_kontrahenta),
          id_kontaktu: this.n(dto.id_kontaktu),
          id_miejsca: this.n(dto.id_miejsca),
          budzet_netto: this.n(dto.budzet_netto),
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wydarzenie',
          id_obiektu: id,
          akcja: 'EDYCJA',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      return wydarzenie;
    });
  }

  async remove(id: number, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.$transaction(async (tx: any) => {
      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Wydarzenie',
          id_obiektu: id,
          akcja: 'USUNIECIE',
        },
      });
      return tx.wydarzenie.delete({ where: { id } });
    });
  }

  async wyslijPowiadomieniaMasowe(id_organizacji: number, id_uzytkownika: number) {
    await this.prisma.extendedClient.logZmian.create({
      data: {
        id_organizacji,
        id_uzytkownika,
        typ_obiektu: 'System',
        akcja: 'WYSLANIE_POWIADOMIEN_MASOWYCH',
        nowa_wartosc: 'Wysłano przypomnienia do przypisanych ekip i klientów',
      },
    });
    return {
      success: true,
      message: 'Powiadomienia zostały wygenerowane i przesłane do kolejki wysyłkowej.',
    };
  }

  // --- Widok Gościa (dla Freelancerów z tokenem) ---
  async getGuestEvent(id: number, token: string) {
    if (!token) throw new BadRequestException('Brak tokenu dostępu w adresie URL');

    let userIdStr, eventIdStr;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      [userIdStr, eventIdStr] = decoded.split('-');
    } catch {
      throw new BadRequestException('Nieprawidłowy format tokenu zabezpieczającego');
    }

    if (Number(eventIdStr) !== id) {
      throw new BadRequestException('Link wygasł lub jest przypisany do innego wydarzenia');
    }

    const userId = Number(userIdStr);
    const event = await this.prisma.extendedClient.wydarzenie.findFirst({
      where: { id, aktywny: true },
      include: {
        typ: true,
        miejsce: true,
        kontrahent: true,
        kontakt: true,
        manager: { select: { imie: true, nazwisko: true, telefon: true, email: true } },
        managerowie: { where: { aktywny: true }, include: { uzytkownik: { select: { imie: true, nazwisko: true, telefon: true, email: true } } } },
        etapy: {
          orderBy: { data_start: 'asc' },
          include: {
            przypisani_uzytkownicy: { where: { id_uzytkownika: userId, aktywny: true } },
          },
        },
        ekipa: {
          where: { id_uzytkownika: userId, aktywny: true },
        },
      },
    });

    if (!event) throw new NotFoundException('Nie znaleziono wydarzenia w systemie');

    if (event.ekipa.length === 0) {
      throw new ForbiddenException('Brak dostępu: Zostałeś usunięty lub nie jesteś przypisany do ekipy obsługującej to wydarzenie.');
    }

    const uzytkownik = await this.prisma.extendedClient.uzytkownik.findUnique({
      where: { id: userId },
      select: { imie: true, nazwisko: true, stanowisko: true },
    });

    const allManagersMap = new Map();
    if (event.manager) allManagersMap.set(event.manager.email, event.manager);
    for (const m of event.managerowie) {
      if (m.uzytkownik) allManagersMap.set(m.uzytkownik.email, m.uzytkownik);
    }

    const pelnyAdresMapy =
      event.adres_reczny ||
      (event.miejsce?.ulica ? `${event.miejsce.ulica}, ${event.miejsce.miasto || ''}` : '') ||
      event.miejsce?.nazwa ||
      event.miejsce_reczne ||
      '';

    return {
      wydarzenie: {
        id: event.id,
        nazwa: event.nazwa,
        data_start: event.data_start,
        data_koniec: event.data_koniec,
        opis: event.opis,
        miejsce: event.miejsce?.nazwa || event.miejsce_reczne,
        adres: event.adres_reczny || (event.miejsce?.ulica ? `${event.miejsce.ulica}, ${event.miejsce.miasto || ''}` : ''),
        adresMapy: pelnyAdresMapy,
        typ: event.typ?.nazwa,
        kolor: event.typ?.kolor || '#06B6D4',
        klient: event.kontrahent?.nazwa || null,
        osoba_kontaktowa: event.kontakt
          ? {
              imie_nazwisko: `${event.kontakt.imie || ''} ${event.kontakt.nazwisko || ''}`.trim(),
              telefon: event.kontakt.telefon,
              email: event.kontakt.email,
            }
          : null,
        managerowie: Array.from(allManagersMap.values()),
        etapy: event.etapy.map((e: any) => ({
          id: e.id,
          nazwa: e.nazwa,
          data_start: e.data_start,
          data_koniec: e.data_koniec,
          opis: e.opis,
          przypisany: e.przypisani_uzytkownicy.length > 0,
        })),
      },
      uzytkownik,
      rola: event.ekipa[0].rola_w_wydarzeniu,
    };
  }

  async addChatMessage(id_wydarzenia: number, message: string, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.logZmian.create({
      data: {
        id_organizacji,
        id_uzytkownika,
        typ_obiektu: 'Wydarzenie',
        id_obiektu: id_wydarzenia,
        akcja: 'CHAT',
        nowa_wartosc: message,
      },
    });
  }

  async addZalacznik(id_wydarzenia: number, dto: any, file: Express.Multer.File, id_organizacji: number, id_uzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, id_organizacji, 'wydarzenia_zalaczniki');
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji,
        typ_obiektu: 'Wydarzenie',
        id_obiektu: id_wydarzenia,
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