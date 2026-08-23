import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SerwisService {
  constructor(private readonly prisma: PrismaService) {}

  async getWszystkieZgloszenia(id_organizacji: number) {
    return this.prisma.extendedClient.serwisSprzetu.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        egzemplarz: {
          include: { model: true }
        },
        zglosil: {
          select: { imie: true, nazwisko: true }
        },
        rozwiazal: {
          select: { imie: true, nazwisko: true }
        },
        status: true
      },
      orderBy: { data_zgloszenia: 'desc' }
    });
  }

  async getZgloszenieById(id: number, id_organizacji: number) {
    const zgloszenie = await this.prisma.extendedClient.serwisSprzetu.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        egzemplarz: {
          include: { model: true }
        },
        zglosil: {
          select: { id: true, imie: true, nazwisko: true }
        },
        rozwiazal: {
          select: { id: true, imie: true, nazwisko: true }
        },
        status: true
      }
    });

    if (!zgloszenie) throw new NotFoundException('Nie znaleziono zgłoszenia');
    return zgloszenie;
  }

  async getStatusy(id_organizacji: number) {
    let statusy = await this.prisma.extendedClient.statusSerwisu.findMany({
      where: { id_organizacji, aktywny: true },
      orderBy: { kolejnosc: 'asc' }
    });

    if (statusy.length === 0) {
      await this.prisma.extendedClient.statusSerwisu.createMany({
        data: [
          // EVENTFLOW_PRODUCT_POLISH_V4: statusy zgodne ze wzorem ze zrzutu.
          { id_organizacji, nazwa: 'Działa', kolor: '#22c55e', kolejnosc: 1 },
          { id_organizacji, nazwa: 'Wymaga serwisu (działa)', kolor: '#facc15', kolejnosc: 2 },
          { id_organizacji, nazwa: 'Wymaga serwisu (nie działa)', kolor: '#ef4444', kolejnosc: 3 },
          { id_organizacji, nazwa: 'W serwisie', kolor: '#2563eb', kolejnosc: 4 },
          { id_organizacji, nazwa: 'Naprawiony', kolor: '#16a34a', kolejnosc: 5 },
        ]
      });

      statusy = await this.prisma.extendedClient.statusSerwisu.findMany({
        where: { id_organizacji, aktywny: true },
        orderBy: { kolejnosc: 'asc' }
      });
    }

    return statusy;
  }

  async getZgloszeniaDlaModelu(id_modelu: number, id_organizacji: number) {
    return this.prisma.extendedClient.serwisSprzetu.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        egzemplarz: { id_modelu }
      },
      include: {
        egzemplarz: true,
        status: true,
        zglosil: { select: { imie: true, nazwisko: true } },
        rozwiazal: { select: { imie: true, nazwisko: true } }
      },
      orderBy: { data_zgloszenia: 'desc' }
    });
  }

  async updateZgloszenie(id: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    const cleanNumber = (val: any) => (val === "" || val === undefined || val === null || isNaN(Number(val))) ? null : Number(val);
    const cleanString = (val: any) => (val === null || val === undefined || String(val).trim() === '') ? null : String(val).trim();

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const existing = await tx.serwisSprzetu.findFirst({
        where: { id, id_organizacji }
      });

      if (!existing) throw new NotFoundException('Zgłoszenie nie istnieje');

      let dataRozwiazania = existing.data_rozwiazania;
      let rozwiazal = existing.id_uzytkownika_rozwiazal;

      if (dto.czy_rozwiazane && !dataRozwiazania) {
        dataRozwiazania = new Date();
        rozwiazal = id_uzytkownika;
      } else if (!dto.czy_rozwiazane) {
        dataRozwiazania = null;
        rozwiazal = null;
      }

      const updated = await tx.serwisSprzetu.update({
        where: { id },
        data: {
          tytul: cleanString(dto.tytul) || existing.tytul,
          opis: cleanString(dto.opis),
          rozwiazanie: cleanString(dto.rozwiazanie),
          id_statusu_serwisu: cleanNumber(dto.id_statusu_serwisu) || existing.id_statusu_serwisu,
          data_rozwiazania: dataRozwiazania,
          id_uzytkownika_rozwiazal: rozwiazal
        }
      });

      // --- ZMIANA: Aktualizacja samego Egzemplarza (Sprzętu) z poziomu serwisu ---
      if (dto.status_serwisowy_sprzetu) {
        await tx.egzemplarz.update({
          where: { id: existing.id_egzemplarza },
          data: { status_serwisowy: cleanString(dto.status_serwisowy_sprzetu) }
        });
      }

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'SerwisSprzetu',
          id_obiektu: id,
          akcja: 'EDYCJA_ZGLOSZENIA',
          nowa_wartosc: JSON.stringify({ status: updated.id_statusu_serwisu, status_sprzetu: dto.status_serwisowy_sprzetu })
        }
      });

      return updated;
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V3: tworzenie zgłoszenia serwisowego bezpośrednio z panelu Serwis.
  async createZgloszenie(dto: any, id_organizacji: number, id_uzytkownika: number) {
    const status = dto.id_statusu_serwisu
      ? Number(dto.id_statusu_serwisu)
      : (await this.getStatusy(id_organizacji))[0]?.id;

    if (!status) throw new NotFoundException('Brak statusu serwisowego');

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const created = await tx.serwisSprzetu.create({
        data: {
          id_organizacji,
          id_egzemplarza: Number(dto.id_egzemplarza),
          id_statusu_serwisu: status,
          id_uzytkownika_zglosil: id_uzytkownika,
          tytul: dto.tytul,
          opis: dto.opis || null,
        }
      });

      // EVENTFLOW_PRODUCT_POLISH_V4: kliknięcie Nowe zgłoszenie zmienia też status sprzętu, jeśli użytkownik go wskaże.
      if (dto.status_serwisowy_sprzetu) {
        await tx.egzemplarz.update({
          where: { id: Number(dto.id_egzemplarza) },
          data: { status_serwisowy: String(dto.status_serwisowy_sprzetu) },
        });
      }

      return created;
    });
  }

  async getStatusById(id: number, id_organizacji: number) {
    const status = await this.prisma.extendedClient.statusSerwisu.findFirst({ where: { id, id_organizacji, aktywny: true } });
    if (!status) throw new NotFoundException('Nie znaleziono statusu serwisowego');
    return status;
  }

  async createStatus(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.statusSerwisu.create({
      data: {
        id_organizacji,
        nazwa: dto.nazwa,
        kolor: dto.kolor || '#64748b',
        kolejnosc: Number(dto.kolejnosc || 0),
      }
    });
  }

  async updateStatus(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.statusSerwisu.update({
      where: { id },
      data: {
        nazwa: dto.nazwa,
        kolor: dto.kolor,
        kolejnosc: Number(dto.kolejnosc || 0),
        aktywny: dto.aktywny ?? true,
      }
    });
  }



  // EVENTFLOW_PRODUCT_POLISH_V6: usuwanie statusu oznacza go jako nieaktywny, żeby nie zrywać historii zgłoszeń.
  async deleteStatus(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.statusSerwisu.update({
      where: { id },
      data: { aktywny: false, data_usuniecia: new Date() }
    });
  }
}
