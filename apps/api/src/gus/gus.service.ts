import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GusService {
  private readonly logger = new Logger(GusService.name);
  private readonly apiKey: string;
  private readonly serviceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GUS_API_KEY') || 'a308a886c75548f09310';
    this.serviceUrl =
      this.configService.get<string>('GUS_API_URL') ||
      'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
  }

  async lookupByNip(rawNip: string) {
    const nip = String(rawNip || '').replace(/\D/g, '');
    if (nip.length !== 10) {
      throw new BadRequestException('NIP musi mieć dokładnie 10 cyfr');
    }

    try {
      const gusData = await this.fetchFromGusBir(nip);
      if (gusData) return gusData;
    } catch (error: any) {
      this.logger.warn(`Błąd usługi GUS BIR1.1: ${error?.message}. Próba fallbacku do MF...`);
    }

    return this.fetchFromMfFallback(nip);
  }

  private async fetchFromGusBir(nip: string) {
    const sid = await this.loginToGus();
    if (!sid) {
      throw new Error('Nie udało się uzyskać identyfikatora sesji (SID) z GUS.');
    }

    const soapQuery = `
      <soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
         <soapenv:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
            <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
            <wsa:To>${this.serviceUrl}</wsa:To>
         </soapenv:Header>
         <soapenv:Body>
            <ns:DaneSzukajPodmioty>
               <ns:pParametryWyszukiwania>
                  <dat:Nip>${nip}</dat:Nip>
               </ns:pParametryWyszukiwania>
            </ns:DaneSzukajPodmioty>
         </soapenv:Body>
      </soapenv:Envelope>
    `.trim();

    const response = await fetch(this.serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty"',
        sid: sid,
      },
      body: soapQuery,
    });

    const xmlResponse = await response.text();
    const resultMatch = xmlResponse.match(/<DaneSzukajPodmiotyResult>([\s\S]*?)<\/DaneSzukajPodmiotyResult>/);
    if (!resultMatch || !resultMatch[1]) {
      throw new Error('Pusta odpowiedź z GUS dla zadanego numeru NIP');
    }

    const unescapedXml = resultMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    const getTag = (tag: string) => {
      const match = unescapedXml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return match ? match[1].trim() : null;
    };

    const nazwa = getTag('Nazwa');
    if (!nazwa) return null;

    const ulica = getTag('Ulica');
    const nrNieruchomosci = getTag('NrNieruchomosci');
    const nrLokalu = getTag('NrLokalu');
    const pelnyAdres = [ulica, nrNieruchomosci ? (nrLokalu ? `${nrNieruchomosci}/${nrLokalu}` : nrNieruchomosci) : null]
      .filter(Boolean)
      .join(' ');

    return {
      nazwa: nazwa,
      nip: nip,
      regon: getTag('Regon'),
      krs: getTag('Krs'),
      email: null,
      telefon: null,
      adres: pelnyAdres || null,
      ulica: pelnyAdres || null,
      kod_pocztowy: getTag('KodPocztowy'),
      miasto: getTag('Miejscowosc'),
      kraj: 'Polska',
      zrodlo_danych: 'gus_bir1.1',
      data_pobrania_gus: new Date().toISOString(),
      raw: {
        wojewodztwo: getTag('Wojewodztwo'),
        powiat: getTag('Powiat'),
        gmina: getTag('Gmina'),
        typ: getTag('Typ'),
        silosID: getTag('SilosID'),
      },
    };
  }

  private async loginToGus(): Promise<string | null> {
    const loginEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
         <soapenv:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
            <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
            <wsa:To>${this.serviceUrl}</wsa:To>
         </soapenv:Header>
         <soapenv:Body>
            <ns:Zaloguj>
               <ns:pKluczUzytkownika>${this.apiKey}</ns:pKluczUzytkownika>
            </ns:Zaloguj>
         </soapenv:Body>
      </soapenv:Envelope>
    `.trim();

    const response = await fetch(this.serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj"',
      },
      body: loginEnvelope,
    });

    const body = await response.text();
    const match = body.match(/<ZalogujResult>(.*?)<\/ZalogujResult>/);
    return match ? match[1].trim() : null;
  }

  private async fetchFromMfFallback(nip: string) {
    const date = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException('Nie udało się pobrać danych podmiotu ani z GUS BIR, ani z rejestru MF.');
    }

    const json: any = await response.json();
    const subject = json?.result?.subject;
    if (!subject) {
      throw new BadRequestException('Nie znaleziono podmiotu dla podanego numeru NIP.');
    }

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
      zrodlo_danych: 'mf_fallback',
      data_pobrania_gus: new Date().toISOString(),
      raw: subject,
    };
  }
}