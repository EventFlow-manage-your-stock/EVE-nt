import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PakietyService {
  constructor(private readonly prisma: PrismaService) {}

  // Pobieranie wszystkich aktywnych pakietów dla danej organizacji
  async findAll(id_organizacji: number) {
    return this.prisma.extendedClient.pakiet.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        _count: { select: { pozycje: true } },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  // Pobieranie szczegółów konkretnego pakietu
  async findOne(id: number, id_organizacji: number) {
    const pakiet = await this.prisma.extendedClient.pakiet.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        pozycje: {
          include: {
            model: { include: { kategoria: true } },
            egzemplarz: { include: { model: { include: { kategoria: true } } } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!pakiet) throw new NotFoundException('Nie znaleziono pakietu ofertowego.');
    return pakiet;
  }

  // Tworzenie nowego pakietu
  async create(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.pakiet.create({
      data: {
        id_organizacji,
        nazwa: String(dto.nazwa).trim() || 'Nowy pakiet',
        opis: dto.opis ? String(dto.opis).trim() : null,
      },
    });
  }

  // Aktualizacja podstawowych danych pakietu
  async update(id: number, dto: any, id_organizacji: number) {
    await this.findOne(id, id_organizacji); // Weryfikacja przynależności do tenanta

    return this.prisma.extendedClient.pakiet.update({
      where: { id },
      data: {
        nazwa: dto.nazwa !== undefined ? String(dto.nazwa).trim() : undefined,
        opis: dto.opis !== undefined ? String(dto.opis).trim() : undefined,
        aktywny: dto.aktywny !== undefined ? Boolean(dto.aktywny) : undefined,
      },
    });
  }

  // Bezpieczne, miękkie usuwanie pakietu (Soft Delete)
  async remove(id: number, id_organizacji: number) {
    await this.findOne(id, id_organizacji);

    return this.prisma.extendedClient.pakiet.update({
      where: { id },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  // ====================================================================
  // ZARZĄDZANIE WNĘTRZEM PAKIETU (Szablonowe pozycje)
  // ====================================================================

  async addPozycja(id_pakietu: number, dto: any, id_organizacji: number) {
    await this.findOne(id_pakietu, id_organizacji); // Weryfikacja pakietu

    return this.prisma.extendedClient.pozycjaPakietu.create({
      data: {
        id_pakietu,
        id_modelu: dto.id_modelu ? Number(dto.id_modelu) : null,
        id_egzemplarza: dto.id_egzemplarza ? Number(dto.id_egzemplarza) : null,
        ilosc: Number(dto.ilosc || 1),
      },
    });
  }

  async updatePozycja(id_pozycji: number, dto: any, id_organizacji: number) {
    // SECURITY: Sprawdzamy czy pozycja należy do pakietu naszej organizacji
    const pozycja = await this.prisma.extendedClient.pozycjaPakietu.findFirst({
      where: { 
        id: id_pozycji, 
        pakiet: { id_organizacji } 
      },
    });

    if (!pozycja) throw new NotFoundException('Nie znaleziono pozycji w pakiecie.');

    return this.prisma.extendedClient.pozycjaPakietu.update({
      where: { id: id_pozycji },
      data: {
        ilosc: Number(dto.ilosc || 1),
      },
    });
  }

  async removePozycja(id_pozycji: number, id_organizacji: number) {
    // SECURITY: Weryfikacja własności relacyjnej przed hard deletem
    const pozycja = await this.prisma.extendedClient.pozycjaPakietu.findFirst({
      where: { 
        id: id_pozycji, 
        pakiet: { id_organizacji } 
      },
    });

    if (!pozycja) throw new NotFoundException('Nie znaleziono pozycji do usunięcia.');

    return this.prisma.extendedClient.pozycjaPakietu.delete({
      where: { id: id_pozycji },
    });
  }
}