'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { Button } from '../../../../../../components/ProductUI';

function d(v: any) { return v ? new Date(v).toLocaleString('pl-PL') : '-'; }
function qty(v: any) { return Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function kg(v: any) { return Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function num(v: any) { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
function cat(p: any) { return p.model?.kategoria?.nazwa || p.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii'; }
function modelName(p: any) { return p.egzemplarz?.model?.nazwa || p.model?.nazwa || p.nazwa || 'Pozycja sprzętu'; }
function isCasePosition(p: any) {
  const type = String(p.model?.typ_sprzetu || p.egzemplarz?.model?.typ_sprzetu || p.typ_sprzetu || '').toLowerCase();
  const name = String(p.nazwa || p.model?.nazwa || p.egzemplarz?.model?.nazwa || '').toLowerCase();
  
  // Zestawy (nawet zbudowane technicznie z opakowań) idą w całości na dokument, nie są ukrywane!
  if (type === 'zestaw' || type === 'rack' || name.includes('zestaw') || name.includes('rack')) {
    return false;
  }
  
  return type === 'opakowanie';
}
function code(p: any) { return p.egzemplarz?.kod_kreskowy || p.egzemplarz?.zewnetrzny_kod_kreskowy || p.egzemplarz?.zewnetrzny_qr_kod || p.egzemplarz?.qr_kod || p.egzemplarz?.sn || p.model?.kod_kreskowy || ''; }
function issuerName(doc: any) { return [doc?.utworzyl?.imie, doc?.utworzyl?.nazwisko].filter(Boolean).join(' ') || doc?.utworzyl?.email || 'Zalogowany użytkownik'; }
function instanceLabel(p: any) {
  if (!p.egzemplarz) return p.nazwa || modelName(p);
  const e = p.egzemplarz;
  const number = e.numer_egzemplarza || e.numer_urzadzenia;
  const custom = p.nazwa && p.nazwa !== modelName(p) ? p.nazwa : null;
  return [custom || e.nazwa, number ? `nr ${number}` : null, e.sn ? `SN ${e.sn}` : null, code(p) ? `kod ${code(p)}` : null]
    .filter(Boolean)
    .join(' · ') || modelName(p);
}

// EVENTFLOW_PRODUCT_POLISH_V44: masa dokumentu = sprzęt + case, ale case liczymy tylko wtedy,
// gdy pozycje faktycznie powstały ze skanu case, a nie z pojedynczego skanu egzemplarza.
function equipmentWeightKg(p: any) {
  const amount = Math.max(num(p.ilosc), 0);
  const unit = num(p.egzemplarz?.waga) || num(p.egzemplarz?.model?.waga) || num(p.model?.waga);
  return unit * amount;
}
// EVENTFLOW_PRODUCT_POLISH_V45:
// Case zeskanowany jako skrót nie pojawia się w tabeli sprzętu, ale jego waga dolicza się do dokumentu.
// Techniczny marker z uwag ukrywamy przed użytkownikiem i klientem.
function hasCaseScanMarker(p: any) {
  const raw = String(p.uwagi || '');
  return raw.includes('__EVENTFLOW_CASE_SCAN:') || raw.includes('Zeskanowano case');
}
function cleanVisibleUwagi(raw: any) {
  return String(raw || '')
    .split('|')
    .map((x) => x.trim())
    .filter((x) => x && !x.includes('__EVENTFLOW_CASE_SCAN:') && !x.startsWith('Zeskanowano case'))
    .join(' | ');
}
function caseWeightKey(p: any) {
  const parentCase = p.egzemplarz?.case;
  if (!parentCase?.id || !hasCaseScanMarker(p)) return null;
  return String(parentCase.id);
}
function caseWeightKg(p: any) {
  const parentCase = p.egzemplarz?.case;
  return num(parentCase?.waga) || num(parentCase?.model?.waga);
}

export default function WarehouseDocumentPdfPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/magazyn/dokumenty/${id}`).then((r) => setDoc(r.data)).catch((e) => setError(e?.message || 'Nie udało się wczytać dokumentu.'));
  }, [id]);

  useEffect(() => {
    // EVENTFLOW_PRODUCT_POLISH_V42: wejście z przycisku "Drukuj" automatycznie otwiera okno druku
    // dopiero po wczytaniu danych dokumentu.
    if (!doc || searchParams.get('drukuj') !== '1') return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [doc, searchParams]);

  const groups = useMemo(() => {
    const positions = (doc?.pozycje || []).filter((p: any) => !isCasePosition(p));
    const categoryMap = new Map<string, any>();
    for (const p of positions) {
      const categoryName = cat(p);
      if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, { nazwa: categoryName, ilosc: 0, modele: new Map<string, any>() });
      const category = categoryMap.get(categoryName);
      const key = String(p.id_modelu || p.egzemplarz?.id_modelu || modelName(p));
      if (!category.modele.has(key)) {
        category.modele.set(key, {
          nazwa: modelName(p),
          ilosc: 0,
          egzemplarze: [],
          uwagi: [],
        });
      }
      const model = category.modele.get(key);
      model.ilosc += Number(p.ilosc || 0);
      category.ilosc += Number(p.ilosc || 0);
      if (p.id_egzemplarza || p.egzemplarz) model.egzemplarze.push(instanceLabel(p));
      else model.egzemplarze.push(`${qty(p.ilosc)} × ${p.nazwa || modelName(p)}`);
      { const visibleUwagi = cleanVisibleUwagi(p.uwagi); if (visibleUwagi) model.uwagi.push(visibleUwagi); }
    }
    return Array.from(categoryMap.values()).map((g: any) => ({ ...g, modele: Array.from(g.modele.values()) }));
  }, [doc]);

  const weightSummary = useMemo(() => {
    const positions = (doc?.pozycje || []).filter((p: any) => !isCasePosition(p));
    let sprzetKg = 0;
    const caseWeights = new Map<string, number>();
    for (const p of positions) {
      sprzetKg += equipmentWeightKg(p);
      const key = caseWeightKey(p);
      if (key && !caseWeights.has(key)) caseWeights.set(key, caseWeightKg(p));
    }
    const caseKg = Array.from(caseWeights.values()).reduce((sum, v) => sum + v, 0);
    return { sprzetKg, caseKg, totalKg: sprzetKg + caseKg, caseCount: caseWeights.size };
  }, [doc]);

  if (error) return <div className="p-10 font-bold text-red-600">{error}</div>;
  if (!doc) return <div className="p-10 font-bold text-slate-500">Ładowanie dokumentu...</div>;

  const title = doc.typ === 'przyjecie' ? 'Potwierdzenie przyjęcia sprzętu' : 'Potwierdzenie wydania sprzętu';
  const totalQty = groups.reduce((sum: number, g: any) => sum + Number(g.ilosc || 0), 0);

  return <div className="eventflow-pdf-page min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
    <style jsx global>{`
      /* EVENTFLOW_PRODUCT_POLISH_V43/V44
         Druk WZ/PZ ma działać jak prawdziwy dokument A4: bez skalowania całego dashboardu,
         z naturalnym łamaniem na kolejne kartki, zachowaniem kolorów i czytelnymi podpisami. */
      .eventflow-pdf-sheet,
      .eventflow-pdf-sheet * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .eventflow-pdf-category-title {
        background: #fb8500;
        color: #ffffff;
      }
      .eventflow-pdf-summary-card,
      .eventflow-pdf-table-head {
        background: #f1f5f9;
      }
      .eventflow-pdf-signatures {
        margin-top: 18mm;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18mm;
        align-items: end;
      }
      .eventflow-pdf-signature-block {
        min-height: 36mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }
      .eventflow-pdf-signature-title {
        margin-bottom: 16mm;
        font-size: 12px;
        font-weight: 900;
      }
      .eventflow-pdf-signature-line {
        border-top: 1.5px solid #0f172a;
        width: 100%;
      }
      .eventflow-pdf-signature-name {
        min-height: 9mm;
        padding-top: 3mm;
        text-align: center;
        font-size: 12px;
        font-weight: 900;
      }
      .eventflow-pdf-signature-placeholder {
        letter-spacing: 1px;
        font-weight: 700;
      }
      @media screen and (max-width: 760px) {
        .eventflow-pdf-signatures { grid-template-columns: 1fr; }
      }
      @media print {
        @page { size: A4 portrait; margin: 11mm; }
        html, body {
          width: auto !important;
          height: auto !important;
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        .eventflow-pdf-page {
          display: block !important;
          width: auto !important;
          min-height: 0 !important;
          background: #ffffff !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        .eventflow-pdf-toolbar { display: none !important; }
        .eventflow-pdf-sheet {
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
        .eventflow-pdf-header,
        .eventflow-pdf-meta,
        .eventflow-pdf-summary,
        .eventflow-pdf-signatures,
        .eventflow-pdf-signature-block {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .eventflow-pdf-signatures {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 18mm !important;
          margin-top: 16mm !important;
        }
        .eventflow-pdf-signature-title { margin-bottom: 15mm !important; }
        .eventflow-pdf-category {
          break-inside: auto;
          page-break-inside: auto;
          margin-bottom: 8mm !important;
        }
        .eventflow-pdf-category-title {
          break-after: avoid;
          page-break-after: avoid;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          background: #fb8500 !important;
          color: #ffffff !important;
        }
        .eventflow-pdf-summary-card,
        .eventflow-pdf-table-head {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          background: #f1f5f9 !important;
        }
        table { page-break-inside: auto; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr, td, th {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        img { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
    <div className="eventflow-pdf-toolbar mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
      <Button onClick={() => window.print()}>Drukuj / zapisz PDF</Button>
      <Button variant="secondary" onClick={() => window.close()}>Zamknij</Button>
    </div>

    <main className="eventflow-pdf-sheet mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-[12mm] text-slate-900 shadow-xl print:shadow-none">
      <header className="eventflow-pdf-header mb-10 grid grid-cols-2 gap-8">
        <div>
          <img src="/eventflow-logo.svg" alt="EventFlow" className="mb-6 h-16" />
          <p className="text-sm font-bold">{doc.organizacja?.nazwa || 'EventFlow'}</p>
          <p className="text-xs text-slate-500">Dokument magazynowy wygenerowany z systemu EventFlow</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black uppercase leading-tight">{title}</h1>
          <p className="mt-2 text-sm">Numer: <b>{doc.numer}</b></p>
          <p className="text-sm">Data: <b>{d(doc.data_operacji)}</b></p>
          <p className="text-sm">Wystawił: <b>{issuerName(doc)}</b></p>
        </div>
      </header>

      <section className="eventflow-pdf-meta mb-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <h2 className="mb-2 border-b pb-1 font-black uppercase text-slate-500">Wydarzenie / wynajem</h2>
          <p className="font-black">{doc.wydarzenie?.nazwa || (doc.wynajem?.numer ? `Wynajem ${doc.wynajem.numer}` : '-')}</p>
          <p>{doc.wydarzenie?.kontrahent?.nazwa || doc.wynajem?.kontrahent?.nazwa || ''}</p>
          <p>{doc.wynajem?.numer ? `Wynajem: ${doc.wynajem.numer}` : ''}</p>
        </div>
        <div>
          <h2 className="mb-2 border-b pb-1 font-black uppercase text-slate-500">Odbiór / zdanie</h2>
          <p>{doc.id_wynajmu ? 'Osoba:' : 'Z konta:'} <b>{doc.id_wynajmu ? (doc.osoba_odbierajaca || '-') : issuerName(doc)}</b></p>
          <p>Uwagi: <b>{doc.uwagi || '-'}</b></p>
        </div>
      </section>

      <section className="eventflow-pdf-summary mb-8 grid grid-cols-4 gap-3 text-sm">
        <div className="eventflow-pdf-summary-card rounded-xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Suma</p><p className="text-2xl font-black">{qty(totalQty)} szt.</p></div>
        <div className="eventflow-pdf-summary-card rounded-xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Kategorie</p><p className="text-2xl font-black">{groups.length}</p></div>
        <div className="eventflow-pdf-summary-card rounded-xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Modele</p><p className="text-2xl font-black">{groups.reduce((s: number, g: any) => s + g.modele.length, 0)}</p></div>
        <div className="eventflow-pdf-summary-card rounded-xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Waga razem</p><p className="text-2xl font-black">{kg(weightSummary.totalKg)} kg</p><p className="mt-1 text-[10px] font-bold text-slate-500">sprzęt {kg(weightSummary.sprzetKg)} kg{weightSummary.caseCount ? ` + case ${kg(weightSummary.caseKg)} kg` : ''}</p></div>
      </section>

      {groups.map((group: any) => <section key={group.nazwa} className="eventflow-pdf-category mb-7">
        <h2 className="eventflow-pdf-category-title mb-2 rounded bg-orange-400 px-3 py-2 text-sm font-black text-white">
          {group.nazwa} <span className="float-right">{qty(group.ilosc)} szt.</span>
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="eventflow-pdf-table-head bg-slate-100 text-left">
              <th className="p-2">Lp.</th>
              <th className="p-2">Model</th>
              <th className="p-2">Numery / nazwy egzemplarzy</th>
              <th className="p-2 text-right">Ilość</th>
              <th className="p-2">Uwagi</th>
            </tr>
          </thead>
          <tbody>
            {group.modele.map((m: any, idx: number) => <tr key={`${m.nazwa}-${idx}`} className="border-b align-top">
              <td className="p-2">{idx + 1}</td>
              <td className="p-2 font-bold">{m.nazwa}</td>
              <td className="p-2 text-slate-700">{m.egzemplarze.map((e: string, i: number) => <div key={`${e}-${i}`}>{e}</div>)}</td>
              <td className="p-2 text-right font-black">{qty(m.ilosc)}</td>
              <td className="p-2 text-slate-500">{Array.from(new Set(m.uwagi)).join(' | ')}</td>
            </tr>)}
          </tbody>
        </table>
      </section>)}

      <div className="eventflow-pdf-signatures">
        <div className="eventflow-pdf-signature-block">
          <p className="eventflow-pdf-signature-title">Podpis wydającego</p>
          <div className="eventflow-pdf-signature-line" />
          <div className="eventflow-pdf-signature-name">{issuerName(doc)}</div>
        </div>
        <div className="eventflow-pdf-signature-block">
          <p className="eventflow-pdf-signature-title">Podpis odbierającego / zdającego</p>
          <div className="eventflow-pdf-signature-line" />
          <div className="eventflow-pdf-signature-name eventflow-pdf-signature-placeholder">{doc.podpis_odbierajacego || '................................................'}</div>
        </div>
      </div>
    </main>
  </div>;
}
