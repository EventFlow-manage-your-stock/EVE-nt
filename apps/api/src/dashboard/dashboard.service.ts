import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(id_organizacji: number, id_uzytkownika: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      wydarzeniaTygodnia, 
      aktywneSerwisy,
      aktywneWynajmy,
      dzisiejszeWydarzeniaRaw, 
      mojeZadania,
      alertyFloty,
      oczekujaceOferty,
      niezwroconySprzet,
      uzytkownik,
      statystykiMagazynu,
      nowiKlienci,
      ostatniaAktywnosc,
      urlopyDzisiaj,
      ofertyMiesiaca,
      egzemplarzeWszystkie,
      egzemplarzeSerwis,
      wydarzeniaDoFaktury
    ] = await Promise.all([
      this.prisma.extendedClient.wydarzenie.count({ where: { id_organizacji, aktywny: true, data_start: { gte: startOfWeek, lt: endOfWeek } } }),
      this.prisma.extendedClient.serwisSprzetu.count({ where: { id_organizacji, aktywny: true, data_rozwiazania: null } }),
      this.prisma.extendedClient.wynajem.count({ where: { id_organizacji, aktywny: true, data_wydania: { lte: new Date() }, data_zwrotu_rzeczywista: null } }),
      this.prisma.extendedClient.wydarzenie.findMany({
        where: { id_organizacji, aktywny: true, data_start: { lt: tomorrow }, data_koniec: { gte: today } },
        include: { miejsce: true, kontrahent: true, status: true, typ: true, manager: true },
        orderBy: { data_start: 'asc' },
      }),
      this.prisma.extendedClient.zadanie.findMany({
        where: { id_organizacji, aktywny: true, status: { notIn: ['zakończone', 'anulowane'] }, przypisani_uzytkownicy: { some: { id_uzytkownika } } },
        take: 6, orderBy: { data_utworzenia: 'desc' }
      }),
      this.prisma.extendedClient.pojazd.findMany({
        where: { id_organizacji, aktywny: true, OR: [ { data_oc: { lte: in30Days } }, { data_przegladu: { lte: in30Days } } ] }
      }),
      this.prisma.extendedClient.oferta.findMany({
        where: { id_organizacji, aktywny: true, status: { nazwa: { in: ['Nowa', 'Wysłana', 'Do akceptacji'] } } },
        include: { kontrahent: true, status: true },
        take: 5, orderBy: { data_utworzenia: 'desc' }
      }),
      this.prisma.extendedClient.wynajem.findMany({
        where: { id_organizacji, aktywny: true, data_zwrotu_planowana: { lt: today }, data_zwrotu_rzeczywista: null },
        include: { kontrahent: true },
        take: 5, orderBy: { data_zwrotu_planowana: 'asc' }
      }),
      this.prisma.extendedClient.uzytkownik.findUnique({
        where: { id: id_uzytkownika }, select: { imie: true, preferencje_kokpitu: true }
      }),
      this.prisma.extendedClient.modelSprzetu.count({ where: { id_organizacji, aktywny: true } }),
      this.prisma.extendedClient.kontrahent.findMany({ where: { id_organizacji, aktywny: true }, take: 4, orderBy: { data_utworzenia: 'desc' } }),
      this.prisma.extendedClient.logZmian.findMany({ 
        where: { id_organizacji }, take: 8, orderBy: { data_utworzenia: 'desc' }, include: { uzytkownik: { select: { imie: true, nazwisko: true } } } 
      }),
      this.prisma.extendedClient.nieobecnosc.findMany({
        where: { id_organizacji, aktywny: true, data_od: { lte: today }, data_do: { gte: today } },
        include: { uzytkownik: { select: { imie: true, nazwisko: true, avatar: true } } }
      }),
      this.prisma.extendedClient.oferta.findMany({
        where: { id_organizacji, aktywny: true, data_utworzenia: { gte: startOfMonth } },
        select: { suma_netto: true, status: { select: { nazwa: true } } }
      }),
      
      // Zliczanie stanu wszystkich modeli
      this.prisma.extendedClient.egzemplarz.count({ where: { id_organizacji, aktywny: true } }),
      
      // ROZWIĄZANIE PROBLEMU 1: 
      // Zliczamy jako "w serwisie" tylko te egzemplarze, które mają aktualnie otwarte zgłoszenie.
      this.prisma.extendedClient.egzemplarz.count({ 
        where: { 
          id_organizacji, 
          aktywny: true, 
          serwisy: {
            some: { aktywny: true, data_rozwiazania: null }
          }
        } 
      }),
      
      // ROZWIĄZANIE PROBLEMU 2: 
      // Rozszerzona, ostra bariera dla statusów księgowych oznaczających rozliczenie.
      this.prisma.extendedClient.wydarzenie.findMany({
        where: { 
          id_organizacji, 
          aktywny: true, 
          data_koniec: { lt: today },
          OR: [
            { id_statusu_ksiegowego: null },
            { status_ksiegowy: { nazwa: { notIn: ['Opłacone', 'Opłacono', 'Faktura wysłana', 'Wystawiono fakturę', 'Zafakturowane', 'Zafakturowano', 'Rozliczone', 'Zakończone'] } } }
          ]
        },
        include: { kontrahent: true, status_ksiegowy: true },
        orderBy: { data_koniec: 'desc' },
        take: 5
      })
    ]);

    const todaysEvents = dzisiejszeWydarzeniaRaw.map((event) => {
      const startHour = event.data_start ? event.data_start.getHours() : 8;
      const currentHour = new Date().getHours();
      let progress = ((currentHour - startHour) / 12) * 100;
      if (progress < 0) progress = 0;
      if (progress > 100) progress = 100;

      return {
        id: event.id,
        title: event.nazwa,
        type: event.typ?.nazwa ?? 'Wydarzenie',
        typeColor: event.typ?.kolor ?? '#06B6D4',
        statusIcon: (event.status as any)?.ikona ?? '🔵',
        location: event.miejsce ? event.miejsce.nazwa : event.kontrahent?.nazwa || 'Lokalizacja nieznana',
        status: event.status?.nazwa || 'W trakcie',
        time: event.data_start && event.data_koniec
          ? `${event.data_start.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})} - ${event.data_koniec.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}`
          : 'Cały dzień',
        progress,
        manager: event.manager ? `${event.manager.imie.charAt(0)}${event.manager.nazwisko.charAt(0)}` : 'SYS'
      };
    });

    const finanse = ofertyMiesiaca.reduce((acc, o) => {
      const val = Number(o.suma_netto || 0);
      acc.total += val;
      if (o.status?.nazwa?.toLowerCase().includes('zaakcept')) acc.accepted += val;
      else if (o.status?.nazwa?.toLowerCase().includes('odrzuc')) acc.rejected += val;
      else acc.pending += val;
      return acc;
    }, { total: 0, accepted: 0, pending: 0, rejected: 0 });

    return {
      user: { imie: uzytkownik?.imie || 'Użytkowniku' },
      kpis: { 
        eventsThisWeek: wydarzeniaTygodnia, 
        activeService: aktywneSerwisy, 
        activeRentals: aktywneWynajmy,
        totalModels: statystykiMagazynu
      },
      todaysEvents,
      tasks: mojeZadania,
      fleetAlerts: alertyFloty,
      offers: oczekujaceOferty,
      unreturned: niezwroconySprzet,
      newClients: nowiKlienci,
      recentActivity: ostatniaAktywnosc,
      teamLeaves: urlopyDzisiaj,
      eventsToInvoice: wydarzeniaDoFaktury,
      smartFlow: { 
        finanse,
        inventory: { total: egzemplarzeWszystkie, inService: egzemplarzeSerwis }
      },
      preferences: uzytkownik?.preferencje_kokpitu || null
    };
  }

  async savePreferences(id_uzytkownika: number, layout: string[]) {
    return this.prisma.extendedClient.uzytkownik.update({
      where: { id: id_uzytkownika },
      data: { preferencje_kokpitu: { layout } }
    });
  }
  async globalSearch(id_organizacji: number, query: string) {
    if (!query || query.length < 2) return [];
    
    const q = { contains: query, mode: 'insensitive' as const };
    
    // Równoległe, limitowane zapytania do najważniejszych tabel
    const [wydarzenia, oferty, wynajmy, modele, egzemplarze, kontrahenci] = await Promise.all([
      this.prisma.extendedClient.wydarzenie.findMany({ where: { id_organizacji, aktywny: true, OR: [{ nazwa: q }, { numer: q }] }, take: 4 }),
      this.prisma.extendedClient.oferta.findMany({ where: { id_organizacji, aktywny: true, OR: [{ nazwa: q }, { numer: q }] }, take: 4 }),
      this.prisma.extendedClient.wynajem.findMany({ where: { id_organizacji, aktywny: true, OR: [{ numer: q }] }, take: 4 }),
      this.prisma.extendedClient.modelSprzetu.findMany({ where: { id_organizacji, aktywny: true, OR: [{ nazwa: q }, { kod_kreskowy: q }, { producent: q }] }, take: 4 }),
      this.prisma.extendedClient.egzemplarz.findMany({ where: { id_organizacji, aktywny: true, OR: [{ nazwa: q }, { sn: q }, { kod_kreskowy: q }, { zewnetrzny_kod_kreskowy: q }, { numer_egzemplarza: q }] }, include: { model: true }, take: 4 }),
      this.prisma.extendedClient.kontrahent.findMany({ where: { id_organizacji, aktywny: true, OR: [{ nazwa: q }, { nip: q }] }, take: 4 }),
    ]);

    const results: any[] = [];

    wydarzenia.forEach(w => results.push({ id: `ev-${w.id}`, group: 'Wydarzenia', title: w.nazwa, subtitle: w.numer || 'Wydarzenie', url: `/dashboard/events/${w.id}` }));
    oferty.forEach(o => results.push({ id: `of-${o.id}`, group: 'Oferty', title: o.nazwa, subtitle: o.numer || 'Oferta', url: `/dashboard/offers/${o.id}` }));
    wynajmy.forEach(w => results.push({ id: `wy-${w.id}`, group: 'Wynajmy', title: w.numer || `Wynajem #${w.id}`, subtitle: 'Wypożyczenie', url: `/dashboard/rentals/${w.id}` }));
    modele.forEach(m => results.push({ id: `mo-${m.id}`, group: 'Modele', title: m.nazwa, subtitle: m.producent || 'Model sprzętu', url: `/dashboard/warehouse/models/${m.id}` }));
    egzemplarze.forEach(e => results.push({ id: `eg-${e.id}`, group: 'Egzemplarze', title: e.nazwa || e.model?.nazwa || 'Sprzęt', subtitle: `S/N: ${e.sn || e.kod_kreskowy || e.zewnetrzny_kod_kreskowy || '-'}`, url: `/dashboard/warehouse/items/${e.id}` }));
    kontrahenci.forEach(k => results.push({ id: `ko-${k.id}`, group: 'Kontrahenci', title: k.nazwa, subtitle: k.nip ? `NIP: ${k.nip}` : 'Klient', url: `/dashboard/crm/${k.id}` }));

    return results;
  }

  async getNotifications(id_organizacji: number, id_uzytkownika: number) {
    const [zadania, serwis] = await Promise.all([
      // Pobieramy nowe zadania przypisane do użytkownika
      this.prisma.extendedClient.zadanie.findMany({
        where: { id_organizacji, aktywny: true, status: 'nowe', przypisani_uzytkownicy: { some: { id_uzytkownika } } },
        orderBy: { data_utworzenia: 'desc' },
        take: 3
      }),
      // Pobieramy ostatnie awarie
      this.prisma.extendedClient.serwisSprzetu.findMany({
        where: { id_organizacji, aktywny: true, data_rozwiazania: null },
        include: { egzemplarz: { include: { model: true } } },
        orderBy: { data_zgloszenia: 'desc' },
        take: 3
      })
    ]);

    const notifications: any[] = [];

    zadania.forEach(z => notifications.push({
      id: `zad-${z.id}`,
      title: 'Nowe zadanie',
      message: z.tytul,
      time: z.data_utworzenia,
      type: 'task',
      url: `/dashboard/tasks/${z.id}`
    }));

    serwis.forEach(s => notifications.push({
      id: `ser-${s.id}`,
      title: 'Awaria sprzętu',
      message: `${s.egzemplarz?.model?.nazwa || 'Sprzęt'}: ${s.tytul}`,
      time: s.data_zgloszenia,
      type: 'alert',
      url: `/dashboard/service/${s.id}`
    }));

    return notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }

}