import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FlotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private n(v: any) { return v === '' || v == null ? null : Number(v); }
  private d(v: any) { return v ? new Date(v) : null; }
  private s(v: any) { return v === '' || v == null ? null : String(v).trim(); }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.pojazd.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        wydarzenia: { where: { aktywny: true }, include: { wydarzenie: true } },
        serwisy_pojazdu: { 
          where: { aktywny: true }, 
          include: { nadzorca: { select: { id: true, imie: true, nazwisko: true } } },
          orderBy: { data_serwisu: 'desc' }, 
          take: 5 
        },
        przeglady_pojazdu: { where: { aktywny: true }, orderBy: { data_przegladu: 'desc' }, take: 5 },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    const pojazd = await this.prisma.extendedClient.pojazd.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        serwisy_pojazdu: {
          where: { aktywny: true },
          include: { nadzorca: { select: { id: true, imie: true, nazwisko: true, email: true, avatar: true } } },
          orderBy: { data_serwisu: 'desc' },
        },
        przeglady_pojazdu: { where: { aktywny: true }, orderBy: { data_przegladu: 'desc' } },
      },
    });
    if (!pojazd) throw new NotFoundException('Nie znaleziono pojazdu');

    // Załączniki polimorficzne pojazdu
    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'Pojazd', id_obiektu: id, aktywny: true },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });

    return { ...pojazd, zalaczniki };
  }

  async create(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.pojazd.create({
      data: {
        id_organizacji,
        nazwa: dto.nazwa,
        nr_rejestracyjny: dto.nr_rejestracyjny,
        marka: this.s(dto.marka),
        model: this.s(dto.model),
        rok_produkcji: this.n(dto.rok_produkcji),
        vin: this.s(dto.vin),
        status: this.s(dto.status) || 'Dostępny',
        przebieg_km: this.n(dto.przebieg_km),
        data_przegladu: this.d(dto.data_przegladu),
        data_oc: this.d(dto.data_oc),
        numer_polisy_oc: this.s(dto.numer_polisy_oc),
        ubezpieczyciel: this.s(dto.ubezpieczyciel),
        ladownosc_kg: this.n(dto.ladownosc_kg),
        objetosc_m3: this.n(dto.objetosc_m3),
        notatki: dto.notatki || null,
      },
    });
  }

  async update(id: number, dto: any, id_organizacji: number) {
    await this.ensure(id, id_organizacji);
    return this.prisma.extendedClient.pojazd.update({
      where: { id },
      data: {
        nazwa: dto.nazwa,
        nr_rejestracyjny: dto.nr_rejestracyjny,
        marka: this.s(dto.marka),
        model: this.s(dto.model),
        rok_produkcji: this.n(dto.rok_produkcji),
        vin: this.s(dto.vin),
        status: dto.status !== undefined ? this.s(dto.status) : undefined,
        przebieg_km: this.n(dto.przebieg_km),
        data_przegladu: this.d(dto.data_przegladu),
        data_oc: this.d(dto.data_oc),
        numer_polisy_oc: this.s(dto.numer_polisy_oc),
        ubezpieczyciel: this.s(dto.ubezpieczyciel),
        ladownosc_kg: this.n(dto.ladownosc_kg),
        objetosc_m3: this.n(dto.objetosc_m3),
        notatki: dto.notatki || null,
      },
    });
  }

  async remove(id: number, id_organizacji: number) {
    await this.ensure(id, id_organizacji);
    return this.prisma.extendedClient.pojazd.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }

  async ensure(id: number, id_organizacji: number) {
    const p = await this.prisma.extendedClient.pojazd.findFirst({ where: { id, id_organizacji, aktywny: true } });
    if (!p) throw new NotFoundException('Nie znaleziono pojazdu');
    return p;
  }

  // ===================================================================
  // SERWIS POJAZDÓW (ZGŁOSZENIA I AWARIE)
  // ===================================================================

  async getSerwisy(idPojazdu: number, idOrganizacji: number) {
    await this.ensure(idPojazdu, idOrganizacji);
    const serwisy = await this.prisma.extendedClient.serwisPojazdu.findMany({
      where: { id_pojazdu: idPojazdu, id_organizacji: idOrganizacji, aktywny: true },
      include: {
        nadzorca: { select: { id: true, imie: true, nazwisko: true, email: true, avatar: true } },
      },
      orderBy: { data_serwisu: 'desc' },
    });

    // Pobieramy załączniki dla każdego zgłoszenia
    const serwisIds = serwisy.map(s => s.id);
    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: {
        id_organizacji: idOrganizacji,
        typ_obiektu: 'SerwisPojazdu',
        id_obiektu: { in: serwisIds },
        aktywny: true,
      },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
    });

    return serwisy.map(s => ({
      ...s,
      zalaczniki: zalaczniki.filter(z => z.id_obiektu === s.id),
    }));
  }

  async createSerwis(idPojazdu: number, dto: any, idOrganizacji: number, idUzytkownika: number) {
    const pojazd = await this.ensure(idPojazdu, idOrganizacji);

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const serwis = await tx.serwisPojazdu.create({
        data: {
          id_organizacji: idOrganizacji,
          id_pojazdu: idPojazdu,
          id_nadzorcy: this.n(dto.id_nadzorcy),
          typ_serwisu: this.s(dto.typ_serwisu) || 'usterka',
          status: this.s(dto.status) || 'w_trakcie',
          miejsce_serwisu: this.s(dto.miejsce_serwisu),
          data_serwisu: this.d(dto.data_serwisu) || new Date(),
          data_zakonczenia: this.d(dto.data_zakonczenia),
          przebieg_km: this.n(dto.przebieg_km) ?? pojazd.przebieg_km,
          opis: this.s(dto.opis),
          zalecenia: this.s(dto.zalecenia),
          koszt_netto: this.n(dto.koszt_netto),
          koszt_brutto: this.n(dto.koszt_brutto),
          zmieniono_status_auta: !!dto.zmien_status_auta,
        },
        include: {
          nadzorca: { select: { id: true, imie: true, nazwisko: true, email: true } },
        },
      });

      // Aktualizacja danych pojazdu (statusu i przebiegu)
      const vehicleUpdate: any = {};
      if (dto.zmien_status_auta && dto.nowy_status_auta) {
        vehicleUpdate.status = String(dto.nowy_status_auta);
      } else if (dto.status === 'w_trakcie') {
        vehicleUpdate.status = 'W serwisie';
      }

      if (dto.przebieg_km && Number(dto.przebieg_km) > (pojazd.przebieg_km || 0)) {
        vehicleUpdate.przebieg_km = Number(dto.przebieg_km);
      }

      // Aktualizacja daty następnego przeglądu w aucie, jeśli zgłoszenie dotyczyło przeglądu
      if (dto.typ_serwisu === 'techniczny' && dto.data_nastepnego_przegladu) {
        vehicleUpdate.data_przegladu = new Date(dto.data_nastepnego_przegladu);
      }

      if (Object.keys(vehicleUpdate).length > 0) {
        await tx.pojazd.update({
          where: { id: idPojazdu },
          data: vehicleUpdate,
        });
      }

      await tx.logZmian.create({
        data: {
          id_organizacji: idOrganizacji,
          id_uzytkownika: idUzytkownika,
          typ_obiektu: 'Pojazd',
          id_obiektu: idPojazdu,
          akcja: 'DODANIE_SERWISU',
          nowa_wartosc: JSON.stringify({ serwisId: serwis.id, typ: serwis.typ_serwisu, koszt: serwis.koszt_netto }),
        },
      });

      return serwis;
    });
  }

  async updateSerwis(idSerwisu: number, dto: any, idOrganizacji: number, idUzytkownika: number) {
    const existing = await this.prisma.extendedClient.serwisPojazdu.findFirst({
      where: { id: idSerwisu, id_organizacji: idOrganizacji, aktywny: true },
    });
    if (!existing) throw new NotFoundException('Nie znaleziono wpisu serwisowego');

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const updated = await tx.serwisPojazdu.update({
        where: { id: idSerwisu },
        data: {
          id_nadzorcy: dto.id_nadzorcy !== undefined ? this.n(dto.id_nadzorcy) : existing.id_nadzorcy,
          typ_serwisu: dto.typ_serwisu !== undefined ? this.s(dto.typ_serwisu) : existing.typ_serwisu,
          status: dto.status !== undefined ? this.s(dto.status) : existing.status,
          miejsce_serwisu: dto.miejsce_serwisu !== undefined ? this.s(dto.miejsce_serwisu) : existing.miejsce_serwisu,
          data_serwisu: dto.data_serwisu ? new Date(dto.data_serwisu) : existing.data_serwisu,
          data_zakonczenia: dto.data_zakonczenia !== undefined ? this.d(dto.data_zakonczenia) : existing.data_zakonczenia,
          przebieg_km: dto.przebieg_km !== undefined ? this.n(dto.przebieg_km) : existing.przebieg_km,
          opis: dto.opis !== undefined ? this.s(dto.opis) : existing.opis,
          zalecenia: dto.zalecenia !== undefined ? this.s(dto.zalecenia) : existing.zalecenia,
          koszt_netto: dto.koszt_netto !== undefined ? this.n(dto.koszt_netto) : existing.koszt_netto,
          koszt_brutto: dto.koszt_brutto !== undefined ? this.n(dto.koszt_brutto) : existing.koszt_brutto,
        },
        include: {
          nadzorca: { select: { id: true, imie: true, nazwisko: true, email: true } },
        },
      });

      // Jeśli status serwisu zmienił się na "zakonczony", a auto miało status "W serwisie", przywracamy "Dostępny"
      if (dto.status === 'zakonczony' && dto.przywroc_dostepnosc_auta) {
        await tx.pojazd.update({
          where: { id: existing.id_pojazdu },
          data: { status: 'Dostępny' },
        });
      }

      // Aktualizacja przebiegu pojazdu
      if (dto.przebieg_km && Number(dto.przebieg_km) > 0) {
        const p = await tx.pojazd.findUnique({ where: { id: existing.id_pojazdu }, select: { przebieg_km: true } });
        if (p && Number(dto.przebieg_km) > (p.przebieg_km || 0)) {
          await tx.pojazd.update({
            where: { id: existing.id_pojazdu },
            data: { przebieg_km: Number(dto.przebieg_km) },
          });
        }
      }

      await tx.logZmian.create({
        data: {
          id_organizacji: idOrganizacji,
          id_uzytkownika: idUzytkownika,
          typ_obiektu: 'SerwisPojazdu',
          id_obiektu: idSerwisu,
          akcja: 'EDYCJA_SERWISU',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      return updated;
    });
  }

  async removeSerwis(idSerwisu: number, idOrganizacji: number) {
    const s = await this.prisma.extendedClient.serwisPojazdu.findFirst({
      where: { id: idSerwisu, id_organizacji: idOrganizacji },
    });
    if (!s) throw new NotFoundException('Nie znaleziono serwisu');

    return this.prisma.extendedClient.serwisPojazdu.update({
      where: { id: idSerwisu },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  async addZalacznikSerwisu(idSerwisu: number, dto: any, file: Express.Multer.File, idOrganizacji: number, idUzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, idOrganizacji, 'flota_serwisy');
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji: idOrganizacji,
        typ_obiektu: 'SerwisPojazdu',
        id_obiektu: idSerwisu,
        nazwa: dto.nazwa || file.originalname,
        nazwa_pliku: file.originalname,
        rozmiar_bajtow: file.size,
        mime: file.mimetype,
        sciezka: objectKey,
        id_uzytkownika_dodal: idUzytkownika,
      },
    });
  }

  // ===================================================================
  // ZAŁĄCZNIKI POJAZDU (FLOTA)
  // ===================================================================

  async addZalacznik(idPojazdu: number, dto: any, file: Express.Multer.File, idOrganizacji: number, idUzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, idOrganizacji, 'flota_zalaczniki');
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji: idOrganizacji,
        typ_obiektu: 'Pojazd',
        id_obiektu: idPojazdu,
        nazwa: dto.nazwa || file.originalname,
        nazwa_pliku: file.originalname,
        rozmiar_bajtow: file.size,
        mime: file.mimetype,
        sciezka: objectKey,
        id_uzytkownika_dodal: idUzytkownika,
      },
    });
  }

  async removeZalacznik(id: number, idOrganizacji: number) {
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id, id_organizacji: idOrganizacji },
    });
    if (zalacznik && zalacznik.sciezka && !zalacznik.sciezka.startsWith('data:')) {
      await this.storage.deleteFile(zalacznik.sciezka);
    }
    return this.prisma.extendedClient.zalacznik.update({
      where: { id, id_organizacji: idOrganizacji },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  async availability(id: number, id_organizacji: number, q: any) {
    const pojazd = await this.ensure(id, id_organizacji);
    const od = q.od ? new Date(q.od) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const doDaty = q.do ? new Date(q.do) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);
    const rezerwacje = await this.prisma.extendedClient.wydarzeniePojazd.findMany({
      where: {
        id_organizacji,
        id_pojazdu: id,
        aktywny: true,
        wydarzenie: { data_start: { lte: doDaty }, data_koniec: { gte: od } },
      },
      include: { wydarzenie: true },
    });
    const informacyjne = [
      pojazd.data_przegladu ? { typ: 'przeglad', tytul: `Przegląd techniczny: ${pojazd.nazwa}`, start: pojazd.data_przegladu, editable: false } : null,
      pojazd.data_oc ? { typ: 'oc', tytul: `OC: ${pojazd.nazwa}`, start: pojazd.data_oc, editable: false } : null,
    ].filter(Boolean);
    return { od, do: doDaty, rezerwacje, informacyjne };
  }

  async reserve(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzeniePojazd.create({
      data: {
        id_organizacji,
        id_pojazdu: Number(dto.id_pojazdu),
        id_wydarzenia: Number(dto.id_wydarzenia),
        rola_pojazdu: dto.rola_pojazdu || 'transport',
      },
    });
  }
}