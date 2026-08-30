import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MagazynService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private cleanNumber(val: any): number | null {
    if (val === '' || val === null || val === undefined) return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
  }

  private cleanString(val: any): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
  }

  private cleanDate(val: any): Date | null {
    if (!val || val === '') return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  private cleanBoolean(val: any): boolean {
    return val === true || val === 'true' || val === 1 || val === '1';
  }

  // --- LOGIKA KLASYFIKACJI SPRZĘTU (Reguły 1-6) ---

  private isSprzetIlosciowy(modelOrRow: any): boolean {
    if (!modelOrRow) return false;
    const mode = String(modelOrRow?.tryb_ewidencji || modelOrRow?.typ_sprzetu || '').toLowerCase();
    return (
      modelOrRow?.sprzet_ilosciowy === true ||
      modelOrRow?.czy_ilosciowy === true ||
      mode.includes('ilosciow') ||
      mode.includes('ilościow')
    );
  }

  private isZestaw(modelOrRow: any): boolean {
    if (!modelOrRow) return false;
    const model = modelOrRow.model || modelOrRow;
    const type = String(model.typ_sprzetu || '').toLowerCase();
    const name = String(model.nazwa || '').toLowerCase();
    return type === 'zestaw' || type === 'rack' || name.includes('zestaw') || name.includes('rack');
  }

  private isOpakowanie(modelOrRow: any): boolean {
    if (!modelOrRow) return false;
    if (this.isZestaw(modelOrRow)) return false; // Priorytet: zestaw nie jest opakowaniem
    const model = modelOrRow.model || modelOrRow;
    const type = String(model.typ_sprzetu || '').toLowerCase();
    return type === 'opakowanie' || type === 'case';
  }

  private getEquipmentCode(egzemplarz: any): string {
    if (!egzemplarz) return '';
    return egzemplarz.kod_kreskowy || egzemplarz.zewnetrzny_kod_kreskowy || egzemplarz.zewnetrzny_qr_kod || egzemplarz.qr_kod || egzemplarz.sn || '';
  }

  private normalizeKodKreskowyModelu(dto: any, ilosciowy: boolean): string | null {
    if (!ilosciowy) return null;
    const code = this.cleanString(dto?.kod_kreskowy || dto?.kod_modelu || dto?.sku);
    if (!code) {
      throw new BadRequestException('Sprzęt ilościowy musi mieć kod kreskowy modelu. Ten kod jest skanowany przy WZ/PZ i wtedy system pyta o liczbę sztuk.');
    }
    return code;
  }

  private normalizeTags(tagsInput: any): string[] {
    if (!tagsInput) return [];
    if (Array.isArray(tagsInput)) {
      return Array.from(new Set(tagsInput.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)));
    }
    if (typeof tagsInput === 'string') {
      return Array.from(new Set(tagsInput.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)));
    }
    return [];
  }

  private caseScanMeta(caseRow: any) {
    if (!caseRow) return null;
    return {
      id: this.cleanNumber(caseRow.id),
      nazwa: this.cleanString(caseRow.nazwa || caseRow.model?.nazwa) || 'Case',
      kod: this.cleanString(caseRow.kod_kreskowy || caseRow.zewnetrzny_kod_kreskowy || caseRow.zewnetrzny_qr_kod || caseRow.qr_kod || caseRow.sn),
    };
  }

  private caseScanMarkerFromPosition(p: any): string | null {
    const raw = String(p?.uwagi || '');
    if (raw.includes('__EVENTFLOW_CASE_SCAN:') || raw.includes('Zeskanowano case')) return null;
    const meta = p?.system_case_scan || p?.case_scan || {};
    const id = this.cleanNumber(meta.id ?? p?.id_zeskanowanego_case ?? p?.id_case_zeskanowany ?? p?.source_case_id);
    const name = this.cleanString(meta.nazwa ?? meta.name ?? p?.nazwa_zeskanowanego_case ?? p?.source_case_name);
    if (!id && !name) return null;
    const safeName = String(name || 'case').replace(/[|]/g, '/').replace(/__/g, '').slice(0, 120);
    return `__EVENTFLOW_CASE_SCAN:${id || 'unknown'}:${safeName}__`;
  }

  private buildDocumentUwagi(p: any): string | null {
    const userUwagi = this.cleanString(p?.uwagi);
    const marker = this.caseScanMarkerFromPosition(p);
    return [userUwagi, marker].filter(Boolean).join(' | ') || null;
  }

  private nextDocumentNumber(prefix: string) {
    const now = new Date();
    return `${prefix}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now().toString().slice(-6)}`;
  }

  // --- WALIDACJA RUCHU SPRZĘTU (ZABEZPIECZENIA OPERACYJNE) ---

  private async validateInstanceMovement(
    tx: any,
    idEgzemplarza: number,
    name: string,
    typ: string,
    idWydarzenia: number | null,
    idOrganizacji: number,
  ): Promise<{ crossEventNote?: string }> {
    const allHistory = await tx.pozycjaWydaniaMagazynowego.findMany({
      where: {
        id_organizacji: idOrganizacji,
        id_egzemplarza: idEgzemplarza,
        aktywny: true,
        wydanie: { aktywny: true },
      },
      select: {
        ilosc: true,
        wydanie: { select: { typ: true, id_wydarzenia: true, numer: true, wydarzenie: { select: { nazwa: true } } } },
      },
      orderBy: { data_utworzenia: 'desc' },
    });

    let globalWydane = 0;
    let globalPrzyjete = 0;
    let eventWydane = 0;
    let eventPrzyjete = 0;
    let lastIssuingEventName: string | null = null;

    for (const h of allHistory) {
      if (h.wydanie.typ === 'wydanie') {
        globalWydane += Number(h.ilosc || 1);
        if (!lastIssuingEventName && h.wydanie.wydarzenie?.nazwa) {
          lastIssuingEventName = h.wydanie.wydarzenie.nazwa;
        }
        if (idWydarzenia && h.wydanie.id_wydarzenia === idWydarzenia) eventWydane += Number(h.ilosc || 1);
      }
      if (h.wydanie.typ === 'przyjecie') {
        globalPrzyjete += Number(h.ilosc || 1);
        if (idWydarzenia && h.wydanie.id_wydarzenia === idWydarzenia) eventPrzyjete += Number(h.ilosc || 1);
      }
    }

    // Zabezpieczenie przed podwójnym wydaniem (WZ)
    if (typ === 'wydanie') {
      if (idWydarzenia && eventWydane > eventPrzyjete) {
        throw new BadRequestException(`Egzemplarz "${name}" (ID #${idEgzemplarza}) został już wydany na to wydarzenie.`);
      }
      if (globalWydane > globalPrzyjete) {
        throw new BadRequestException(`Egzemplarz "${name}" (ID #${idEgzemplarza}) jest aktualnie wydany w teren (poza magazynem) i nie może zostać wydany ponownie.`);
      }
    }

    // Inteligentne przyjęcie (PZ)
    if (typ === 'przyjecie') {
      if (globalWydane <= globalPrzyjete) {
        throw new BadRequestException(`Egzemplarz "${name}" (ID #${idEgzemplarza}) znajduje się już na magazynie.`);
      }
      if (idWydarzenia && (eventWydane === 0 || eventWydane <= eventPrzyjete)) {
        const fromWhere = lastIssuingEventName ? `wydarzenia "${lastIssuingEventName}"` : `innego zlecenia`;
        return { crossEventNote: `Przyjęto ze zwrotu z ${fromWhere}` };
      }
    }

    return {};
  }

  // --- CRUD STRUKTURY MAGAZYNÓW (MULTI-WAREHOUSE) ---

  async getMagazyny(id_organizacji: number) {
    return this.prisma.extendedClient.magazyn.findMany({
      where: { id_organizacji, aktywny: true },
      orderBy: [{ domyslny: 'desc' }, { nazwa: 'asc' }],
    });
  }

  async getMagazynyFull(id_organizacji: number) {
    return this.prisma.extendedClient.magazyn.findMany({
      where: { id_organizacji, aktywny: true },
      include: {
        _count: {
          select: { egzemplarze: { where: { aktywny: true } } },
        },
      },
      orderBy: [{ domyslny: 'desc' }, { nazwa: 'asc' }],
    });
  }

  async getMagazynById(id: number, id_organizacji: number) {
    const mag = await this.prisma.extendedClient.magazyn.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        egzemplarze: {
          where: { aktywny: true },
          include: { model: { include: { kategoria: true } } },
        },
      },
    });
    if (!mag) throw new NotFoundException('Nie znaleziono magazynu');
    return mag;
  }

  async createMagazyn(dto: any, id_organizacji: number) {
    if (!dto.nazwa || !dto.nazwa.trim()) throw new BadRequestException('Nazwa magazynu jest wymagana');
    if (dto.domyslny) {
      await this.prisma.extendedClient.magazyn.updateMany({
        where: { id_organizacji },
        data: { domyslny: false },
      });
    }
    return this.prisma.extendedClient.magazyn.create({
      data: {
        id_organizacji,
        nazwa: this.cleanString(dto.nazwa)!,
        kod: this.cleanString(dto.kod),
        adres: this.cleanString(dto.adres),
        miasto: this.cleanString(dto.miasto),
        kod_pocztowy: this.cleanString(dto.kod_pocztowy),
        opis: this.cleanString(dto.opis),
        domyslny: Boolean(dto.domyslny),
      },
    });
  }

  async updateMagazyn(id: number, dto: any, id_organizacji: number) {
    await this.getMagazynById(id, id_organizacji);
    if (dto.domyslny) {
      await this.prisma.extendedClient.magazyn.updateMany({
        where: { id_organizacji, id: { not: id } },
        data: { domyslny: false },
      });
    }
    return this.prisma.extendedClient.magazyn.update({
      where: { id },
      data: {
        nazwa: this.cleanString(dto.nazwa),
        kod: this.cleanString(dto.kod),
        adres: this.cleanString(dto.adres),
        miasto: this.cleanString(dto.miasto),
        kod_pocztowy: this.cleanString(dto.kod_pocztowy),
        opis: this.cleanString(dto.opis),
        domyslny: dto.domyslny !== undefined ? Boolean(dto.domyslny) : undefined,
      },
    });
  }

  async deleteMagazyn(id: number, id_organizacji: number) {
    const mag = await this.getMagazynById(id, id_organizacji);
    if (mag.egzemplarze.length > 0) {
      throw new BadRequestException(`Nie można usunąć magazynu "${mag.nazwa}", ponieważ przypisanych jest do niego ${mag.egzemplarze.length} egzemplarzy sprzętu. Przenieś sprzęt przed usunięciem.`);
    }
    return this.prisma.extendedClient.magazyn.update({
      where: { id },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  // --- KATEGORIE SPRZĘTU ---

  async getKategorie(id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.findMany({
      where: { id_organizacji, id_rodzica: null, aktywny: true },
      include: {
        dzieci: {
          where: { aktywny: true },
          orderBy: { kolejnosc: 'asc' },
        },
      },
      orderBy: { kolejnosc: 'asc' },
    });
  }

  async getKategoriePlasko(id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.findMany({
      where: { id_organizacji, aktywny: true },
      orderBy: [{ kolejnosc: 'asc' }, { nazwa: 'asc' }],
    });
  }

  async getKategoriaById(id: number, id_organizacji: number) {
    const kategoria = await this.prisma.extendedClient.kategoria.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: { rodzic: true, dzieci: { where: { aktywny: true }, orderBy: { kolejnosc: 'asc' } } },
    });
    if (!kategoria) throw new NotFoundException('Nie znaleziono kategorii');
    return kategoria;
  }

  async createKategoria(dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.create({
      data: {
        id_organizacji,
        nazwa: this.cleanString(dto.nazwa) || 'Nowa kategoria',
        opis: this.cleanString(dto.opis),
        kolor: this.cleanString(dto.kolor) || '#06B6D4',
        id_rodzica: this.cleanNumber(dto.id_rodzica),
        kolejnosc: this.cleanNumber(dto.kolejnosc) || 0,
      },
    });
  }

  async updateKategoria(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.update({
      where: { id },
      data: {
        nazwa: this.cleanString(dto.nazwa),
        opis: this.cleanString(dto.opis),
        kolor: this.cleanString(dto.kolor),
        id_rodzica: this.cleanNumber(dto.id_rodzica),
        kolejnosc: this.cleanNumber(dto.kolejnosc) || 0,
        aktywny: dto.aktywny ?? true,
      },
    });
  }

  async deleteKategoria(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.update({
      where: { id },
      data: { aktywny: false, data_usuniecia: new Date() },
    });
  }

  // --- MODELE SPRZĘTU ---

  async getModeleSprzetu(id_organizacji: number, filters: any = {}) {
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 1000;
    const skip = (page - 1) * limit;
    const where: any = { id_organizacji, aktywny: true };

    if (filters.kategoriaId) where.id_kategorii = Number(filters.kategoriaId);
    if (filters.search) {
      where.OR = [
        { nazwa: { contains: filters.search, mode: 'insensitive' } },
        { producent: { contains: filters.search, mode: 'insensitive' } },
        { kod_kreskowy: { contains: filters.search, mode: 'insensitive' } },
        { tagi: { has: filters.search.trim().toLowerCase() } },
      ];
    }
    if (filters.widocznyWMag) where.widoczny_w_mag = filters.widocznyWMag === 'TAK';
    if (filters.widocznyWOfercie) where.widoczny_w_ofercie = filters.widocznyWOfercie === 'TAK';

    const modele = await this.prisma.extendedClient.modelSprzetu.findMany({
      where,
      skip,
      take: limit,
      include: {
        kategoria: true,
        stawki: {
          where: { aktywny: true, nazwa_stawki: 'Podstawowa (PLN)' },
          take: 1,
        },
        egzemplarze: {
          where: { aktywny: true },
          select: { id_statusu_egzemplarza: true, status_serwisowy: true },
        },
      },
      orderBy: { nazwa: 'asc' },
    });

    return modele.map((model: any) => {
      const ilosciowy = model.tryb_ewidencji === 'ilosciowe' || model.typ_sprzetu === 'ilosciowe';
      const totalStanie = ilosciowy ? Number(model.ilosc_magazynowa || 0) : model.egzemplarze.length;
      const wMagazynie = ilosciowy
        ? Number(model.ilosc_magazynowa || 0)
        : model.egzemplarze.filter((e: any) => e.status_serwisowy === 'Działa' || e.status_serwisowy === 'Naprawiony').length;
      const wSerwisie = ilosciowy
        ? 0
        : model.egzemplarze.filter((e: any) => e.status_serwisowy?.includes('Wymaga') || e.status_serwisowy === 'W serwisie').length;
      const naEventach = totalStanie - wMagazynie - wSerwisie;

      return {
        id: model.id,
        nazwa: model.nazwa,
        producent: model.producent,
        tagi: model.tagi || [],
        typ_sprzetu: model.typ_sprzetu,
        tryb_ewidencji: model.tryb_ewidencji,
        sprzet_ilosciowy: ilosciowy,
        ilosc_magazynowa: model.ilosc_magazynowa,
        jednostka: model.jednostka,
        kategoria_nazwa: model.kategoria?.nazwa || '-',
        kategoria: model.kategoria,
        kod_kreskowy: ilosciowy ? model.kod_kreskowy : null,
        ulubiony: model.ulubiony,
        udostepniony_crn: model.udostepniony_crn,
        widoczny_w_mag: model.widoczny_w_mag,
        widoczny_w_ofercie: model.widoczny_w_ofercie,
        cena_podstawowa: model.stawki?.[0]?.cena_netto || 0,
        uwagi: model.notatki_wewnetrzne,
        zdjecie: model.zdjecie,
        _count: { egzemplarze: totalStanie },
        stan: {
          total: totalStanie,
          magazyn: wMagazynie,
          eventy: naEventach > 0 ? naEventach : 0,
          serwis: wSerwisie,
          rack: 0,
        },
        dostepnych: wMagazynie,
      };
    });
  }

  async createModelSprzetu(dto: any, id_organizacji: number) {
    const ilosciowy = this.isSprzetIlosciowy(dto);
    return this.prisma.extendedClient.modelSprzetu.create({
      data: {
        id_organizacji,
        nazwa: this.cleanString(dto.nazwa)!,
        producent: this.cleanString(dto.producent),
        tagi: this.normalizeTags(dto.tagi),
        typ_sprzetu: this.cleanString(dto.typ_sprzetu) || 'sprzet',
        tryb_ewidencji: ilosciowy ? 'ilosciowe' : 'egzemplarze',
        ilosc_magazynowa: ilosciowy ? (this.cleanNumber(dto.ilosc_magazynowa) ?? 0) : 0,
        jednostka: this.cleanString(dto.jednostka) || 'szt.',
        id_kategorii: this.cleanNumber(dto.id_kategorii),
        kod_kreskowy: this.normalizeKodKreskowyModelu(dto, ilosciowy),
        notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne),
        szerokosc: this.cleanNumber(dto.szerokosc),
        wysokosc: this.cleanNumber(dto.wysokosc),
        glebokosc: this.cleanNumber(dto.glebokosc),
        waga: this.cleanNumber(dto.waga),
        objetosc: this.cleanNumber(dto.objetosc),
        pobor_pradu: this.cleanNumber(dto.pobor_pradu),
        wartosc: this.cleanNumber(dto.wartosc_domyslna_egzemplarza) ?? this.cleanNumber(dto.wartosc),
        wartosc_domyslna_egzemplarza: this.cleanNumber(dto.wartosc_domyslna_egzemplarza) ?? this.cleanNumber(dto.wartosc),
        miejsce_w_mag: this.cleanString(dto.miejsce_w_mag),
        zdjecie: this.cleanString(dto.zdjecie),
        widoczny_w_ofercie: true,
        widoczny_w_mag: true,
      },
    });
  }

  async getModelById(id: number, id_organizacji: number) {
    const model = await this.prisma.extendedClient.modelSprzetu.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        kategoria: true,
        stawki: { where: { aktywny: true }, orderBy: { id: 'asc' } },
        egzemplarze: {
          where: { aktywny: true },
          orderBy: { id: 'asc' },
          include: {
            magazyn: true,
            case: { select: { id: true, nazwa: true, numer_urzadzenia: true, model: { select: { nazwa: true } } } },
            _count: { select: { zawartosc_case: { where: { aktywny: true } } } },
          },
        },
      },
    });

    if (!model) throw new NotFoundException('Nie znaleziono modelu');

    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'ModelSprzetu', id_obiektu: id, aktywny: true },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });

    return { ...model, zalaczniki };
  }

  async updateModel(id: number, dto: any, id_organizacji: number) {
    const ilosciowy = this.isSprzetIlosciowy(dto);
    return this.prisma.extendedClient.modelSprzetu.update({
      where: { id },
      data: {
        nazwa: this.cleanString(dto.nazwa)!,
        producent: this.cleanString(dto.producent),
        tagi: dto.tagi !== undefined ? this.normalizeTags(dto.tagi) : undefined,
        typ_sprzetu: this.cleanString(dto.typ_sprzetu),
        tryb_ewidencji: ilosciowy ? 'ilosciowe' : 'egzemplarze',
        ilosc_magazynowa: ilosciowy ? (this.cleanNumber(dto.ilosc_magazynowa) ?? 0) : 0,
        jednostka: this.cleanString(dto.jednostka) || 'szt.',
        id_kategorii: this.cleanNumber(dto.id_kategorii),
        szerokosc: this.cleanNumber(dto.szerokosc),
        wysokosc: this.cleanNumber(dto.wysokosc),
        glebokosc: this.cleanNumber(dto.glebokosc),
        waga: this.cleanNumber(dto.waga),
        objetosc: this.cleanNumber(dto.objetosc),
        pobor_pradu: this.cleanNumber(dto.pobor_pradu),
        wartosc: this.cleanNumber(dto.wartosc_domyslna_egzemplarza) ?? this.cleanNumber(dto.wartosc),
        wartosc_domyslna_egzemplarza: this.cleanNumber(dto.wartosc_domyslna_egzemplarza) ?? this.cleanNumber(dto.wartosc),
        miejsce_w_mag: this.cleanString(dto.miejsce_w_mag),
        zdjecie: this.cleanString(dto.zdjecie),
        kod_kreskowy: this.normalizeKodKreskowyModelu(dto, ilosciowy),
        notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne),
      },
    });
  }

  async usunModelSoft(id: number, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const model = await tx.modelSprzetu.update({
        where: { id },
        data: { aktywny: false, data_usuniecia: new Date() },
      });
      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: safeUserId,
          typ_obiektu: 'ModelSprzetu',
          id_obiektu: id,
          akcja: 'USUNIECIE',
        },
      });
      return model;
    });
  }

  // --- OBSŁUGA ZAŁĄCZNIKÓW S3 / MINIO DLA MODELI ---

  async addZalacznik(id_modelu: number, dto: any, file: Express.Multer.File, id_organizacji: number, id_uzytkownika: number) {
    const objectKey = await this.storage.uploadFile(file, id_organizacji, 'modele_zalaczniki');
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji,
        typ_obiektu: 'ModelSprzetu',
        id_obiektu: id_modelu,
        nazwa: dto.nazwa || file.originalname,
        nazwa_pliku: file.originalname,
        rozmiar_bajtow: file.size,
        mime: file.mimetype,
        sciezka: objectKey,
        id_uzytkownika_dodal: id_uzytkownika,
      },
    });
  }

  async addZalacznikWithS3(id_modelu: number, dto: any, file: Express.Multer.File, id_organizacji: number, id_uzytkownika: number) {
    return this.addZalacznik(id_modelu, dto, file, id_organizacji, id_uzytkownika);
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

  async getDownloadUrl(id_zalacznika: number, id_organizacji: number) {
    const zalacznik = await this.prisma.extendedClient.zalacznik.findFirst({
      where: { id: id_zalacznika, id_organizacji, aktywny: true },
    });
    if (!zalacznik || !zalacznik.sciezka) {
      throw new NotFoundException('Załącznik nie istnieje lub brakuje pliku fizycznego.');
    }
    const url = await this.storage.getPresignedDownloadUrl(zalacznik.sciezka);
    return { url };
  }

  // --- EGZEMPLARZE FIZYCZNE ---

  async createEgzemplarz(id_modelu: number, dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const egzemplarz = await tx.egzemplarz.create({
        data: {
          id_organizacji,
          id_modelu,
          nazwa: this.cleanString(dto.nazwa),
          numer_urzadzenia: this.cleanString(dto.numer_urzadzenia || dto.numer_egzemplarza),
          numer_egzemplarza: this.cleanString(dto.numer_egzemplarza || dto.numer_urzadzenia),
          sn: this.cleanString(dto.sn),
          data_produkcji: this.cleanDate(dto.data_produkcji),
          id_magazynu: this.cleanNumber(dto.id_magazynu),
          miejsce_w_mag: this.cleanString(dto.miejsce_w_mag),
          opis: this.cleanString(dto.opis),
          pakowany_pojedynczo: false,
          cena_zakupu: this.cleanNumber(dto.cena_zakupu),
          id_case: this.cleanNumber(dto.id_case),
          status_serwisowy: this.cleanString(dto.status_serwisowy) || 'Działa',
          kod_kreskowy: this.cleanString(dto.kod_kreskowy || dto.zewnetrzny_kod_kreskowy) || `SN-${Date.now()}`,
          zewnetrzny_kod_kreskowy: this.cleanString(dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          zewnetrzny_qr_kod: this.cleanString(dto.zewnetrzny_qr_kod || dto.qr_kod || dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          rozroznij_kod_qr: this.cleanBoolean(dto.rozroznij_kod_qr),
          szerokosc: this.cleanNumber(dto.szerokosc),
          wysokosc: this.cleanNumber(dto.wysokosc),
          glebokosc: this.cleanNumber(dto.glebokosc),
          waga: this.cleanNumber(dto.waga),
          objetosc: this.cleanNumber(dto.objetosc),
          wartosc: this.cleanNumber(dto.wartosc),
          qr_kod: this.cleanString(dto.qr_kod || dto.zewnetrzny_qr_kod || dto.zewnetrzny_kod_kreskowy),
          notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne),
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: safeUserId,
          typ_obiektu: 'Egzemplarz',
          id_obiektu: egzemplarz.id,
          akcja: 'UTWORZENIE',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      if (dto.tworz_zgloszenie && dto.tytul_usterki && dto.id_statusu_serwisu && safeUserId) {
        await tx.serwisSprzetu.create({
          data: {
            id_organizacji,
            id_egzemplarza: egzemplarz.id,
            id_statusu_serwisu: this.cleanNumber(dto.id_statusu_serwisu)!,
            id_uzytkownika_zglosil: safeUserId,
            tytul: this.cleanString(dto.tytul_usterki)!,
            opis: this.cleanString(dto.opis_usterki),
          },
        });
      }

      return egzemplarz;
    });
  }

  async updateEgzemplarz(id: number, dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const egzemplarz = await tx.egzemplarz.update({
        where: { id },
        data: {
          nazwa: this.cleanString(dto.nazwa),
          numer_urzadzenia: this.cleanString(dto.numer_urzadzenia || dto.numer_egzemplarza),
          numer_egzemplarza: this.cleanString(dto.numer_egzemplarza || dto.numer_urzadzenia),
          sn: this.cleanString(dto.sn),
          data_produkcji: this.cleanDate(dto.data_produkcji),
          id_magazynu: this.cleanNumber(dto.id_magazynu),
          miejsce_w_mag: this.cleanString(dto.miejsce_w_mag),
          opis: this.cleanString(dto.opis),
          pakowany_pojedynczo: false,
          cena_zakupu: this.cleanNumber(dto.cena_zakupu),
          id_case: this.cleanNumber(dto.id_case),
          status_serwisowy: this.cleanString(dto.status_serwisowy) || 'Działa',
          kod_kreskowy: this.cleanString(dto.kod_kreskowy || dto.zewnetrzny_kod_kreskowy),
          zewnetrzny_kod_kreskowy: this.cleanString(dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          zewnetrzny_qr_kod: this.cleanString(dto.zewnetrzny_qr_kod || dto.qr_kod || dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          rozroznij_kod_qr: this.cleanBoolean(dto.rozroznij_kod_qr),
          szerokosc: this.cleanNumber(dto.szerokosc),
          wysokosc: this.cleanNumber(dto.wysokosc),
          glebokosc: this.cleanNumber(dto.glebokosc),
          waga: this.cleanNumber(dto.waga),
          objetosc: this.cleanNumber(dto.objetosc),
          wartosc: this.cleanNumber(dto.wartosc),
          qr_kod: this.cleanString(dto.qr_kod || dto.zewnetrzny_qr_kod || dto.zewnetrzny_kod_kreskowy),
          notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne),
        },
      });

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: safeUserId,
          typ_obiektu: 'Egzemplarz',
          id_obiektu: id,
          akcja: 'EDYCJA',
          nowa_wartosc: JSON.stringify(dto),
        },
      });

      if (dto.tworz_zgloszenie && dto.tytul_usterki && dto.id_statusu_serwisu && safeUserId) {
        await tx.serwisSprzetu.create({
          data: {
            id_organizacji,
            id_egzemplarza: egzemplarz.id,
            id_statusu_serwisu: this.cleanNumber(dto.id_statusu_serwisu)!,
            id_uzytkownika_zglosil: safeUserId,
            tytul: this.cleanString(dto.tytul_usterki)!,
            opis: this.cleanString(dto.opis_usterki),
          },
        });
      }

      return egzemplarz;
    });
  }

  async deleteEgzemplarz(id: number, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const egzemplarz = await tx.egzemplarz.update({
        where: { id },
        data: { aktywny: false },
      });
      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: safeUserId,
          typ_obiektu: 'Egzemplarz',
          id_obiektu: id,
          akcja: 'USUNIECIE',
        },
      });
      return egzemplarz;
    });
  }

  async getWszystkieEgzemplarze(id_organizacji: number, filters: any = {}) {
    const where: any = { id_organizacji, aktywny: true };

    if (filters.searchItem) {
      where.OR = [
        { nazwa: { contains: filters.searchItem, mode: 'insensitive' } },
        { sn: { contains: filters.searchItem, mode: 'insensitive' } },
        { kod_kreskowy: { contains: filters.searchItem, mode: 'insensitive' } },
        { numer_urzadzenia: { contains: filters.searchItem, mode: 'insensitive' } },
        { numer_egzemplarza: { contains: filters.searchItem, mode: 'insensitive' } },
        { zewnetrzny_kod_kreskowy: { contains: filters.searchItem, mode: 'insensitive' } },
        { zewnetrzny_qr_kod: { contains: filters.searchItem, mode: 'insensitive' } },
      ];
    }
    if (filters.searchModel) {
      where.model = { nazwa: { contains: filters.searchModel, mode: 'insensitive' } };
    }
    if (filters.searchCategory) {
      where.model = {
        ...where.model,
        kategoria: { nazwa: { contains: filters.searchCategory, mode: 'insensitive' } },
      };
    }

    return this.prisma.extendedClient.egzemplarz.findMany({
      where,
      include: {
        model: {
          include: { kategoria: true },
        },
        magazyn: true,
      },
      orderBy: { data_utworzenia: 'desc' },
    });
  }

  async getFizyczneCase(id_organizacji: number) {
    return this.prisma.extendedClient.egzemplarz.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        model: { typ_sprzetu: { in: ['opakowanie', 'rack', 'zestaw'] } },
      },
      include: {
        model: { select: { nazwa: true } },
        _count: { select: { zawartosc_case: { where: { aktywny: true } } } },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  async getEgzemplarzById(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.egzemplarz.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        model: { include: { kategoria: true } },
        magazyn: true,
        case: { select: { id: true, nazwa: true, numer_urzadzenia: true } },
        zawartosc_case: {
          where: { aktywny: true },
          include: { model: true, magazyn: true },
          orderBy: { nazwa: 'asc' },
        },
        serwisy: {
          include: { status: true, zglosil: true, rozwiazal: true },
          orderBy: { data_zgloszenia: 'desc' },
        },
        pozycje_wydan: {
          where: { aktywny: true, wydanie: { aktywny: true, id_wydarzenia: { not: null } } },
          include: {
            wydanie: {
              include: {
                wydarzenie: {
                  include: { status: true, typ: true, kontrahent: true },
                },
              },
            },
          },
          orderBy: { data_utworzenia: 'desc' },
        },
      },
    });
  }

  async getDostepneDoCase(id_organizacji: number, id_case: number) {
    return this.prisma.extendedClient.egzemplarz.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        id_case: null,
        id: { not: id_case },
        model: { typ_sprzetu: 'sprzet' },
      },
      include: { model: true },
      orderBy: { nazwa: 'asc' },
    });
  }

  async modyfikujZawartoscCase(id_case: number, itemIds: number[], akcja: 'add' | 'remove', id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const skrzynia = await tx.egzemplarz.findFirst({
        where: { id: id_case, id_organizacji, aktywny: true },
      });
      if (!skrzynia) throw new NotFoundException('Nie znaleziono skrzyni');

      await tx.egzemplarz.updateMany({
        where: { id: { in: itemIds }, id_organizacji },
        data: { id_case: akcja === 'add' ? id_case : null },
      });

      for (const itemId of itemIds) {
        await tx.logZmian.create({
          data: {
            id_organizacji,
            id_uzytkownika: safeUserId,
            typ_obiektu: 'Egzemplarz',
            id_obiektu: itemId,
            akcja: akcja === 'add' ? 'ZAPAKOWANIE_DO_CASE' : 'WYJECIE_Z_CASE',
            nowa_wartosc: JSON.stringify({ id_case: akcja === 'add' ? id_case : null }),
          },
        });
      }
      return { success: true, updatedCount: itemIds.length };
    });
  }

  async getListaOpakowan(id_organizacji: number) {
    return this.prisma.extendedClient.egzemplarz.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        model: { typ_sprzetu: { in: ['opakowanie', 'rack', 'zestaw'] } },
      },
      include: {
        model: {
          include: { kategoria: true },
        },
        magazyn: true,
        zawartosc_case: {
          where: { aktywny: true },
          include: {
            model: true,
            magazyn: true,
          },
          orderBy: { nazwa: 'asc' },
        },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  async getOpakowanieById(id: number, id_organizacji: number) {
    const opakowanie = await this.prisma.extendedClient.egzemplarz.findFirst({
      where: { id, id_organizacji, aktywny: true, model: { typ_sprzetu: { in: ['opakowanie', 'rack', 'zestaw'] } } },
      include: {
        model: { include: { kategoria: true } },
        magazyn: true,
        zawartosc_case: { where: { aktywny: true }, include: { model: true, magazyn: true }, orderBy: { nazwa: 'asc' } },
      },
    });
    if (!opakowanie) throw new NotFoundException('Nie znaleziono opakowania');
    return opakowanie;
  }

  async createOpakowanie(dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    const nazwa = this.cleanString(dto.nazwa) || 'Nowe opakowanie';

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const model = dto.id_modelu
        ? await tx.modelSprzetu.findFirst({ where: { id: Number(dto.id_modelu), id_organizacji, aktywny: true } })
        : await tx.modelSprzetu.create({
            data: {
              id_organizacji,
              nazwa: this.cleanString(dto.nazwa_modelu) || nazwa,
              typ_sprzetu: this.cleanString(dto.typ_sprzetu) || 'opakowanie',
              id_kategorii: this.cleanNumber(dto.id_kategorii),
              widoczny_w_mag: true,
              widoczny_w_ofercie: false,
              wartosc: this.cleanNumber(dto.wartosc),
              wartosc_domyslna_egzemplarza: this.cleanNumber(dto.wartosc),
              notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne),
            },
          });

      if (!model) throw new NotFoundException('Nie znaleziono modelu opakowania');

      const egzemplarz = await tx.egzemplarz.create({
        data: {
          id_organizacji,
          id_modelu: model.id,
          nazwa,
          numer_urzadzenia: this.cleanString(dto.numer_egzemplarza || dto.numer_urzadzenia) || '1',
          numer_egzemplarza: this.cleanString(dto.numer_egzemplarza || dto.numer_urzadzenia) || '1',
          id_magazynu: this.cleanNumber(dto.id_magazynu),
          kod_kreskowy: this.cleanString(dto.kod_kreskowy || dto.zewnetrzny_kod_kreskowy) || `CASE-${Date.now()}`,
          zewnetrzny_kod_kreskowy: this.cleanString(dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          zewnetrzny_qr_kod: this.cleanString(dto.zewnetrzny_qr_kod || dto.qr_kod || dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          qr_kod: this.cleanString(dto.qr_kod || dto.zewnetrzny_qr_kod || dto.zewnetrzny_kod_kreskowy || dto.kod_kreskowy),
          szerokosc: this.cleanNumber(dto.szerokosc),
          wysokosc: this.cleanNumber(dto.wysokosc),
          glebokosc: this.cleanNumber(dto.glebokosc),
          waga: this.cleanNumber(dto.waga),
          objetosc: this.cleanNumber(dto.objetosc),
          wartosc: this.cleanNumber(dto.wartosc),
          opis: this.cleanString(dto.opis),
          status_serwisowy: 'Działa',
        },
      });

      if (safeUserId) {
        await tx.logZmian.create({
          data: {
            id_organizacji,
            id_uzytkownika: safeUserId,
            typ_obiektu: 'Opakowanie',
            id_obiektu: egzemplarz.id,
            akcja: 'UTWORZENIE_OPAKOWANIA',
            nowa_wartosc: JSON.stringify(dto),
          },
        });
      }

      return egzemplarz;
    });
  }

  // --- CENNIKI I STAWKI ---

  async getCennikGlobalny(id_organizacji: number, kategoriaId?: number, search?: string) {
    const where: any = { id_organizacji, aktywny: true };
    if (kategoriaId) where.id_kategorii = kategoriaId;
    if (search) {
      where.OR = [{ nazwa: { contains: search, mode: 'insensitive' } }];
    }
    return this.prisma.extendedClient.modelSprzetu.findMany({
      where,
      include: {
        kategoria: true,
        stawki: {
          where: { aktywny: true, nazwa_stawki: 'Podstawowa (PLN)' },
          take: 1,
        },
      },
      orderBy: { nazwa: 'asc' },
    });
  }

  async updateCenyMasowo(updates: { id_modelu: number; cena: number | null }[], id_organizacji: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      let zaktualizowano = 0;
      for (const update of updates) {
        const istniejaca = await tx.cenaModelu.findFirst({
          where: { id_modelu: update.id_modelu, id_organizacji, nazwa_stawki: 'Podstawowa (PLN)', aktywny: true },
        });
        if (istniejaca) {
          await tx.cenaModelu.update({
            where: { id: istniejaca.id },
            data: { cena_netto: update.cena },
          });
        } else {
          await tx.cenaModelu.create({
            data: {
              id_organizacji,
              id_modelu: update.id_modelu,
              nazwa_stawki: 'Podstawowa (PLN)',
              cena_netto: update.cena,
            },
          });
        }
        zaktualizowano++;
      }
      return { success: true, count: zaktualizowano };
    });
  }

  async addStawkaToModel(id_modelu: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.cenaModelu.create({
      data: {
        id_organizacji,
        id_modelu,
        nazwa_stawki: this.cleanString(dto.nazwa_stawki) || 'Nowa stawka',
        cena_netto: this.cleanNumber(dto.cena_netto),
        koszt: this.cleanNumber(dto.koszt),
        nazwa_kosztu: this.cleanString(dto.nazwa_kosztu),
        mnoz_koszt: this.cleanBoolean(dto.mnoz_koszt),
      },
    });
  }

  async updateStawka(id: number, dto: any, id_organizacji: number) {
    return this.prisma.extendedClient.cenaModelu.update({
      where: { id },
      data: {
        nazwa_stawki: this.cleanString(dto.nazwa_stawki),
        cena_netto: this.cleanNumber(dto.cena_netto),
        koszt: this.cleanNumber(dto.koszt),
        nazwa_kosztu: this.cleanString(dto.nazwa_kosztu),
        mnoz_koszt: this.cleanBoolean(dto.mnoz_koszt),
      },
    });
  }

  async deleteStawka(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.cenaModelu.update({
      where: { id },
      data: { aktywny: false },
    });
  }

  async getZajetoscModelu(id_modelu: number, id_organizacji: number) {
    const pozycje = await this.prisma.extendedClient.pozycjaWynajmu.findMany({
      where: { id_organizacji, id_modelu, aktywny: true },
      include: { wynajem: { include: { kontrahent: true } }, egzemplarz: true },
      orderBy: { data_utworzenia: 'desc' },
    });
    return pozycje.map((p) => ({
      id: p.id,
      typ: 'wynajem',
      tytul: p.wynajem?.numer || `Wynajem #${p.id_wynajmu}`,
      start: p.wynajem?.data_wydania,
      koniec: p.wynajem?.data_zwrotu_planowana,
      kontrahent: p.wynajem?.kontrahent?.nazwa,
      wydarzenie: undefined,
      egzemplarz: p.egzemplarz?.nazwa || p.egzemplarz?.sn,
      ilosc: p.ilosc,
    }));
  }

  // --- SKANER KODÓW (PRECYZYJNA LOGIKA CASE I MODELI ILOŚCIOWYCH) ---

  async znajdzSprzetPoKodzie(kodRaw: string, id_organizacji: number) {
    const kod = this.cleanString(kodRaw);
    if (!kod) throw new NotFoundException('Podaj kod kreskowy, QR albo numer seryjny');

    const codeOr = [
      { kod_kreskowy: kod },
      { zewnetrzny_kod_kreskowy: kod },
      { zewnetrzny_qr_kod: kod },
      { qr_kod: kod },
      { sn: kod },
      { numer_urzadzenia: kod },
      { numer_egzemplarza: kod },
    ];

    const includeForScan: any = {
      model: { include: { kategoria: true } },
      magazyn: true,
      case: {
        include: {
          model: true,
          zawartosc_case: {
            where: { aktywny: true },
            include: { model: { include: { kategoria: true } }, magazyn: true },
            orderBy: [{ id_modelu: 'asc' }, { numer_egzemplarza: 'asc' }, { id: 'asc' }],
          },
        },
      },
      zawartosc_case: {
        where: { aktywny: true },
        include: { model: { include: { kategoria: true } }, magazyn: true },
        orderBy: [{ id_modelu: 'asc' }, { numer_egzemplarza: 'asc' }, { id: 'asc' }],
      },
    };

    // Jeśli ten sam kod występuje na case i w środku, case ma pierwszeństwo
    const caseEgzemplarz = await this.prisma.extendedClient.egzemplarz.findFirst({
      where: {
        id_organizacji,
        aktywny: true,
        OR: [
          { AND: [{ OR: codeOr }, { model: { typ_sprzetu: 'opakowanie' } }] },
          { AND: [{ OR: codeOr }, { zawartosc_case: { some: { aktywny: true } } }] },
        ],
      },
      include: includeForScan,
      orderBy: [{ id: 'asc' }],
    });

    const egzemplarz = caseEgzemplarz || (await this.prisma.extendedClient.egzemplarz.findFirst({
      where: {
        id_organizacji,
        aktywny: true,
        OR: codeOr,
      },
      include: includeForScan,
      orderBy: [{ id: 'asc' }],
    }));

    if (!egzemplarz) {
      // Sprzęt ilościowy na modelu
      const modelIlosciowy = await this.prisma.extendedClient.modelSprzetu.findFirst({
        where: {
          id_organizacji,
          aktywny: true,
          OR: [{ kod_kreskowy: { equals: kod, mode: 'insensitive' } }],
        },
        include: { kategoria: true, egzemplarze: { where: { aktywny: true }, take: 1 } },
      });

      if (modelIlosciowy && (this.isSprzetIlosciowy(modelIlosciowy) || (modelIlosciowy.egzemplarze || []).length === 0)) {
        return {
          rowType: 'ilosciowy_model',
          quantityOnly: true,
          id_modelu: modelIlosciowy.id,
          nazwa: modelIlosciowy.nazwa,
          nazwa_modelu: modelIlosciowy.nazwa,
          kategoria: modelIlosciowy.kategoria?.nazwa || 'Bez kategorii',
          kod: modelIlosciowy.kod_kreskowy || kod,
          kod_kreskowy: modelIlosciowy.kod_kreskowy || kod,
          ilosc_dostepna: Number(modelIlosciowy.ilosc_magazynowa || 0),
          ilosc_magazynowa: Number(modelIlosciowy.ilosc_magazynowa || 0),
          jednostka: modelIlosciowy.jednostka || 'szt.',
          message: `Zeskanowano model ilościowy: ${modelIlosciowy.nazwa}. Podaj ilość sztuk.`,
        };
      }
      throw new NotFoundException(`Nie znaleziono sprzętu dla kodu: ${kod}`);
    }

    const normalize = (e: any) => ({
      rowType: 'egzemplarz',
      id: e.id,
      id_egzemplarza: e.id,
      id_modelu: e.id_modelu,
      nazwa: e.nazwa || e.model?.nazwa,
      nazwa_modelu: e.model?.nazwa,
      numer_egzemplarza: e.numer_egzemplarza || e.numer_urzadzenia,
      kategoria: e.model?.kategoria?.nazwa || 'Bez kategorii',
      kod: this.getEquipmentCode(e),
      kod_kreskowy: this.getEquipmentCode(e),
      sn: e.sn,
      status_serwisowy: e.status_serwisowy,
      id_magazynu: e.id_magazynu ? Number(e.id_magazynu) : null,
      magazyn_id: e.id_magazynu ? Number(e.id_magazynu) : null,
      magazyn_nazwa: e.magazyn?.nazwa || 'Brak przypisanego magazynu',
      magazyn: e.magazyn?.nazwa || 'Brak przypisanego magazynu',
      miejsce_w_mag: e.miejsce_w_mag || '',
      ilosc: 1,
    });

    const makeCasePayload = (caseRow: any, reason = 'case') => {
      const meta = this.caseScanMeta(caseRow);
      const contents = (caseRow.zawartosc_case || [])
        .filter((e: any) => e.aktywny !== false && e.model?.typ_sprzetu !== 'opakowanie')
        .map((child: any) => ({
          ...normalize(child),
          system_case_scan: meta,
          id_zeskanowanego_case: meta?.id || caseRow.id,
          nazwa_zeskanowanego_case: meta?.nazwa || caseRow.nazwa || caseRow.model?.nazwa || 'Case',
        }));

      if (!contents.length) throw new NotFoundException(`Case/opakowanie ${kod} jest puste albo nie zawiera aktywnych egzemplarzy.`);
      return {
        rowType: 'case',
        isCase: true,
        id: caseRow.id,
        id_egzemplarza: caseRow.id,
        nazwa: caseRow.nazwa || caseRow.model?.nazwa || 'Case',
        nazwa_modelu: caseRow.model?.nazwa,
        kod: this.getEquipmentCode(caseRow) || kod,
        kod_kreskowy: this.getEquipmentCode(caseRow) || kod,
        kategoria: caseRow.model?.kategoria?.nazwa || 'Opakowania',
        ilosc: contents.length,
        contents,
        message: `Zeskanowano case. Dodano ${contents.length} egzemplarzy z wnętrza case.`,
        scan_reason: reason,
      };
    };

    if (this.isZestaw(egzemplarz)) {
      return {
        ...normalize(egzemplarz),
        rowType: 'zestaw',
        isZestaw: true,
        message: 'Zeskanowano zestaw (idzie w całości).',
      };
    }

    const isDirectCase = this.isOpakowanie(egzemplarz) || (egzemplarz.zawartosc_case?.length || 0) > 0;
    if (isDirectCase) {
      return makeCasePayload(egzemplarz, 'direct_case_scan');
    }

    const parentCase = egzemplarz.case;
    const parentCaseCodes = [
      parentCase?.kod_kreskowy,
      parentCase?.zewnetrzny_kod_kreskowy,
      parentCase?.zewnetrzny_qr_kod,
      parentCase?.qr_kod,
      parentCase?.sn,
      parentCase?.numer_urzadzenia,
      parentCase?.numer_egzemplarza,
    ].filter(Boolean).map((v: any) => String(v));

    if (parentCase && parentCaseCodes.includes(String(kod)) && (parentCase.zawartosc_case?.length || 0) > 0) {
      return makeCasePayload(parentCase, 'parent_case_code_matched');
    }

    return {
      ...normalize(egzemplarz),
      case: egzemplarz.case ? `${egzemplarz.case.model?.nazwa || ''} ${egzemplarz.case.nazwa || ''}`.trim() : null,
    };
  }

  async znajdzSprzetDlaWydawkiPoKodzie(kod: string, id_organizacji: number) {
    return this.znajdzSprzetPoKodzie(kod, id_organizacji);
  }

  // --- DOKUMENTY MAGAZYNOWE (WZ, PZ, PLAN, RELOKACJA) ---

  async getDokumentyMagazynowe(id_organizacji: number, query: any = {}) {
    const where: any = { id_organizacji, aktywny: true };
    if (query.typ) where.typ = String(query.typ);
    if (query.id_wydarzenia) where.id_wydarzenia = Number(query.id_wydarzenia);
    if (query.id_wynajmu) where.id_wynajmu = Number(query.id_wynajmu);
    return this.prisma.extendedClient.wydanieMagazynowe.findMany({
      where,
      include: {
        wydarzenie: { select: { id: true, nazwa: true, numer: true } },
        wynajem: { select: { id: true, numer: true } },
        magazyn_docelowy: true,
        utworzyl: { select: { id: true, imie: true, nazwisko: true, email: true } },
        pozycje: {
          where: { aktywny: true },
          include: {
            model: { include: { kategoria: true } },
            egzemplarz: {
              include: {
                model: { include: { kategoria: true } },
                case: { include: { model: true } },
              },
            },
          },
        },
      },
      orderBy: { data_operacji: 'desc' },
    });
  }

  async getDokumentMagazynowyById(id: number, id_organizacji: number) {
    const doc = await this.prisma.extendedClient.wydanieMagazynowe.findFirst({
      where: { id, id_organizacji, aktywny: true },
      include: {
        organizacja: true,
        wydarzenie: { include: { kontrahent: true, typ: true, status: true } },
        wynajem: { include: { kontrahent: true } },
        magazyn_docelowy: true,
        utworzyl: { select: { id: true, imie: true, nazwisko: true, email: true } },
        pozycje: {
          where: { aktywny: true },
          include: {
            model: { include: { kategoria: { include: { rodzic: true } } } },
            egzemplarz: {
              include: {
                model: { include: { kategoria: { include: { rodzic: true } } } },
                magazyn: true,
                case: { include: { model: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!doc) throw new NotFoundException('Nie znaleziono dokumentu magazynowego');
    return doc;
  }

  async createDokumentMagazynowy(dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    const typ = this.cleanString(dto.typ) || 'wydanie';
    const prefix = typ === 'przyjecie' ? 'PZ' : typ === 'plan' ? 'PLAN' : 'WZ';
    const pozycje = Array.isArray(dto.pozycje) ? dto.pozycje : [];
    const id_wydarzenia = this.cleanNumber(dto.id_wydarzenia);
    const id_wynajmu = this.cleanNumber(dto.id_wynajmu);
    const id_magazynu_docelowego = this.cleanNumber(dto.id_magazynu_docelowego);

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const expandedPozycje: any[] = [];
      const instancesToUpdate: { id: number; targetStatus: string; id_magazynu?: number | null; miejsce_w_mag?: string | null }[] = [];

      for (const p of pozycje) {
        const id_egzemplarza = this.cleanNumber(p.id_egzemplarza);

        if (!id_egzemplarza) {
          const id_modelu = this.cleanNumber(p.id_modelu);
          const modelIlosciowy = id_modelu
            ? await tx.modelSprzetu.findFirst({
                where: { id: id_modelu, id_organizacji, aktywny: true },
                include: { kategoria: true },
              })
            : null;

          if (modelIlosciowy && this.isSprzetIlosciowy(modelIlosciowy)) {
            const qty = Number(p.ilosc || 0);
            if (!qty || qty <= 0) {
              throw new BadRequestException(`Podaj prawidłową ilość dla sprzętu ilościowego: ${modelIlosciowy.nazwa}.`);
            }
            const availableQty = Number(modelIlosciowy.ilosc_magazynowa || 0);
            if (typ === 'wydanie' && qty > availableQty) {
              throw new BadRequestException(
                `Brak wystarczającej ilości: ${modelIlosciowy.nazwa}. Dostępne ${availableQty} ${modelIlosciowy.jednostka || 'szt.'}, próba wydania ${qty}.`,
              );
            }
            expandedPozycje.push({
              ...p,
              id_modelu: modelIlosciowy.id,
              id_egzemplarza: null,
              nazwa: this.cleanString(p.nazwa_na_dokumencie || p.nazwa) || modelIlosciowy.nazwa,
              ilosc: qty,
              uwagi: [this.cleanString(p.uwagi), 'Sprzęt ilościowy bez egzemplarzy'].filter(Boolean).join(' | '),
            });
            continue;
          }
          throw new BadRequestException('Pozycja dokumentu musi zawierać konkretny egzemplarz albo model ilościowy.');
        }

        const egz = await tx.egzemplarz.findFirst({
          where: { id: id_egzemplarza, id_organizacji, aktywny: true },
          include: {
            model: { include: { kategoria: true } },
            magazyn: true,
            zawartosc_case: {
              where: { aktywny: true },
              include: { model: { include: { kategoria: true } }, magazyn: true },
              orderBy: [{ id_modelu: 'asc' }, { numer_egzemplarza: 'asc' }, { id: 'asc' }],
            },
          },
        });

        if (!egz) throw new BadRequestException(`Nie znaleziono egzemplarza #${id_egzemplarza}.`);

        const isCaseInstance = this.isOpakowanie(egz) || (egz.zawartosc_case?.length || 0) > 0;
        if (isCaseInstance) {
          const contents = (egz.zawartosc_case || []).filter((child: any) => !this.isOpakowanie(child));
          if (!contents.length) {
            throw new BadRequestException(`Zeskanowany case "${egz.nazwa || egz.model?.nazwa}" jest pusty.`);
          }
          const meta = this.caseScanMeta(egz);
          for (const child of contents) {
            const validation = await this.validateInstanceMovement(tx, child.id, child.nazwa || child.model?.nazwa, typ, id_wydarzenia, id_organizacji);
            expandedPozycje.push({
              ...p,
              system_case_scan: meta,
              id_zeskanowanego_case: meta?.id || egz.id,
              nazwa_zeskanowanego_case: meta?.nazwa || egz.nazwa || egz.model?.nazwa || 'Case',
              id_modelu: child.id_modelu,
              id_egzemplarza: child.id,
              nazwa:
                this.cleanString((p.nazwy_egzemplarzy || {})?.[child.id]) ||
                this.cleanString(child.nazwa) ||
                this.cleanString(child.model?.nazwa) ||
                'Egzemplarz z case',
              ilosc: 1,
              uwagi: validation.crossEventNote ? [this.cleanString(p.uwagi), validation.crossEventNote].filter(Boolean).join(' | ') : p.uwagi,
            });

            const itemUpdate: any = { id: child.id, targetStatus: typ === 'wydanie' ? 'Wydany' : 'Działa' };
            if (typ === 'przyjecie' && (p.zmien_magazyn || p.forceWarehouseChange) && id_magazynu_docelowego) {
              itemUpdate.id_magazynu = id_magazynu_docelowego;
              if (p.nowe_miejsce_w_mag !== undefined) itemUpdate.miejsce_w_mag = this.cleanString(p.nowe_miejsce_w_mag);
            }
            instancesToUpdate.push(itemUpdate);
          }
          continue;
        }

        if (this.isOpakowanie(egz)) {
          throw new BadRequestException('Opakowanie/case nie może być samodzielną pozycją dokumentu WZ/PZ.');
        }

        const validation = await this.validateInstanceMovement(tx, egz.id, egz.nazwa || egz.model?.nazwa, typ, id_wydarzenia, id_organizacji);

        expandedPozycje.push({
          ...p,
          id_modelu: egz.id_modelu,
          id_egzemplarza: egz.id,
          nazwa:
            this.cleanString(p.nazwa_na_dokumencie || p.nazwa) ||
            this.cleanString(egz.nazwa) ||
            this.cleanString(egz.model?.nazwa) ||
            'Egzemplarz sprzętu',
          ilosc: 1,
          uwagi: validation.crossEventNote ? [this.cleanString(p.uwagi), validation.crossEventNote].filter(Boolean).join(' | ') : p.uwagi,
        });

        const itemUpdate: any = { id: egz.id, targetStatus: typ === 'wydanie' ? 'Wydany' : 'Działa' };
        if (typ === 'przyjecie' && (p.zmien_magazyn || p.forceWarehouseChange) && id_magazynu_docelowego) {
          itemUpdate.id_magazynu = id_magazynu_docelowego;
          if (p.nowe_miejsce_w_mag !== undefined) itemUpdate.miejsce_w_mag = this.cleanString(p.nowe_miejsce_w_mag);
        }
        instancesToUpdate.push(itemUpdate);
      }

      if (id_wynajmu && typ === 'wydanie' && !this.cleanString(dto.osoba_odbierajaca)) {
        throw new BadRequestException('Przy wydaniu do wynajmu wymagane jest podanie osoby odbierającej.');
      }

      const doc = await tx.wydanieMagazynowe.create({
        data: {
          id_organizacji,
          id_wydarzenia,
          id_wynajmu,
          id_magazynu_docelowego,
          id_uzytkownika_utworzyl: isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika),
          typ,
          numer: this.cleanString(dto.numer) || this.nextDocumentNumber(prefix),
          data_operacji: this.cleanDate(dto.data_operacji) || new Date(),
          osoba_odbierajaca: this.cleanString(dto.osoba_odbierajaca),
          podpis_odbierajacego: this.cleanString(dto.podpis_odbierajacego),
          uwagi: this.cleanString(dto.uwagi),
          pozycje: {
            create: expandedPozycje.map((p: any) => ({
              id_organizacji,
              id_modelu: this.cleanNumber(p.id_modelu),
              id_egzemplarza: this.cleanNumber(p.id_egzemplarza),
              nazwa: this.cleanString(p.nazwa_na_dokumencie || p.nazwa) || this.cleanString(p.model?.nazwa) || this.cleanString(p.egzemplarz?.nazwa) || 'Pozycja sprzętu',
              ilosc: this.cleanNumber(p.ilosc) || 1,
              status: this.cleanString(p.status) || (typ === 'przyjecie' ? 'przyjety' : typ === 'plan' ? 'plan' : 'wydany'),
              uwagi: this.buildDocumentUwagi(p),
            })),
          },
        },
        include: { pozycje: true },
      });

      if (typ === 'wydanie' || typ === 'przyjecie') {
        const deltas = new Map<number, number>();
        for (const p of expandedPozycje) {
          const modelId = this.cleanNumber(p.id_modelu);
          const egzId = this.cleanNumber(p.id_egzemplarza);
          if (!modelId || egzId) continue;
          const qty = Number(p.ilosc || 0);
          if (!qty) continue;
          deltas.set(modelId, (deltas.get(modelId) || 0) + (typ === 'wydanie' ? -qty : qty));
        }
        for (const [modelId, delta] of deltas.entries()) {
          await tx.modelSprzetu.update({
            where: { id: modelId },
            data: { ilosc_magazynowa: { increment: delta } },
          });
        }
      }

      for (const item of instancesToUpdate) {
        const updateData: any = { status_serwisowy: item.targetStatus };
        if (item.id_magazynu !== undefined) updateData.id_magazynu = item.id_magazynu;
        if (item.miejsce_w_mag !== undefined) updateData.miejsce_w_mag = item.miejsce_w_mag;

        await tx.egzemplarz.update({
          where: { id: item.id },
          data: updateData,
        });

        if (item.id_magazynu) {
          await tx.logZmian.create({
            data: {
              id_organizacji,
              id_uzytkownika: isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika),
              typ_obiektu: 'Egzemplarz',
              id_obiektu: item.id,
              akcja: 'PRZENIESIENIE_MAGAZYN_PZ',
              nowa_wartosc: JSON.stringify({ id_magazynu: item.id_magazynu, miejsce_w_mag: item.miejsce_w_mag }),
            },
          });
        }
      }

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika),
          typ_obiektu: 'WydanieMagazynowe',
          id_obiektu: doc.id,
          akcja: typ.toUpperCase(),
          nowa_wartosc: JSON.stringify({ ...dto, pozycje_count: expandedPozycje.length, case_expanded: expandedPozycje.length !== pozycje.length }),
        },
      });

      return doc;
    });
  }

  // --- SPRZĘT WYDARZENIA & PACKLISTA ---

  async getSprzetWydarzenia(id_wydarzenia: number, id_organizacji: number) {
    const [wydarzenie, planPozycje, dokumenty, wszystkieEgzemplarze] = await Promise.all([
      this.prisma.extendedClient.wydarzenie.findFirst({
        where: { id: id_wydarzenia, id_organizacji, aktywny: true },
        include: {
          oferty: { where: { aktywny: true }, include: { wersje: { take: 1, orderBy: { numer_wersji: 'desc' }, include: { pozycje: true, sekcje: true } } } },
        },
      }),
      this.prisma.extendedClient.pozycjaSprzetuWydarzenia.findMany({
        where: { id_organizacji, id_wydarzenia, aktywny: true },
        include: { model: { include: { kategoria: true, egzemplarze: { where: { aktywny: true } } } } },
        orderBy: [{ kolejnosc: 'asc' }, { data_utworzenia: 'asc' }],
      }),
      this.prisma.extendedClient.wydanieMagazynowe.findMany({
        where: { id_organizacji, id_wydarzenia, aktywny: true },
        include: {
          magazyn_docelowy: true,
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
      this.prisma.extendedClient.egzemplarz.findMany({
        where: { id_organizacji, aktywny: true, model: { typ_sprzetu: { not: 'opakowanie' } } },
        include: { model: { include: { kategoria: true } }, magazyn: true },
      }),
    ]);

    if (!wydarzenie) throw new NotFoundException('Nie znaleziono wydarzenia');
    const toNumber = (value: any) => Number(value || 0);
    const keyFor = (p: any) => String(p.id_modelu || p.model?.id || p.egzemplarz?.id_modelu || p.egzemplarz?.model?.id || p.nazwa);
    const nameFor = (p: any) => p.nazwa || p.model?.nazwa || p.egzemplarz?.model?.nazwa || p.egzemplarz?.nazwa || 'Pozycja sprzętu';
    const categoryFor = (p: any) => p.model?.kategoria?.nazwa || p.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii';
    const codeFor = (p: any) => this.getEquipmentCode(p.egzemplarz) || p.model?.kod_kreskowy || '';

    const planowane = planPozycje.map((p: any) => ({
      ...p,
      zrodlo: 'plan',
      klucz_sprzetu: keyFor(p),
      nazwa: nameFor(p),
      kategoria: categoryFor(p),
      kod: '',
      ilosc: toNumber(p.ilosc_planowana || 1),
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
      })),
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

    const kategorie = pozycje
      .reduce((acc: any[], p: any) => {
        const nazwa = p.kategoria || 'Bez kategorii';
        let group = acc.find((g) => g.nazwa === nazwa);
        if (!group) {
          group = { nazwa, pozycje: [], planowana_ilosc: 0, wydana_ilosc: 0, przyjeta_ilosc: 0 };
          acc.push(group);
        }
        group.pozycje.push(p);
        group.planowana_ilosc += toNumber(p.planowana_ilosc);
        group.wydana_ilosc += toNumber(p.wydana_ilosc);
        group.przyjeta_ilosc += toNumber(p.przyjeta_ilosc);
        return acc;
      }, [])
      .sort((a: any, b: any) => a.nazwa.localeCompare(b.nazwa, 'pl'));

    return {
      wydarzenie,
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
      wszystkie_egzemplarze: wszystkieEgzemplarze,
    };
  }

  async dodajSprzetDoWydarzenia(id_wydarzenia: number, dto: any, id_organizacji: number) {
    const pozycje = Array.isArray(dto.pozycje) ? dto.pozycje : [];
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const wydarzenie = await tx.wydarzenie.findFirst({ where: { id: id_wydarzenia, id_organizacji, aktywny: true } });
      if (!wydarzenie) throw new NotFoundException('Nie znaleziono wydarzenia');

      if (Object.prototype.hasOwnProperty.call(dto, 'uwagi_packlista')) {
        await tx.wydarzenie.update({
          where: { id: id_wydarzenia },
          data: {
            uwagi_packlista: this.cleanString(dto.uwagi_packlista),
          },
        });
      }

      if (dto?.replace === true) {
        await tx.pozycjaSprzetuWydarzenia.updateMany({
          where: { id_organizacji, id_wydarzenia, aktywny: true },
          data: { aktywny: false, data_usuniecia: new Date() },
        });
      }

      const byModel = new Map<number, { ilosc: number; uwagi?: string | null | undefined; kolejnosc: number }>();
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

        const existing = byModel.get(id_modelu) || { ilosc: 0, uwagi: this.cleanString(p.uwagi), kolejnosc: byModel.size + 1 };
        existing.ilosc += ilosc;
        byModel.set(id_modelu, existing);
      }

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
              kolejnosc: data.kolejnosc,
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
              kolejnosc: data.kolejnosc,
            },
          });
        }
      }

      return tx.pozycjaSprzetuWydarzenia.findMany({
        where: { id_organizacji, id_wydarzenia, aktywny: true },
        include: { model: { include: { kategoria: true } } },
        orderBy: [{ kolejnosc: 'asc' }, { data_utworzenia: 'asc' }],
      });
    });
  }

  async updatePacklistaUwagi(id_wydarzenia: number, dto: any, id_organizacji: number) {
    const pozycje = Array.isArray(dto?.pozycje) ? dto.pozycje : [];

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const wydarzenie = await tx.wydarzenie.findFirst({
        where: {
          id: id_wydarzenia,
          id_organizacji,
          aktywny: true,
        },
      });

      if (!wydarzenie) {
        throw new NotFoundException('Nie znaleziono wydarzenia');
      }

      await tx.wydarzenie.update({
        where: { id: id_wydarzenia },
        data: {
          uwagi_packlista: this.cleanString(dto?.uwagi_packlista),
        },
      });

      for (const p of pozycje) {
        const id_modelu = this.cleanNumber(p.id_modelu);
        if (!id_modelu) continue;

        await tx.pozycjaSprzetuWydarzenia.updateMany({
          where: {
            id_organizacji,
            id_wydarzenia,
            id_modelu,
            aktywny: true,
          },
          data: {
            uwagi: this.cleanString(p.uwagi),
          },
        });
      }

      return { ok: true };
    });
  }

  // --- SPRZĘT WYNAJMU ---

  async getSprzetWynajmu(id_wynajmu: number, id_organizacji: number) {
    const [wynajem, planPozycje, dokumenty] = await Promise.all([
      this.prisma.extendedClient.wynajem.findFirst({
        where: { id: id_wynajmu, id_organizacji, aktywny: true },
        include: {
          oferty: { where: { aktywny: true }, include: { wersje: { take: 1, orderBy: { numer_wersji: 'desc' }, include: { pozycje: true, sekcje: true } } } },
        },
      }),
      this.prisma.extendedClient.pozycjaWynajmu.findMany({
        where: { id_organizacji, id_wynajmu, aktywny: true },
        include: { model: { include: { kategoria: true } } },
        orderBy: [{ id: 'asc' }],
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
    const codeFor = (p: any) => this.getEquipmentCode(p.egzemplarz) || p.model?.kod_kreskowy || '';

    const planowane = planPozycje.map((p: any) => ({
      ...p,
      zrodlo: 'plan',
      klucz_sprzetu: keyFor(p),
      nazwa: nameFor(p),
      kategoria: categoryFor(p),
      kod: '',
      ilosc: toNumber(p.ilosc || 1),
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
      })),
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

    const kategorie = pozycje
      .reduce((acc: any[], p: any) => {
        const nazwa = p.kategoria || 'Bez kategorii';
        let group = acc.find((g) => g.nazwa === nazwa);
        if (!group) {
          group = { nazwa, pozycje: [], planowana_ilosc: 0, wydana_ilosc: 0, przyjeta_ilosc: 0 };
          acc.push(group);
        }
        group.pozycje.push(p);
        group.planowana_ilosc += toNumber(p.planowana_ilosc);
        group.wydana_ilosc += toNumber(p.wydana_ilosc);
        group.przyjeta_ilosc += toNumber(p.przyjeta_ilosc);
        return acc;
      }, [])
      .sort((a: any, b: any) => a.nazwa.localeCompare(b.nazwa, 'pl'));

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

  async dodajSprzetDoWynajmu(id_wynajmu: number, dto: any, id_organizacji: number) {
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

        const existing = byModel.get(id_modelu) || { ilosc: 0, uwagi: this.cleanString(p.uwagi) };
        existing.ilosc += ilosc;
        byModel.set(id_modelu, existing);
      }

      for (const [id_modelu, data] of byModel.entries()) {
        const existing = await tx.pozycjaWynajmu.findFirst({
          where: { id_organizacji, id_wynajmu, id_modelu },
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

      return tx.pozycjaWynajmu.findMany({
        where: { id_organizacji, id_wynajmu, aktywny: true },
        include: { model: { include: { kategoria: true } } },
        orderBy: [{ data_utworzenia: 'asc' }],
      });
    });
  }

  // --- KONTROLA ZWROTÓW (NIEZWRÓCONY SPRZĘT) ---

  async getNiezwrocone(id_organizacji: number) {
    const dokumenty = await this.prisma.extendedClient.wydanieMagazynowe.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        typ: { in: ['wydanie', 'przyjecie'] },
      },
      include: {
        pozycje: { where: { aktywny: true } },
        wydarzenie: { include: { kontrahent: true, status: true } },
        wynajem: { include: { kontrahent: true, status: true } },
      },
    });

    const map = new Map<string, any>();

    for (const doc of dokumenty) {
      const isWynajem = !!doc.id_wynajmu;
      const isWydarzenie = !!doc.id_wydarzenia;
      if (!isWynajem && !isWydarzenie) continue;

      const key = isWynajem ? `W-${doc.id_wynajmu}` : `E-${doc.id_wydarzenia}`;

      if (!map.has(key)) {
        map.set(key, {
          id: isWynajem ? doc.id_wynajmu : doc.id_wydarzenia,
          typ_kontekstu: isWynajem ? 'wynajem' : 'wydarzenie',
          numer: isWynajem ? doc.wynajem?.numer || `#${doc.id_wynajmu}` : doc.wydarzenie?.numer || `#${doc.id_wydarzenia}`,
          nazwa: isWynajem ? `Wynajem ${doc.wynajem?.numer || '#' + doc.id_wynajmu}` : doc.wydarzenie?.nazwa,
          kontrahent: isWynajem ? doc.wynajem?.kontrahent : doc.wydarzenie?.kontrahent,
          status_obj: isWynajem ? doc.wynajem?.status : doc.wydarzenie?.status,
          data_start: isWynajem ? doc.wynajem?.data_wydania : doc.wydarzenie?.data_start,
          data_koniec: isWynajem ? doc.wynajem?.data_zwrotu_planowana : doc.wydarzenie?.data_koniec,
          wydano_szt: 0,
          przyjeto_szt: 0,
        });
      }

      const ctx = map.get(key);
      for (const p of doc.pozycje) {
        const qty = Number(p.ilosc || 0);
        if (doc.typ === 'wydanie') ctx.wydano_szt += qty;
        if (doc.typ === 'przyjecie') ctx.przyjeto_szt += qty;
      }
    }

    return Array.from(map.values())
      .map((x) => ({ ...x, niezwrocone_szt: Math.max(0, x.wydano_szt - x.przyjeto_szt) }))
      .filter((x) => x.niezwrocone_szt > 0)
      .sort((a, b) => {
        const dateA = a.data_koniec ? new Date(a.data_koniec).getTime() : 0;
        const dateB = b.data_koniec ? new Date(b.data_koniec).getTime() : 0;
        return dateA - dateB;
      });
  }

  // --- TRANSFER BEZPOŚREDNI MIĘDZY WYDARZENIAMI ---

  async transferMiedzyWydarzeniami(dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    if (!dto.sourceEventId || !dto.targetEventId || !dto.items || dto.items.length === 0) {
      throw new BadRequestException('Brak wymaganych danych do transferu.');
    }

    return this.prisma.extendedClient.$transaction(async (tx) => {
      const pz = await tx.wydanieMagazynowe.create({
        data: {
          id_organizacji,
          id_wydarzenia: Number(dto.sourceEventId),
          typ: 'przyjecie',
          numer: `PZ-TR/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
          uwagi: `Automatyczny zwrot z powodu transferu bezpośredniego na wydarzenie #${dto.targetEventId}`,
          id_uzytkownika_utworzyl: id_uzytkownika,
          pozycje: {
            create: dto.items.map((i: any) => ({
              id_organizacji,
              id_modelu: i.id_modelu || null,
              id_egzemplarza: i.id_egzemplarza || null,
              nazwa: i.nazwa,
              ilosc: Number(i.ilosc_transfer || 1),
              status: 'przyjety',
              uwagi: 'Transfer między-wydarzeniowy',
            })),
          },
        },
      });

      const wz = await tx.wydanieMagazynowe.create({
        data: {
          id_organizacji,
          id_wydarzenia: Number(dto.targetEventId),
          typ: 'wydanie',
          numer: `WZ-TR/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`,
          uwagi: `Automatyczne wydanie z transferu bezpośredniego z wydarzenia #${dto.sourceEventId}`,
          id_uzytkownika_utworzyl: id_uzytkownika,
          pozycje: {
            create: dto.items.map((i: any) => ({
              id_organizacji,
              id_modelu: i.id_modelu || null,
              id_egzemplarza: i.id_egzemplarza || null,
              nazwa: i.nazwa,
              ilosc: Number(i.ilosc_transfer || 1),
              status: 'wydany',
              uwagi: 'Transfer między-wydarzeniowy',
            })),
          },
        },
      });

      if (dto.task && (dto.task.przypisani?.length > 0 || dto.task.id_pojazdu)) {
        const zadanie = await tx.zadanie.create({
          data: {
            id_organizacji,
            id_tworcy: id_uzytkownika,
            tytul: `Transfer logistyczny: ${dto.sourceEventName} ➔ ${dto.targetEventName}`,
            opis: dto.task.uwagi || 'Zadanie wygenerowane automatycznie przy transferze sprzętu z paki do paki.',
            typ_zadania: 'transport',
            status: 'nowe',
            data_start: dto.task.data_start ? new Date(dto.task.data_start) : null,
            id_wydarzenia: Number(dto.targetEventId),
            id_pojazdu: dto.task.id_pojazdu ? Number(dto.task.id_pojazdu) : null,
          },
        });

        if (dto.task.przypisani?.length > 0) {
          await tx.zadanieUzytkownik.createMany({
            data: dto.task.przypisani.map((uid: string | number) => ({
              id_organizacji,
              id_zadania: zadanie.id,
              id_uzytkownika: Number(uid),
            })),
          });
        }
      }

      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika,
          typ_obiektu: 'Magazyn',
          akcja: 'TRANSFER_MIEDZY_EVENTOWY',
          nowa_wartosc: JSON.stringify({ z: dto.sourceEventId, do: dto.targetEventId, pozycji: dto.items.length }),
        },
      });

      return { success: true, pzId: pz.id, wzId: wz.id };
    });
  }
}