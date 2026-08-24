import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MagazynService {
  constructor(private readonly prisma: PrismaService) {}

  private cleanNumber(val: any): number | null {
    if (val === "" || val === null || val === undefined) return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
  }

  private cleanString(val: any): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === "" ? null : str;
  }

  private cleanDate(val: any): Date | null {
    if (!val || val === "") return null;
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

  // Utrzymanie starych form helperów (zgodnie z poleceniem zachowania 100% funkcji)
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

  // --- GŁÓWNY SILNIK DOKUMENTÓW WZ/PZ (LOGIKA ROZPAKOWYWANIA I REGUŁ) ---

  async createDokumentMagazynowy(dto: any, id_organizacji: number, id_uzytkownika: number | null) {
    const typ = this.cleanString(dto.typ) || 'wydanie';
    const prefix = typ === 'przyjecie' ? 'PZ' : typ === 'plan' ? 'PLAN' : 'WZ';
    const pozycjeZFrontu = Array.isArray(dto.pozycje) ? dto.pozycje : [];

    return this.prisma.extendedClient.$transaction(async (tx) => {
      // Docelowa unikalna lista sprzętu do wrzucenia na dokument
      const gotoweDoZapisu: any[] = [];
      const przetwarzaneEgzemplarze = new Set<number>();

      // Funkcja wewnętrzna aplikująca reguły 1-6 na każdym zgłoszonym elemencie (rekursywna dla paczek/caseów)
      const processElement = async (element: any, multiplier: number = 1) => {
        // Zabezpieczenie przed błędnymi danymi
        if (!element) return;

        // Reguła 4: Pakiety (rozbijamy je na czynniki pierwsze od razu)
        if (element.id_pakietu) {
          const pakiet = await tx.pakiet.findUnique({
            where: { id: Number(element.id_pakietu) },
            include: { pozycje: true }
          });
          if (pakiet) {
            const mult = Number(element.ilosc_pakietow || element.ilosc || 1) * multiplier;
            for (const pozPakietu of pakiet.pozycje) {
              await processElement(pozPakietu, mult);
            }
          }
          return;
        }

        // Reguła 6: Sprzęt ilościowy (zapisywany po id_modelu i ilości)
        if (!element.id_egzemplarza && element.id_modelu) {
          const model = await tx.modelSprzetu.findFirst({ where: { id: element.id_modelu, id_organizacji }});
          if (model && this.isSprzetIlosciowy(model)) {
            const requestedQty = Number(element.ilosc || 1) * multiplier;
            if (requestedQty <= 0) return;

            if (typ === 'wydanie') {
              const dostepne = Number(model.ilosc_magazynowa || 0);
              if (requestedQty > dostepne) {
                throw new BadRequestException(`Brak wystarczającej ilości sprzętu: ${model.nazwa}. Próba wydania ${requestedQty}, na stanie: ${dostepne}.`);
              }
            }
            
            gotoweDoZapisu.push({
              id_modelu: model.id,
              id_egzemplarza: null,
              nazwa: element.nazwa_na_dokumencie || element.nazwa || model.nazwa,
              ilosc: requestedQty,
              uwagi: element.uwagi || 'Sprzęt ilościowy'
            });
            return;
          }
        }

        // Fizyczny sprzęt (Egzemplarz)
        const idEgzemplarza = element.id_egzemplarza || element.id;
        if (!idEgzemplarza) return;

        // Zapobiega duplikatom z zagnieżdżeń lub podwójnych skanów
        if (przetwarzaneEgzemplarze.has(Number(idEgzemplarza))) return;
        
        const egz = await tx.egzemplarz.findFirst({
          where: { id: Number(idEgzemplarza), id_organizacji, aktywny: true },
          include: { 
            model: true,
            zawartosc_case: { 
              where: { aktywny: true }, 
              include: { model: true } 
            } 
          }
        });

        if (!egz) throw new BadRequestException(`Nie odnaleziono sprzętu fizycznego (ID: ${idEgzemplarza}).`);
        przetwarzaneEgzemplarze.add(egz.id);

        // Reguła 3: Zestawy (RACK). Nie rozpakowujemy. Wchodzi jako jedna pozycja.
        if (this.isZestaw(egz)) {
          gotoweDoZapisu.push({
            id_modelu: egz.id_modelu,
            id_egzemplarza: egz.id,
            nazwa: element.nazwa_na_dokumencie || element.nazwa || egz.nazwa || egz.model.nazwa,
            ilosc: 1 * multiplier,
            uwagi: element.uwagi || ''
          });
          return;
        }

        // Reguła 2: Opakowania (Case). Rozpakowujemy i wrzucamy pojedyncze rzeczy ze środka.
        // Samo opakowanie omija koszyk.
        if (this.isOpakowanie(egz)) {
          for (const child of egz.zawartosc_case) {
            // Procesujemy dzieci (zabezpiecza to ew. Zestawy ukryte wewnątrz Case'a)
            await processElement({ id_egzemplarza: child.id, uwagi: `Z case: ${egz.nazwa || egz.model.nazwa}` }, multiplier);
          }
          return; 
        }

        // Reguła 1 & 5: Zwykły, pojedynczy egzemplarz
        gotoweDoZapisu.push({
          id_modelu: egz.id_modelu,
          id_egzemplarza: egz.id,
          nazwa: element.nazwa_na_dokumencie || element.nazwa || egz.nazwa || egz.model.nazwa,
          ilosc: 1 * multiplier,
          uwagi: element.uwagi || ''
        });
      };

      for (const p of pozycjeZFrontu) {
        await processElement(p, 1);
      }

      if (gotoweDoZapisu.length === 0) {
        throw new BadRequestException('Brak poprawnego sprzętu do wygenerowania dokumentu.');
      }
      
      
      // Finalne generowanie Wydania (WZ/PZ) w bazie
      const id_wydarzenia = this.cleanNumber(dto.id_wydarzenia);
      const id_wynajmu = this.cleanNumber(dto.id_wynajmu);

      if (id_wynajmu && typ === 'wydanie' && !this.cleanString(dto.osoba_odbierajaca)) {
        throw new BadRequestException('Przy wydaniu do wynajmu wpisz osobę odbierającą sprzęt.');
      }

      const doc = await tx.wydanieMagazynowe.create({
        data: {
          id_organizacji,
          id_wydarzenia,
          id_wynajmu,
          id_uzytkownika_utworzyl: isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika),
          typ,
          numer: this.cleanString(dto.numer) || this.nextDocumentNumber(prefix),
          data_operacji: this.cleanDate(dto.data_operacji) || new Date(),
          osoba_odbierajaca: this.cleanString(dto.osoba_odbierajaca),
          podpis_odbierajacego: this.cleanString(dto.podpis_odbierajacego),
          uwagi: this.cleanString(dto.uwagi),
          pozycje: {
            create: gotoweDoZapisu.map((p: any) => ({
              id_organizacji,
              id_modelu: p.id_modelu,
              id_egzemplarza: p.id_egzemplarza,
              nazwa: p.nazwa,
              ilosc: p.ilosc,
              status: typ === 'wydanie' ? 'wydany' : 'przyjety',
              uwagi: p.uwagi,
            })),
          },
        },
        include: { pozycje: true },
      });

      // Aktualizacja zasobów ilościowych
      if (typ === 'wydanie' || typ === 'przyjecie') {
        const deltas = new Map<number, number>();
        for (const p of gotoweDoZapisu) {
          if (!p.id_egzemplarza && p.id_modelu) {
            const qty = Number(p.ilosc || 0);
            if (!qty) continue;
            deltas.set(p.id_modelu, (deltas.get(p.id_modelu) || 0) + (typ === 'wydanie' ? -qty : qty));
          }
        }
        for (const [modelId, delta] of deltas.entries()) {
          await tx.modelSprzetu.update({
            where: { id: modelId },
            data: { ilosc_magazynowa: { increment: delta } },
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
          nowa_wartosc: JSON.stringify({ itemCount: gotoweDoZapisu.length }),
        },
      });

      return doc;
    });
  }

  // --- PRECYZYJNY SKANER (Reguła 5 i 6) ---

  async znajdzSprzetPoKodzie(kodRaw: string, id_organizacji: number) {
    const kod = this.cleanString(kodRaw)?.toLowerCase();
    if (!kod) throw new NotFoundException('Brak kodu.');

    // 1. Sprawdzamy czy to nie jest sprzęt ilościowy po kodzie modelu (Reguła 6)
    const modelIlosciowy = await this.prisma.extendedClient.modelSprzetu.findFirst({
      where: { id_organizacji, aktywny: true, kod_kreskowy: { equals: kod, mode: 'insensitive' } },
      include: { kategoria: true }
    });

    if (modelIlosciowy && this.isSprzetIlosciowy(modelIlosciowy)) {
      return {
        rowType: 'ilosciowy_model',
        quantityOnly: true,
        id_modelu: modelIlosciowy.id,
        nazwa: modelIlosciowy.nazwa,
        kod: modelIlosciowy.kod_kreskowy || kod,
        ilosc_dostepna: Number(modelIlosciowy.ilosc_magazynowa || 0),
        jednostka: modelIlosciowy.jednostka || 'szt.',
        message: `Zeskanowano sprzęt ilościowy. Potwierdź ilość ręcznie.`,
      };
    }

    // 2. Szukamy dokładnego dopasowania fizycznego egzemplarza
    const egzemplarz = await this.prisma.extendedClient.egzemplarz.findFirst({
      where: {
        id_organizacji, aktywny: true,
        OR: [
          { kod_kreskowy: { equals: kod, mode: 'insensitive' } },
          { sn: { equals: kod, mode: 'insensitive' } },
          { zewnetrzny_kod_kreskowy: { equals: kod, mode: 'insensitive' } },
          { zewnetrzny_qr_kod: { equals: kod, mode: 'insensitive' } },
          { qr_kod: { equals: kod, mode: 'insensitive' } },
          { numer_egzemplarza: { equals: kod, mode: 'insensitive' } }
        ]
      },
      include: { model: { include: { kategoria: true } }, zawartosc_case: { include: { model: { include: { kategoria: true } } } } }
    });

    if (!egzemplarz) {
      throw new NotFoundException(`Nie znaleziono sprzętu o kodzie: ${kodRaw}`);
    }

    // Standardowy ładunek bazowy
    const basePayload = {
      id_egzemplarza: egzemplarz.id,
      id_modelu: egzemplarz.id_modelu,
      nazwa: egzemplarz.nazwa || egzemplarz.model.nazwa,
      kod: this.getEquipmentCode(egzemplarz),
      kategoria: egzemplarz.model.kategoria?.nazwa || 'Brak',
      numer_egzemplarza: egzemplarz.numer_egzemplarza || egzemplarz.numer_urzadzenia,
      sn: egzemplarz.sn
    };

    // Zestaw (Reguła 3)
    if (this.isZestaw(egzemplarz)) {
      return { ...basePayload, rowType: 'zestaw', isZestaw: true, message: 'Zeskanowano Zestaw (idzie w całości).' };
    }

    // Case (Reguła 2 - Ale tylko jeśli użytkownik zeskanował dokładnie naklejkę z samego Case'a, a nie element w środku!)
    if (this.isOpakowanie(egzemplarz)) {
      const contents = egzemplarz.zawartosc_case.map(c => ({
        id_egzemplarza: c.id,
        id_modelu: c.id_modelu,
        nazwa: c.nazwa || c.model?.nazwa,
        kategoria: c.model?.kategoria?.nazwa || 'Brak',
        kod: this.getEquipmentCode(c),
        ilosc: 1
      }));
      return { ...basePayload, rowType: 'case', isCase: true, contents, zawartosc_case: contents, message: 'Zeskanowano Opakowanie. Zostanie automatycznie rozpakowane.' };
    }

    // Pojedynczy Egzemplarz (Reguła 1 oraz Reguła 5 - jeśli zeskanowano dziecko siedzące w Case, zignoruje Case'a nadrzędnego)
    return { ...basePayload, rowType: 'egzemplarz', message: 'Dodano Egzemplarz.' };
  }

  async znajdzSprzetDlaWydawkiPoKodzie(kod: string, id_organizacji: number) {
    return this.znajdzSprzetPoKodzie(kod, id_organizacji);
  }

  private nextDocumentNumber(prefix: string) {
    const now = new Date();
    return `${prefix}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now().toString().slice(-6)}`;
  }


  // --- POZOSTAŁE METODY CRUD, KATEGORIE, CENNIKI (KOMPLETNE I NIEZMIENIONE) ---

  async getKategorie(id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.findMany({
      where: { id_organizacji, id_rodzica: null, aktywny: true },
      include: {
        dzieci: {
          where: { aktywny: true },
          orderBy: { kolejnosc: 'asc' }
        }
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
      }
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
      }
    });
  }

  async deleteKategoria(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.kategoria.update({ where: { id }, data: { aktywny: false, data_usuniecia: new Date() } });
  }

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
      ];
    }
    if (filters.widocznyWMag) {
      where.widoczny_w_mag = filters.widocznyWMag === 'TAK';
    }
    if (filters.widocznyWOfercie) {
      where.widoczny_w_ofercie = filters.widocznyWOfercie === 'TAK';
    }

    const modele = await this.prisma.extendedClient.modelSprzetu.findMany({
      where,
      skip,
      take: limit,
      include: {
        kategoria: true,
        stawki: {
          where: { aktywny: true, nazwa_stawki: 'Podstawowa (PLN)' },
          take: 1
        },
        egzemplarze: {
          where: { aktywny: true },
          select: { 
            id: true, 
            id_statusu_egzemplarza: true, 
            status_serwisowy: true,
            // Pobieramy podsumowanie wydań, żeby wiedzieć, czy sprzęt zjechał już na magazyn
            pozycje_wydan: {
              where: { aktywny: true, wydanie: { aktywny: true, typ: { in: ['wydanie', 'przyjecie'] } } },
              select: { ilosc: true, wydanie: { select: { typ: true } } }
            }
          }
        }
      },
      orderBy: { nazwa: 'asc' },
    });

    return modele.map(model => {
      const ilosciowy = model.tryb_ewidencji === 'ilosciowe' || model.typ_sprzetu === 'ilosciowe';
      
      let wMagazynieCount = 0;
      let wSerwisieCount = 0;
      let wTerenieCount = 0;

      if (!ilosciowy) {
         model.egzemplarze.forEach((e: any) => {
             // Jeżeli uszkodzony, od razu odrzucamy z dostępnych
             if (e.status_serwisowy?.includes('Wymaga') || e.status_serwisowy === 'W serwisie') {
                 wSerwisieCount++;
                 return;
             }
             
             // Badamy balans wyjazdów: WZ (minus) oraz PZ (plus)
             let wydano = 0;
             let przyjeto = 0;
             (e.pozycje_wydan || []).forEach((pw: any) => {
                 if (pw.wydanie?.typ === 'wydanie') wydano += Number(pw.ilosc || 1);
                 if (pw.wydanie?.typ === 'przyjecie') przyjeto += Number(pw.ilosc || 1);
             });
             
             if (wydano - przyjeto > 0) {
                 wTerenieCount++; // Sprzęt leży na eventach
             } else {
                 wMagazynieCount++; // Sprzęt jest fizycznie dostępny na półce
             }
         });
      }

      const totalStanie = ilosciowy ? Number(model.ilosc_magazynowa || 0) : model.egzemplarze.length;

      return {
        id: model.id,
        nazwa: model.nazwa,
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
          magazyn: ilosciowy ? totalStanie : wMagazynieCount,
          eventy: ilosciowy ? 0 : wTerenieCount,
          serwis: wSerwisieCount,
          rack: 0 
        },
        dostepnych: ilosciowy ? totalStanie : wMagazynieCount
      };
    });
  }

  async createModelSprzetu(dto: any, id_organizacji: number) {
    const ilosciowy = this.isSprzetIlosciowy(dto);
    return this.prisma.extendedClient.modelSprzetu.create({
      data: {
        id_organizacji,
        nazwa: this.cleanString(dto.nazwa),
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
      }
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
             _count: { select: { zawartosc_case: { where: { aktywny: true } } } }
          }
        }
      }
    });
    if (!model) throw new NotFoundException('Nie znaleziono modelu');

    // Pobieramy załączniki powiązane z tym modelem
    const zalaczniki = await this.prisma.extendedClient.zalacznik.findMany({
      where: { id_organizacji, typ_obiektu: 'ModelSprzetu', id_obiektu: id, aktywny: true },
      include: { dodal: { select: { imie: true, nazwisko: true } } },
      orderBy: { data_utworzenia: 'desc' },
    });

    return { ...model, zalaczniki };
  }

  // --- Nowe funkcje dla załączników modelu ---
  async addZalacznik(id_modelu: number, dto: any, id_organizacji: number, id_uzytkownika: number) {
    return this.prisma.extendedClient.zalacznik.create({
      data: {
        id_organizacji,
        typ_obiektu: 'ModelSprzetu',
        id_obiektu: id_modelu,
        nazwa: dto.nazwa,
        nazwa_pliku: dto.nazwa_pliku,
        rozmiar_bajtow: Number(dto.rozmiar) || 0,
        mime: dto.mime || 'application/octet-stream',
        id_uzytkownika_dodal: id_uzytkownika
      }
    });
  }

  async removeZalacznik(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.zalacznik.update({
      where: { id, id_organizacji },
      data: { aktywny: false }
    });
  }

  async updateModel(id: number, dto: any, id_organizacji: number) {
    const ilosciowy = this.isSprzetIlosciowy(dto);
    return this.prisma.extendedClient.modelSprzetu.update({
      where: { id },
      data: {
        nazwa: this.cleanString(dto.nazwa),
        typ_sprzetu: this.cleanString(dto.typ_sprzetu),
        tryb_ewidencji: ilosciowy ? 'ilosciowe' : 'egzemplarze',
        ilosc_magazynowa: ilosciowy ? (this.cleanNumber(dto.ilosc_magazynowa) ?? 0) : 0,
        jednostka: this.cleanString(dto.jednostka) || 'szt.',
        id_kategorii: this.cleanNumber(dto.id_kategorii),
        producent: this.cleanString(dto.producent),
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
        notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne)
      }
    });
  }

  async usunModelSoft(id: number, id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const model = await tx.modelSprzetu.update({
        where: { id },
        data: { aktywny: false, data_usuniecia: new Date() }
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

  async getMagazyny(id_organizacji: number) {
    return this.prisma.extendedClient.magazyn.findMany({
      where: { id_organizacji, aktywny: true },
      orderBy: { nazwa: 'asc' },
    });
  }

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
          status_serwisowy: this.cleanString(dto.status_serwisowy) || "Działa",
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
          notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne)
        }
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
            opis: this.cleanString(dto.opis_usterki)
          }
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
          status_serwisowy: this.cleanString(dto.status_serwisowy) || "Działa",
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
          notatki_wewnetrzne: this.cleanString(dto.notatki_wewnetrzne)
        }
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
            opis: this.cleanString(dto.opis_usterki)
          }
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
        data: { aktywny: false }
      });
      await tx.logZmian.create({
        data: {
          id_organizacji,
          id_uzytkownika: safeUserId,
          typ_obiektu: 'Egzemplarz',
          id_obiektu: id,
          akcja: 'USUNIECIE'
        },
      });
      return egzemplarz;
    });
  }

  async getFizyczneCase(id_organizacji: number) {
    return this.prisma.extendedClient.egzemplarz.findMany({
      where: { 
         id_organizacji, 
         aktywny: true,
         model: { typ_sprzetu: { in: ['opakowanie', 'rack', 'zestaw'] } } 
       },
      include: {
        model: { select: { nazwa: true } },
        _count: { select: { zawartosc_case: { where: { aktywny: true } } } }
      },
      orderBy: { nazwa: 'asc' }
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
          orderBy: { nazwa: 'asc' }
        },
        serwisy: {
          include: { status: true, zglosil: true, rozwiazal: true },
          orderBy: { data_zgloszenia: 'desc' }
        },
        pozycje_wydan: {
          where: { aktywny: true, wydanie: { aktywny: true, id_wydarzenia: { not: null } } },
          include: { 
            wydanie: { 
              include: { 
                wydarzenie: { 
                  include: { status: true, typ: true, kontrahent: true } 
                } 
              } 
            } 
          },
          orderBy: { data_utworzenia: 'desc' }
        }
      }
    });
  }

  async getDostepneDoCase(id_organizacji: number, id_case: number) {
    return this.prisma.extendedClient.egzemplarz.findMany({
      where: {
        id_organizacji,
        aktywny: true,
        id_case: null,
        id: { not: id_case },
        model: { typ_sprzetu: 'sprzet' } 
       },
      include: { model: true },
      orderBy: { nazwa: 'asc' }
    });
  }

  async modyfikujZawartoscCase(id_case: number, itemIds: number[], akcja: 'add' | 'remove', id_organizacji: number, id_uzytkownika: number | null) {
    const safeUserId = isNaN(Number(id_uzytkownika)) ? null : Number(id_uzytkownika);
    return this.prisma.extendedClient.$transaction(async (tx) => {
      const skrzynia = await tx.egzemplarz.findFirst({
        where: { id: id_case, id_organizacji, aktywny: true }
      });
      if (!skrzynia) throw new NotFoundException('Nie znaleziono skrzyni');

      await tx.egzemplarz.updateMany({
        where: { id: { in: itemIds }, id_organizacji },
        data: { id_case: akcja === 'add' ? id_case : null }
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
        model: { typ_sprzetu: { in: ['opakowanie', 'rack', 'zestaw'] } }
      },
      include: {
        model: {
          include: { kategoria: true }
        },
        magazyn: true,
        zawartosc_case: {
          where: { aktywny: true },
          include: {
            model: true,
            magazyn: true
          },
          orderBy: { nazwa: 'asc' }
        }
      },
      orderBy: { nazwa: 'asc' }
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
          status_serwisowy: 'Działa'
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

  async getCennikGlobalny(id_organizacji: number, kategoriaId?: number, search?: string) {
    const where: any = { id_organizacji, aktywny: true };
    if (kategoriaId) where.id_kategorii = kategoriaId;
    if (search) {
      where.OR = [
        { nazwa: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.extendedClient.modelSprzetu.findMany({
      where,
      include: {
        kategoria: true,
        stawki: {
          where: { aktywny: true, nazwa_stawki: 'Podstawowa (PLN)' },
          take: 1
        }
      },
      orderBy: { nazwa: 'asc' }
    });
  }

  async updateCenyMasowo(updates: { id_modelu: number, cena: number | null }[], id_organizacji: number) {
    return this.prisma.extendedClient.$transaction(async (tx) => {
      let zaktualizowano = 0;
      for (const update of updates) {
        const istniejaca = await tx.cenaModelu.findFirst({
          where: { id_modelu: update.id_modelu, id_organizacji, nazwa_stawki: 'Podstawowa (PLN)', aktywny: true }
        });
        if (istniejaca) {
          await tx.cenaModelu.update({
            where: { id: istniejaca.id },
            data: { cena_netto: update.cena }
          });
        } else {
          await tx.cenaModelu.create({
            data: {
              id_organizacji,
              id_modelu: update.id_modelu,
              nazwa_stawki: 'Podstawowa (PLN)',
              cena_netto: update.cena
            }
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
        mnoz_koszt: this.cleanBoolean(dto.mnoz_koszt)
      }
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
        mnoz_koszt: this.cleanBoolean(dto.mnoz_koszt)
      }
    });
  }

  async deleteStawka(id: number, id_organizacji: number) {
    return this.prisma.extendedClient.cenaModelu.update({
      where: { id },
      data: { aktywny: false }
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
        kategoria: { nazwa: { contains: filters.searchCategory, mode: 'insensitive' } }
      };
    }

    return this.prisma.extendedClient.egzemplarz.findMany({
      where,
      include: {
        model: {
          include: { kategoria: true }
        },
        magazyn: true
      },
      orderBy: { data_utworzenia: 'desc' }
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
        utworzyl: { select: { id: true, imie: true, nazwisko: true, email: true } },
        pozycje: { where: { aktywny: true }, include: { model: { include: { kategoria: true } }, egzemplarz: { include: { model: { include: { kategoria: true } }, case: { include: { model: true } } } } } },
      },
      orderBy: { data_operacji: 'desc' },
    });
  }

 async getDokumentMagazynowyById(id: number, id_organizacji: number) {
  const doc = await this.prisma.extendedClient.wydanieMagazynowe.findFirst({
    where: {
      id,
      id_organizacji,
      aktywny: true,
    },

    include: {
      organizacja: true,

      wydarzenie: {
        include: {
          kontrahent: true,
          typ: true,
          status: true,
        },
      },

      wynajem: {
        include: {
          kontrahent: true,
        },
      },

      utworzyl: {
        select: {
          id: true,
          imie: true,
          nazwisko: true,
          email: true,
        },
      },

      pozycje: {
        where: {
          aktywny: true,
        },

        include: {
          model: {
            include: {
              kategoria: {
                include: {
                  rodzic: true,
                },
              },
            },
          },

          egzemplarz: {
            include: {
              model: {
                include: {
                  kategoria: {
                    include: {
                      rodzic: true,
                    },
                  },
                },
              },

              magazyn: true,

              case: {
                include: {
                  model: true,
                },
              },
            },
          },
        },

        orderBy: {
          id: 'asc',
        },
      },
    },
  });

  if (!doc) {
    throw new NotFoundException('Nie znaleziono dokumentu magazynowego');
  }

  return doc;
}

  async getSprzetWydarzenia(id_wydarzenia: number, id_organizacji: number) {
    const [wydarzenie, planPozycje, dokumenty] = await Promise.all([
      this.prisma.extendedClient.wydarzenie.findFirst({
        where: {
          id: id_wydarzenia,
          id_organizacji,
          aktywny: true
        },
        include: {
          organizacja: true,
          kontrahent: true,
          miejsce: true,

          oferty: {
            where: { aktywny: true },
            include: {
              wersje: {
                take: 1,
                orderBy: { numer_wersji: 'desc' },
                include: {
                  pozycje: true,
                  sekcje: true
                }
              }
            }
          },
        },
      }),
      
      this.prisma.extendedClient.pozycjaSprzetuWydarzenia.findMany({
        where: { id_organizacji, id_wydarzenia, aktywny: true },
        include: { model: { include: { kategoria: true } } },
        orderBy: [{ kolejnosc: 'asc' }, { data_utworzenia: 'asc' }],
      }),
      this.prisma.extendedClient.wydanieMagazynowe.findMany({
        where: { id_organizacji, id_wydarzenia, aktywny: true },
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

    if (!wydarzenie) throw new NotFoundException('Nie znaleziono wydarzenia');

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
    }, []).sort((a: any, b: any) => a.nazwa.localeCompare(b.nazwa, 'pl'));

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
    const codeFor = (p: any) => p.egzemplarz?.kod_kreskowy || p.egzemplarz?.zewnetrzny_kod_kreskowy || p.egzemplarz?.zewnetrzny_qr_kod || p.egzemplarz?.qr_kod || p.egzemplarz?.sn || p.model?.kod_kreskowy || '';

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

  async getNiezwrocone(id_organizacji: number) {
    const dokumenty = await this.prisma.extendedClient.wydanieMagazynowe.findMany({
      where: { 
        id_organizacji, 
        aktywny: true, 
        typ: { in: ['wydanie', 'przyjecie'] } 
      },
      include: {
        pozycje: { where: { aktywny: true } },
        wydarzenie: { include: { kontrahent: true, status: true } },
        wynajem: { include: { kontrahent: true, status: true } }
      }
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
          numer: isWynajem ? (doc.wynajem?.numer || `#${doc.id_wynajmu}`) : (doc.wydarzenie?.numer || `#${doc.id_wydarzenia}`),
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
      .map(x => ({ ...x, niezwrocone_szt: Math.max(0, x.wydano_szt - x.przyjeto_szt) }))
      .filter(x => x.niezwrocone_szt > 0)
      .sort((a, b) => {
        const dateA = a.data_koniec ? new Date(a.data_koniec).getTime() : 0;
        const dateB = b.data_koniec ? new Date(b.data_koniec).getTime() : 0;
        return dateA - dateB;
      });
  }

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
              uwagi: 'Transfer między-wydarzeniowy'
            }))
          }
        }
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
              uwagi: 'Transfer między-wydarzeniowy'
            }))
          }
        }
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
          }
        });

        if (dto.task.przypisani?.length > 0) {
          await tx.zadanieUzytkownik.createMany({
            data: dto.task.przypisani.map((uid: string | number) => ({
              id_organizacji,
              id_zadania: zadanie.id,
              id_uzytkownika: Number(uid)
            }))
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
        }
      });

      return { success: true, pzId: pz.id, wzId: wz.id };
    });
  }
  async updatePacklistaUwagi(
  id_wydarzenia: number,
  dto: any,
  id_organizacji: number
) {
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
}