'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { Button } from '../../../../../components/ProductUI';

function money(value: any) {
  return `${Number(value || 0).toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function date(value: any, withTime = false) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: withTime ? '2-digit' : undefined,
    minute: withTime ? '2-digit' : undefined,
  });
}

function text(value: any, fallback = '-') {
  const v = value === null || value === undefined ? '' : String(value).trim();
  return v || fallback;
}

function asNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function lineWeight(p: any) {
  const unitWeight = asNumber(p.model?.waga, 0);
  return unitWeight * asNumber(p.ilosc, 1);
}

function formatKg(val: number) {
  return val > 0 ? `${val.toFixed(2)} kg` : '-';
}

function lineNetto(p: any) {
  const saved = asNumber(p.razem_netto, 0);
  if (saved > 0) return saved;
  const cena = asNumber(p.cena_netto, 0);
  const ilosc = asNumber(p.ilosc, 1);
  const dni = asNumber(p.dni_pracy, 1);
  const rabat = asNumber(p.rabat_proc, 0);
  return cena * ilosc * dni * (1 - rabat / 100);
}

function lineVat(p: any) {
  const saved = asNumber(p.razem_vat, 0);
  if (saved > 0) return saved;
  return lineNetto(p) * (asNumber(p.vat, 23) / 100);
}

function lineBrutto(p: any) {
  const saved = asNumber(p.razem_brutto, 0);
  if (saved > 0) return saved;
  return lineNetto(p) + lineVat(p);
}

function visiblePositions(section: any) {
  return (section?.pozycje || [])
    .filter((p: any) => p?.aktywny !== false)
    .filter((p: any) => p?.widoczna_w_pdf !== false);
}

function sectionTotal(section: any) {
  return visiblePositions(section).reduce((sum: number, p: any) => sum + lineNetto(p), 0);
}

export default function OfferPdfPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Konfiguracja widoku z parametrów URL przysłanych z okna drukowania na ofercie
  const showUnitPrices = searchParams.get('showUnitPrices') !== 'false';
  const showDiscounts = searchParams.get('showDiscounts') !== 'false';
  const showDays = searchParams.get('showDays') !== 'false';
  const showSectionSummary = searchParams.get('showSectionSummary') !== 'false';
  const showThumbnails = searchParams.get('showThumbnails') === 'true';
  const showWeight = searchParams.get('showWeight') === 'true';
  const showVat = searchParams.get('showVat') === 'true';
  const showSummaryNetto = searchParams.get('showSummaryNetto') !== 'false';
  const showSummaryVat = searchParams.get('showSummaryVat') !== 'false';
  const showSummaryBrutto = searchParams.get('showSummaryBrutto') !== 'false';

  // Pozycje z ukrytą ceną
  const hiddenPriceIds = useMemo(() => {
    const raw = searchParams.get('hiddenPriceIds') || '';
    if (!raw) return new Set<number>();
    return new Set(
      raw
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n))
    );
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api
      .get(`/api/oferty/${id}`)
      .then((response) => setOffer(response.data))
      .catch((err) => setError(err?.response?.data?.message || err.message || 'Nie udało się pobrać oferty.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!offer || searchParams.get('drukuj') !== '1') return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [offer, searchParams]);

  const sections = useMemo(() => {
    const raw = offer?.wersje?.[0]?.sekcje || [];
    return raw
      .filter((section: any) => section?.aktywny !== false)
      .filter((section: any) => section?.widoczna_w_pdf !== false)
      .map((section: any) => ({ ...section, pozycje: visiblePositions(section) }))
      .filter((section: any) => section.pozycje.length > 0 || section.opis);
  }, [offer]);

  const summary = useMemo(() => {
    const positions = sections.flatMap((section: any) => section.pozycje || []);
    const netto = positions.reduce((sum: number, p: any) => sum + lineNetto(p), 0);
    const vat = positions.reduce((sum: number, p: any) => sum + lineVat(p), 0);
    const brutto = positions.reduce((sum: number, p: any) => sum + lineBrutto(p), 0);
    return { netto, vat, brutto };
  }, [sections]);

  const hasAnyDiscount = useMemo(() => {
    return sections.some((s: any) => s.pozycje.some((p: any) => Number(p.rabat_proc) > 0 || Number(p.rabat_netto) > 0));
  }, [sections]);

  const actuallyShowDiscounts = showDiscounts && hasAnyDiscount;

  if (loading) return <div className="p-10 font-bold text-slate-500">Ładowanie oferty...</div>;
  if (error) return <div className="p-10 font-bold text-red-700">{error}</div>;
  if (!offer) return <div className="p-10 font-bold text-slate-500">Nie znaleziono oferty.</div>;

  const version = offer.wersje?.[0];
  const issueDate = offer.data_sporzadzenia || offer.data_utworzenia || new Date();
  const event = offer.wydarzenie;
  const client = offer.kontrahent;

  return (
    <div className="eventflow-offer-pdf-page min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <style jsx global>{`
        .eventflow-offer-pdf-sheet,
        .eventflow-offer-pdf-sheet * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
          box-sizing: border-box;
        }
        .eventflow-offer-pdf-page {
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
        }
        .eventflow-offer-pdf-section-title {
          color: #ffffff;
        }
        .eventflow-offer-pdf-table-head,
        .eventflow-offer-pdf-summary-card,
        .eventflow-offer-pdf-terms {
          background: #f1f5f9;
        }
        .eventflow-offer-pdf-footer {
          margin-top: 10mm;
          padding-top: 3mm;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #94a3b8;
          font-size: 10px;
        }
        .eventflow-offer-pdf-section {
          break-inside: auto;
          page-break-inside: auto;
        }
        .eventflow-offer-pdf-section-title {
          break-after: avoid;
          page-break-after: avoid;
        }
        .eventflow-offer-pdf-table {
          width: 100%;
          border-collapse: collapse;
        }
        .eventflow-offer-pdf-table th,
        .eventflow-offer-pdf-table td {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .eventflow-offer-pdf-table th {
          padding: 8px;
          color: #475569;
          font-size: 10px;
          font-weight: 900;
          text-align: left;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
        }
        .eventflow-offer-pdf-table td {
          padding: 8px;
          vertical-align: top;
          font-size: 11px;
          line-height: 1.35;
          border-bottom: 1px solid #edf2f7;
        }
        .eventflow-offer-pdf-table tr:last-child td {
          border-bottom: 0;
        }
        .eventflow-offer-pdf-item-name {
          font-weight: 900;
          color: #0f172a;
        }
        .eventflow-offer-pdf-item-meta {
          margin-top: 3px;
          color: #64748b;
          font-size: 9.5px;
        }
        .eventflow-offer-pdf-text-right {
          text-align: right !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 11mm;
          }
          html,
          body {
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          .eventflow-offer-pdf-page {
            display: block !important;
            width: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          .eventflow-offer-pdf-toolbar {
            display: none !important;
          }
          .eventflow-offer-pdf-sheet {
            display: block !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .eventflow-offer-pdf-header,
          .eventflow-offer-pdf-meta,
          .eventflow-offer-pdf-summary,
          .eventflow-offer-pdf-terms {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .eventflow-offer-pdf-section {
            margin-bottom: 8mm !important;
          }
          .eventflow-offer-pdf-section-title {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #ffffff !important;
          }
          .eventflow-offer-pdf-table-head,
          .eventflow-offer-pdf-summary-card,
          .eventflow-offer-pdf-terms {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #f1f5f9 !important;
          }
          table {
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          tr,
          td,
          th,
          img {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* PASEK AKCJI */}
      <div className="eventflow-offer-pdf-toolbar mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
        <Button onClick={() => window.print()}>Drukuj / zapisz jako PDF</Button>
        <Button variant="secondary" onClick={() => window.close()}>Zamknij</Button>
      </div>

      {/* ARKUSZ A4 */}
      <main className="eventflow-offer-pdf-sheet mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-[12mm] text-slate-900 shadow-xl print:shadow-none">
        <header className="eventflow-offer-pdf-header mb-10 grid grid-cols-2 gap-8">
          <div>
            <img
              src={offer.organizacja?.logo || "/eventflow-logo.svg"}
              alt={offer.organizacja?.nazwa || "Logo firmy"}
              className="mb-6 max-h-16 max-w-[260px] object-contain object-left"
            />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black uppercase leading-tight">Oferta</h1>
            <p className="mt-2 text-sm">Numer: <b>{text(offer.numer)}</b></p>
            <p className="text-sm">Data: <b>{date(issueDate)}</b></p>
            <p className="text-sm">Wersja: <b>{version?.numer_wersji ? `v${version.numer_wersji}` : 'v1'}</b></p>
            <p className="text-sm">Termin płatności: <b>{offer.termin_platnosci_dni || 14} dni</b></p>
          </div>
        </header>

        <section className="eventflow-offer-pdf-meta mb-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <h2 className="mb-2 border-b pb-1 font-black uppercase text-slate-500">Klient</h2>
            <p className="font-black">{text(client?.nazwa)}</p>
            {client?.nip && <p>NIP: {client.nip}</p>}
            {client?.adres && <p>{client.adres}</p>}
            {client?.email && <p>{client.email}</p>}
          </div>
          <div>
            <h2 className="mb-2 border-b pb-1 font-black uppercase text-slate-500">
              {offer.wynajem ? 'Wypożyczenie' : 'Wydarzenie'}
            </h2>
            <p className="font-black">
              {text(event?.nazwa || (offer.wynajem ? `Wypożyczenie ${offer.wynajem.numer}` : 'Brak przypisania'))}
            </p>
            {event?.data_start && <p>Start: {date(event.data_start, true)}</p>}
            {event?.data_koniec && <p>Koniec: {date(event.data_koniec, true)}</p>}
            {(event?.miejsce?.nazwa || event?.miejsce_reczne) && (
              <p>Miejsce: {text(event.miejsce?.nazwa || event.miejsce_reczne)}</p>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 border-b pb-1 font-black uppercase text-slate-500">Nazwa oferty</h2>
          <p className="text-lg font-black">{text(offer.nazwa, 'Oferta')}</p>
        </section>

        {/* GRUPY SPRZĘTOWE */}
        {sections.map((section: any) => (
          <section className="eventflow-offer-pdf-section mb-7" key={section.id || section.nazwa}>
            <div
              className="eventflow-offer-pdf-section-title mb-2 flex items-start justify-between gap-4 rounded px-3 py-2 text-sm font-black text-white"
              style={{ background: section.kolor || '#fb8500' }}
            >
              <div>
                <h2 className="m-0 text-sm font-black">{text(section.nazwa, 'Sekcja')}</h2>
                {section.opis && <p className="mt-1 text-[10px] font-medium opacity-90">{section.opis}</p>}
              </div>
              {showSectionSummary && <div className="whitespace-nowrap">{money(sectionTotal(section))}</div>}
            </div>
            <table className="eventflow-offer-pdf-table">
              <thead>
                <tr className="eventflow-offer-pdf-table-head">
                  {showThumbnails && <th style={{ width: '50px' }}>Foto</th>}
                  <th style={{ width: showThumbnails ? '32%' : '40%' }}>Pozycja</th>
                  <th>Opis</th>
                  {showWeight && <th className="eventflow-offer-pdf-text-right">Waga</th>}
                  {showUnitPrices && <th className="eventflow-offer-pdf-text-right">Cena</th>}
                  <th className="eventflow-offer-pdf-text-right">Ilość</th>
                  {showDays && <th className="eventflow-offer-pdf-text-right">Dni</th>}
                  {actuallyShowDiscounts && <th className="eventflow-offer-pdf-text-right">Rabat</th>}
                  {showVat && <th className="eventflow-offer-pdf-text-right">VAT%</th>}
                  <th className="eventflow-offer-pdf-text-right">Netto</th>
                </tr>
              </thead>
              <tbody>
                {section.pozycje.map((p: any) => {
                  const isPriceHidden = hiddenPriceIds.has(Number(p.id));

                  return (
                    <tr key={p.id || `${section.id}-${p.nazwa}`}>
                      {showThumbnails && (
                        <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                          {p.model?.zdjecie ? (
                            <img
                              src={p.model.zdjecie}
                              alt=""
                              style={{
                                width: '42px',
                                height: '32px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #dbe4ea',
                              }}
                            />
                          ) : null}
                        </td>
                      )}
                      <td>
                        <div className="eventflow-offer-pdf-item-name">{text(p.nazwa)}</div>
                        <div className="eventflow-offer-pdf-item-meta">
                          {/* {text(p.typ_pozycji, 'pozycja')} */}
                          {/* {p.model?.nazwa ? ` • ${p.model.nazwa}` : ''}
                          {p.kategoria?.nazwa ? ` • ${p.kategoria.nazwa}` : ''} */}
                        </div>
                      </td>
                      <td>{text(p.opis || p.uwagi, '')}</td>
                      {showWeight && (
                        <td className="eventflow-offer-pdf-text-right">{formatKg(lineWeight(p))}</td>
                      )}
                      {showUnitPrices && (
                        <td className="eventflow-offer-pdf-text-right">
                          {isPriceHidden ? '-' : money(p.cena_netto)}
                        </td>
                      )}
                      <td className="eventflow-offer-pdf-text-right font-bold">
                        {asNumber(p.ilosc, 1)} {p.model?.jednostka || 'szt.'}
                      </td>
                      {showDays && (
                        <td className="eventflow-offer-pdf-text-right">{asNumber(p.dni_pracy, 1)}</td>
                      )}
                      {actuallyShowDiscounts && (
                        <td className="eventflow-offer-pdf-text-right">
                          {isPriceHidden ? '-' : (asNumber(p.rabat_proc, 0) > 0 ? `${asNumber(p.rabat_proc, 0)}%` : '-')}
                        </td>
                      )}
                      {showVat && (
                        <td className="eventflow-offer-pdf-text-right">{asNumber(p.vat, 23)}%</td>
                      )}
                      <td className="eventflow-offer-pdf-text-right">
                        <strong>{isPriceHidden ? '-' : money(lineNetto(p))}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        {sections.length === 0 && (
          <section className="eventflow-offer-pdf-section mb-7">
            <div className="eventflow-offer-pdf-section-title mb-2 rounded bg-slate-700 px-3 py-2 text-sm font-black text-white">
              Brak widocznych pozycji
            </div>
            <div className="p-4 text-xs text-slate-500">
              Oferta nie ma pozycji oznaczonych jako widoczne w PDF.
            </div>
          </section>
        )}

        {/* WARUNKI ORAZ STOPKA PODSUMOWANIA */}
        <section className="eventflow-offer-pdf-summary mt-8 grid grid-cols-[1fr_320px] gap-6 text-sm">
          <div className="eventflow-offer-pdf-terms rounded-xl bg-slate-100 p-4">
            <h2 className="mb-2 font-black uppercase text-slate-500">Warunki i uwagi</h2>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {text(
                offer.warunki_zamowienia,
                'Oferta ważna zgodnie z ustaleniami handlowymi. Zakres, terminy i dostępność sprzętu wymagają potwierdzenia przed realizacją.'
              )}
            </div>
          </div>
          <div className="space-y-2">
            {showSummaryNetto && (
              <div className="eventflow-offer-pdf-summary-card flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                <span className="text-xs font-black uppercase text-slate-500">Razem netto</span>
                <strong>{money(summary.netto)}</strong>
              </div>
            )}
            {showSummaryVat && (
              <div className="eventflow-offer-pdf-summary-card flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                <span className="text-xs font-black uppercase text-slate-500">VAT</span>
                <strong>{money(summary.vat)}</strong>
              </div>
            )}
            {showSummaryBrutto && (
              <div className="rounded-xl bg-slate-100 px-4 py-4 text-white">
                <p className="text-xs font-black uppercase opacity-70 text-slate-500">Razem brutto</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{money(summary.brutto)}</p>
              </div>
            )}
            {asNumber(offer.rabat_budzetowy_netto) > 0 && (
              <div className="eventflow-offer-pdf-summary-card flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                <span className="text-xs font-black uppercase text-slate-500">Dodatkowy Rabat</span>
                <strong>{money(offer.rabat_budzetowy_netto)}</strong>
              </div>
            )}
          </div>
        </section>

        <footer className="eventflow-offer-pdf-footer mt-10 flex justify-between gap-4 border-t pt-3 text-[10px] font-bold text-slate-400">
          <span>Ofertę wygenerowano w systemie EventFlow.</span>
          <span>{text(offer.numer)} • {date(new Date())}</span>
        </footer>
      </main>
    </div>
  );
}