import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class GusService {
  // Domyślny klucz testowy GUS (działa na publicznym środowisku testowym).
  // Aby działało w produkcji, utwórz darmowe konto na stronie GUS i dodaj klucz do pliku .env.
  private readonly apiKey = process.env.GUS_API_KEY || 'abcde12345abcde12345';
  private readonly apiUrl = process.env.GUS_API_URL || 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc/ajax/endpoint';

  async lookupByNip(rawNip: string) {
    const nip = String(rawNip || '').replace(/\D/g, '');
    if (nip.length !== 10) throw new BadRequestException('NIP musi mieć 10 cyfr');

    let sid = '';

    try {
      // 1. Logowanie do GUS i pobranie sesji (SID)
      const loginResponse = await fetch(`${this.apiUrl}/Zaloguj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pKluczUzytkownika: this.apiKey }),
      });

      if (!loginResponse.ok) throw new Error('Błąd logowania do GUS');
      const loginData = await loginResponse.json();
      
      // API RESTowe GUS zawraca dane w obiekcie "d"
      sid = loginData?.d; 
      if (!sid) throw new Error('Brak identyfikatora sesji SID z GUS');

      // 2. Pobieranie danych podmiotu na podstawie NIP
      const searchResponse = await fetch(`${this.apiUrl}/DaneSzukajPodmioty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'sid': sid, // Wymagany nagłówek autoryzacji sesji
        },
        body: JSON.stringify({ pParametryWyszukiwania: { Nip: nip } }),
      });

      const searchData = await searchResponse.json();
      const subjectsRaw = searchData?.d;

      // POPRAWKA TYPU: jawne określenie any[] rozwiązuje błędy TS
      let parsedSubjects: any[] = []; 
      try {
         // GUS zwraca wyniki jako zagnieżdżony string JSON, musimy go sparsować
         parsedSubjects = typeof subjectsRaw === 'string' ? JSON.parse(subjectsRaw) : subjectsRaw;
      } catch (e) {
         parsedSubjects = [];
      }

      if (!parsedSubjects || parsedSubjects.length === 0) {
        throw new NotFoundException('Nie znaleziono podmiotu w bazie GUS');
      }

      const subject = parsedSubjects[0]; // Bierzemy główny rekord

      // 3. Bezpieczne i asynchroniczne wylogowanie z sesji (GUS tego wymaga)
      this.logout(sid).catch(console.error);

      // 4. Formatowanie adresu z rozbitych pól GUS na jeden string
      const ulica = subject.Ulica ? `ul. ${subject.Ulica}` : '';
      const nrDomu = subject.NrNieruchomosci || '';
      const nrLokalu = subject.NrLokalu ? `/${subject.NrLokalu}` : '';
      const pelnaUlica = [ulica, nrDomu + nrLokalu].filter(Boolean).join(' ').trim();
      const pelnyAdres = `${pelnaUlica ? pelnaUlica + ', ' : ''}${subject.KodPocztowy || ''} ${subject.Miejscowosc || ''}`.trim();

      return {
        nazwa: subject.Nazwa,
        nip: subject.Nip,
        regon: subject.Regon,
        krs: subject.Krs || null,
        email: null, // GUS nie udostępnia e-maila
        telefon: null, // GUS zazwyczaj nie udostępnia telefonu
        adres: pelnyAdres,
        ulica: pelnaUlica,
        kod_pocztowy: subject.KodPocztowy,
        miasto: subject.Miejscowosc,
        kraj: 'Polska',
        zrodlo_danych: 'gus_bir1',
        data_pobrania_gus: new Date().toISOString(),
        raw: subject,
      };

    } catch (error: any) {
       // W razie błędu wyczyść sesję
       if (sid) this.logout(sid).catch(() => {});
       
       console.warn(`[GUS API] Błąd pobierania (${error.message}). Przełączanie na zapasowe API MF...`);
       
       // WZORZEC FALLBACK: Jeśli GUS ma awarię (częste zjawisko), uderzamy do stabilnego API Białej Listy
       return this.fallbackToMF(nip);
    }
  }

  // Wymagane wylogowanie sesji, aby nie wyczerpać limitów zapytań
  private async logout(sid: string) {
    await fetch(`${this.apiUrl}/Wyloguj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pIdentyfikatorSesji: sid }),
    });
  }

  // Zabezpieczenie na wypadek awarii serwerów państwowych GUS (Zapasowe API)
  private async fallbackToMF(nip: string) {
    const date = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new BadRequestException('Nie udało się pobrać danych z żadnego rejestru (GUS i MF niedostępne lub brak NIP)');
    
    const json: any = await response.json();
    const subject = json?.result?.subject;

    if (!subject) throw new BadRequestException('Nie znaleziono podmiotu dla podanego NIP');

    return {
      nazwa: subject.name,
      nip: subject.nip,
      regon: subject.regon,
      krs: subject.krs,
      email: null,
      telefon: null,
      adres: subject.residenceAddress || subject.workingAddress || null,
      ulica: subject.residenceAddress || subject.workingAddress || null,
      kod_pocztowy: null,
      miasto: null,
      kraj: 'Polska',
      zrodlo_danych: 'mf_whitelist',
      data_pobrania_gus: new Date().toISOString(),
      raw: subject,
    };
  }
}