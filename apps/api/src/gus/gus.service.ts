import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class GusService {
  async lookupByNip(rawNip: string) {
    const nip = String(rawNip || '').replace(/\D/g, '');
    if (nip.length !== 10) throw new BadRequestException('NIP musi mieć 10 cyfr');

    // EVENTFLOW_PRODUCT_POLISH_V3:
    // Gotowa integracja do automatycznego uzupełniania kontrahenta po NIP.
    // Używamy publicznego rejestru MF jako bezkluczowego fallbacku. Jeżeli wdrożycie
    // oficjalne BIR/GUS, wystarczy podmienić wnętrze tej metody bez zmian na froncie.
    const date = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
    const response = await fetch(url);
    if (!response.ok) throw new BadRequestException('Nie udało się pobrać danych z rejestru');
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
      zrodlo_danych: 'gus',
      data_pobrania_gus: new Date().toISOString(),
      raw: subject,
    };
  }
}
