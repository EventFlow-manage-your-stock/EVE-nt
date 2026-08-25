import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class FlotaService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}
  private n(v: any) { return v === '' || v == null ? null : Number(v); }
  private d(v: any) { return v ? new Date(v) : null; }
  private s(v: any) { return v === '' || v == null ? null : String(v).trim(); }

  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.pojazd.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        wydarzenia: { where: { aktywny: true }, include: { wydarzenie: true } },
        serwisy_pojazdu: { where: { aktywny: true }, orderBy: { data_serwisu: 'desc' }, take: 5 },
        przeglady_pojazdu: { where: { aktywny: true }, orderBy: { data_przegladu: 'desc' }, take: 5 },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  async findOne(id: number, id_organizacji: number) {
    // 1. Pobieramy pojazd i jego twarde relacje
    const pojazd = await this.prisma.extendedClient.pojazd.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        serwisy_pojazdu: { where: { aktywny: true }, orderBy: { data_serwisu: 'desc' } },
        przeglady_pojazdu: { where: { aktywny: true }, orderBy: { data_przegladu: 'desc' } },
      },
    });

    if (!pojazd) throw new NotFoundException('Nie znaleziono pojazdu');

    // 2. Pobieramy załączniki polimorficzne osobnym zapytaniem
    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { 
        id_organizacji, 
        typ_obiektu: 'Pojazd', 
        id_obiektu: id, 
        aktywny: true 
      },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });

    // 3. Mergujemy dane dla frontendu
    return { ...pojazd, zalaczniki };
  }

  async addZalacznik(id_pojazdu: number, dto: any, file: Express.Multer.File, id_organizacji: number, id_uzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, id_organizacji, 'flota_zalaczniki');

    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji,
        typ_obiektu: 'Pojazd',
        id_obiektu: id_pojazdu,
        nazwa: dto.nazwa || file.originalname,
        nazwa_pliku: file.originalname,
        rozmiar_bajtow: file.size,
        mime: file.mimetype,
        sciezka: objectKey,
        id_uzytkownika_dodal: id_uzytkownika
      }
    });
  }

  async removeZalacznik(id: number, id_organizacji: number) {
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id, id_organizacji }
    });
    
    if (zalacznik && zalacznik.sciezka && !zalacznik.sciezka.startsWith('data:')) {
      await this.storage.deleteFile(zalacznik.sciezka);
    }
    
    return this.prisma.extendedClient.zalacznik.update({
      where: { id, id_organizacji },
      data: { aktywny: false }
    });
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
        przebieg_km: this.n(dto.przebieg_km),
        data_przegladu: this.d(dto.data_przegladu),
        data_oc: this.d(dto.data_oc),
        numer_polisy_oc: this.s(dto.numer_polisy_oc),
        ubezpieczyciel: this.s(dto.ubezpieczyciel),
        ladownosc_kg: this.n(dto.ladownosc_kg),
        objetosc_m3: this.n(dto.objetosc_m3),
        notatki: dto.notatki || null,
        zdjecie: dto.zdjecie || null, // <--- DODANE POLE
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
        przebieg_km: this.n(dto.przebieg_km),
        data_przegladu: this.d(dto.data_przegladu),
        data_oc: this.d(dto.data_oc),
        numer_polisy_oc: this.s(dto.numer_polisy_oc),
        ubezpieczyciel: this.s(dto.ubezpieczyciel),
        ladownosc_kg: this.n(dto.ladownosc_kg),
        objetosc_m3: this.n(dto.objetosc_m3),
        notatki: dto.notatki || null,
        zdjecie: dto.zdjecie || null, // <--- DODANE POLE
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

  async availability(id: number, id_organizacji: number, q: any) {
    const pojazd = await this.ensure(id, id_organizacji);
    const od = q.od ? new Date(q.od) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const doDaty = q.do ? new Date(q.do) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);
    const rezerwacje = await this.prisma.extendedClient.wydarzeniePojazd.findMany({ where: { id_organizacji, id_pojazdu: id, aktywny: true, wydarzenie: { data_start: { lte: doDaty }, data_koniec: { gte: od } } }, include: { wydarzenie: true } });
    const informacyjne = [
      pojazd.data_przegladu ? { typ: 'przeglad', tytul: `Przegląd techniczny: ${pojazd.nazwa}`, start: pojazd.data_przegladu, editable: false } : null,
      pojazd.data_oc ? { typ: 'oc', tytul: `OC: ${pojazd.nazwa}`, start: pojazd.data_oc, editable: false } : null,
    ].filter(Boolean);
    return { od, do: doDaty, rezerwacje, informacyjne };
  }

  async reserve(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.wydarzeniePojazd.create({ data: { id_organizacji, id_pojazdu: Number(dto.id_pojazdu), id_wydarzenia: Number(dto.id_wydarzenia), rola_pojazdu: dto.rola_pojazdu || 'transport' } });
  }
}
