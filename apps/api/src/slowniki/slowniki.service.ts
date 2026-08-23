import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type StatusKind = 'wydarzenia' | 'magazynowe' | 'ksiegowe';

const statusConfig: Record<StatusKind, { delegate: string; defaultColor: string; defaultIcon: string; fallbackName: string }> = {
  wydarzenia: { delegate: 'statusWydarzenia', defaultColor: '#64748B', defaultIcon: '●', fallbackName: 'Nowy status wydarzenia' },
  magazynowe: { delegate: 'statusMagazynowy', defaultColor: '#F97316', defaultIcon: '📦', fallbackName: 'Nowy status magazynowy' },
  ksiegowe: { delegate: 'statusKsiegowy', defaultColor: '#22C55E', defaultIcon: '💰', fallbackName: 'Nowy status księgowy' },
};

@Injectable()
export class SlownikiService {
  constructor(private readonly prisma: PrismaService) {}

  async getTypyWydarzen(id_organizacji: number) {
    return this.prisma.extendedClient.typWydarzenia.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, kolor: true, kolejnosc: true },
      orderBy: { kolejnosc: 'asc' },
    });
  }

  async getStatusyWydarzenia(id_organizacji: number) {
    return this.listStatuses('wydarzenia', id_organizacji);
  }

  async getStatusyMagazynowe(id_organizacji: number) {
    return this.listStatuses('magazynowe', id_organizacji);
  }

  async getStatusyKsiegowe(id_organizacji: number) {
    return this.listStatuses('ksiegowe', id_organizacji);
  }

  private delegate(kind: StatusKind) {
    return (this.prisma.extendedClient as any)[statusConfig[kind].delegate];
  }

  async listStatuses(kind: StatusKind, id_organizacji: number) {
    // EVENTFLOW_PRODUCT_POLISH_V11:
    // Wszystkie statusy operacyjne mają teraz ikonę, kolor i kolejność.
    // Ikona statusu głównego wydarzenia jest wyświetlana przed nazwą wydarzenia w listach i kalendarzu.
    return this.delegate(kind).findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, kolor: true, ikona: true, kolejnosc: true, aktywny: true },
      orderBy: [{ kolejnosc: 'asc' }, { id: 'asc' }],
    });
  }

  async getStatusById(kind: StatusKind, id: number, id_organizacji: number) {
    const status = await this.delegate(kind).findFirst({ where: { id, id_organizacji, aktywny: true } });
    if (!status) throw new NotFoundException('Nie znaleziono statusu');
    return status;
  }

  async createStatus(kind: StatusKind, id_organizacji: number, dto: any) {
    const cfg = statusConfig[kind];
    const last = await this.delegate(kind).findFirst({
      where: { id_organizacji },
      orderBy: { kolejnosc: 'desc' },
      select: { kolejnosc: true },
    });
    return this.delegate(kind).create({
      data: {
        id_organizacji,
        nazwa: String(dto.nazwa || '').trim() || cfg.fallbackName,
        kolor: dto.kolor || cfg.defaultColor,
        ikona: dto.ikona || cfg.defaultIcon,
        kolejnosc: dto.kolejnosc !== undefined ? Number(dto.kolejnosc) : (last?.kolejnosc ?? 0) + 1,
      },
    });
  }

  async updateStatus(kind: StatusKind, id_organizacji: number, id: number, dto: any) {
    const cfg = statusConfig[kind];
    return this.delegate(kind).updateMany({
      where: { id, id_organizacji },
      data: {
        ...(dto.nazwa !== undefined ? { nazwa: String(dto.nazwa).trim() || cfg.fallbackName } : {}),
        ...(dto.kolor !== undefined ? { kolor: dto.kolor || cfg.defaultColor } : {}),
        ...(dto.ikona !== undefined ? { ikona: dto.ikona || cfg.defaultIcon } : {}),
        ...(dto.kolejnosc !== undefined ? { kolejnosc: Number(dto.kolejnosc) } : {}),
        ...(dto.aktywny !== undefined ? { aktywny: Boolean(dto.aktywny) } : {}),
      },
    });
  }

  async deleteStatus(kind: StatusKind, id_organizacji: number, id: number) {
    // Soft delete: nie kasujemy historii wydarzeń ani powiązań.
    return this.delegate(kind).updateMany({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  async reorderStatuses(kind: StatusKind, id_organizacji: number, dto: any) {
    const items = Array.isArray(dto?.items) ? dto.items : [];
    await this.prisma.extendedClient.$transaction(
      items.map((item: any) => this.delegate(kind).updateMany({
        where: { id: Number(item.id), id_organizacji },
        data: { kolejnosc: Number(item.kolejnosc) },
      })),
    );
    return this.listStatuses(kind, id_organizacji);
  }

  async getStatusyWynajmu(id_organizacji: number) {
    let statusy = await this.prisma.extendedClient.statusWynajmu.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, kolor: true, kolejnosc: true },
      orderBy: { kolejnosc: 'asc' },
    });
    if (statusy.length === 0) {
      await this.prisma.extendedClient.statusWynajmu.createMany({
        data: [
          { id_organizacji, nazwa: 'Nowe', kolor: '#06B6D4', kolejnosc: 1 },
          { id_organizacji, nazwa: 'Wydane', kolor: '#F97316', kolejnosc: 2 },
          { id_organizacji, nazwa: 'Zwrócone', kolor: '#22C55E', kolejnosc: 3 },
          { id_organizacji, nazwa: 'Problem', kolor: '#EF4444', kolejnosc: 4 },
        ],
      });
      statusy = await this.prisma.extendedClient.statusWynajmu.findMany({ where: { id_organizacji, aktywny: true }, select: { id: true, nazwa: true, kolor: true, kolejnosc: true }, orderBy: { kolejnosc: 'asc' } });
    }
    return statusy;
  }

  async getKontrahenci(id_organizacji: number) {
    return this.prisma.extendedClient.kontrahent.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, nazwa_skrocona: true, nip: true },
      orderBy: { nazwa: 'asc' },
    });
  }

  async getMiejsca(id_organizacji: number) {
    return this.prisma.extendedClient.miejsce.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, nazwa: true, ulica: true, kod_pocztowy: true, miasto: true, kraj: true },
      orderBy: { nazwa: 'asc' },
    });
  }

  async getUzytkownicy(id_organizacji: number) {
    return this.prisma.extendedClient.uzytkownik.findMany({
      where: { id_organizacji, aktywny: true },
      select: { id: true, imie: true, nazwisko: true, email: true },
      orderBy: { nazwisko: 'asc' },
    });
  }

  // EVENTFLOW_PRODUCT_POLISH_V9:
  // Typ wydarzenia jest konfigurowalny z UI ustawień.
  // Kolor typu jest źródłem prawdy dla koloru paska wydarzenia w kalendarzu.
  async getTypWydarzeniaById(id: number, id_organizacji: number) {
    const typ = await this.prisma.extendedClient.typWydarzenia.findFirst({ where: { id, id_organizacji, aktywny: true } });
    if (!typ) throw new NotFoundException('Nie znaleziono typu wydarzenia');
    return typ;
  }

  async createTypWydarzenia(id_organizacji: number, dto: any) {
    const last = await this.prisma.extendedClient.typWydarzenia.findFirst({
      where: { id_organizacji },
      orderBy: { kolejnosc: 'desc' },
      select: { kolejnosc: true },
    });

    return this.prisma.extendedClient.typWydarzenia.create({
      data: {
        id_organizacji,
        nazwa: String(dto.nazwa || '').trim() || 'Nowy typ wydarzenia',
        kolor: dto.kolor || '#0891B2',
        kolejnosc: dto.kolejnosc !== undefined ? Number(dto.kolejnosc) : (last?.kolejnosc ?? 0) + 1,
      },
    });
  }

  async updateTypWydarzenia(id_organizacji: number, id: number, dto: any) {
    return this.prisma.extendedClient.typWydarzenia.updateMany({
      where: { id, id_organizacji },
      data: {
        ...(dto.nazwa !== undefined ? { nazwa: String(dto.nazwa).trim() || 'Typ wydarzenia' } : {}),
        ...(dto.kolor !== undefined ? { kolor: dto.kolor || '#0891B2' } : {}),
        ...(dto.kolejnosc !== undefined ? { kolejnosc: Number(dto.kolejnosc) } : {}),
        ...(dto.aktywny !== undefined ? { aktywny: Boolean(dto.aktywny) } : {}),
      },
    });
  }

  async deleteTypWydarzenia(id_organizacji: number, id: number) {
    // Nie kasujemy fizycznie typu, bo wydarzenia mogą już do niego prowadzić.
    // Ukrywamy go z UI przez aktywny=false i zostawiamy historię relacji.
    return this.prisma.extendedClient.typWydarzenia.updateMany({
      where: { id, id_organizacji },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  async reorderTypyWydarzen(id_organizacji: number, dto: any) {
    const items = Array.isArray(dto?.items) ? dto.items : [];
    await this.prisma.extendedClient.$transaction(
      items.map((item: any) => this.prisma.extendedClient.typWydarzenia.updateMany({
        where: { id: Number(item.id), id_organizacji },
        data: { kolejnosc: Number(item.kolejnosc) },
      })),
    );
    return this.getTypyWydarzen(id_organizacji);
  }

  async getStatusyOfert(id_organizacji: number) {
    let statusy = await this.prisma.extendedClient.statusOferty.findMany({
      where: { id_organizacji, aktywny: true },
      orderBy: { kolejnosc: 'asc' }
    });
    
    // Auto-seed podstawowych statusów jeśli są puste
    if (statusy.length === 0) {
       await this.prisma.extendedClient.statusOferty.createMany({
         data: [
           { id_organizacji, nazwa: 'Robocza', kolor: '#64748B', kolejnosc: 1 },
           { id_organizacji, nazwa: 'Wysłana', kolor: '#3B82F6', kolejnosc: 2 },
           { id_organizacji, nazwa: 'Zaakceptowana', kolor: '#10B981', kolejnosc: 3 },
           { id_organizacji, nazwa: 'Odrzucona', kolor: '#EF4444', kolejnosc: 4 },
         ]
       });
       statusy = await this.prisma.extendedClient.statusOferty.findMany({
         where: { id_organizacji, aktywny: true },
         orderBy: { kolejnosc: 'asc' }
       });
    }
    
    return statusy;
  }
}
