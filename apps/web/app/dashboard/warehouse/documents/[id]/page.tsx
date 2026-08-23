'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, FileText, Printer } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card } from '../../../../../components/ProductUI';

function d(v: any) { return v ? new Date(v).toLocaleString('pl-PL') : '-'; }
function qty(v: any) { return Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function kg(v: any) { return Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function num(v: any) { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
function cat(p: any) { return p.model?.kategoria?.nazwa || p.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii'; }
function modelName(p: any) { return p.egzemplarz?.model?.nazwa || p.model?.nazwa || p.nazwa || 'Pozycja sprzętu'; }
function code(p: any) { return p.egzemplarz?.kod_kreskowy || p.egzemplarz?.zewnetrzny_kod_kreskowy || p.egzemplarz?.zewnetrzny_qr_kod || p.egzemplarz?.qr_kod || p.egzemplarz?.sn || p.model?.kod_kreskowy || ''; }
function issuerName(doc: any) { return [doc?.utworzyl?.imie, doc?.utworzyl?.nazwisko].filter(Boolean).join(' ') || doc?.utworzyl?.email || 'Zalogowany użytkownik'; }
function docVerb(doc: any) { return doc?.typ === 'przyjecie' ? 'przyjęto' : 'wydano'; }
function docAdjective(doc: any) { return doc?.typ === 'przyjecie' ? 'przyjętego' : 'wydanego'; }
function docTitle(doc: any) { return doc?.typ === 'przyjecie' ? 'Pomyślnie przyjęto sprzęt' : 'Pomyślnie wydano sprzęt'; }
function instanceLabel(p: any) {
  if (!p.egzemplarz) return `${qty(p.ilosc)} × ${p.nazwa || modelName(p)}${code(p) ? ` · kod ${code(p)}` : ''}`;
  const e = p.egzemplarz;
  const number = e.numer_egzemplarza || e.numer_urzadzenia;
  const custom = p.nazwa && p.nazwa !== modelName(p) ? p.nazwa : null;
  return [custom || e.nazwa, number ? `nr ${number}` : null, e.sn ? `SN ${e.sn}` : null, code(p) ? `kod ${code(p)}` : null]
    .filter(Boolean)
    .join(' · ') || modelName(p);
}
function isCasePosition(p: any) {
  const type = String(p.model?.typ_sprzetu || p.egzemplarz?.model?.typ_sprzetu || p.typ_sprzetu || '').toLowerCase();
  const name = String(p.nazwa || p.model?.nazwa || p.egzemplarz?.model?.nazwa || '').toLowerCase();
  
  // Zestawy (nawet zbudowane technicznie z opakowań) idą w całości na dokument, nie są ukrywane!
  if (type === 'zestaw' || type === 'rack' || name.includes('zestaw') || name.includes('rack')) {
    return false;
  }
  
  return type === 'opakowanie';
}
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

export default function WarehouseDocumentSuccessPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/magazyn/dokumenty/${id}`)
      .then((r) => setDoc(r.data))
      .catch((e) => setError(e?.response?.data?.message || e?.message || 'Nie udało się wczytać dokumentu magazynowego.'));
  }, [id]);

  const groups = useMemo(() => {
    const categoryMap = new Map<string, any>();
    for (const p of (doc?.pozycje || []).filter((row: any) => !isCasePosition(row))) {
      const categoryName = cat(p);
      if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, { nazwa: categoryName, ilosc: 0, modele: new Map<string, any>() });
      const category = categoryMap.get(categoryName);
      const key = String(p.id_modelu || p.egzemplarz?.id_modelu || modelName(p));
      if (!category.modele.has(key)) category.modele.set(key, { nazwa: modelName(p), ilosc: 0, egzemplarze: [], uwagi: [] });
      const model = category.modele.get(key);
      const amount = Number(p.ilosc || 0);
      model.ilosc += amount;
      category.ilosc += amount;
      model.egzemplarze.push(instanceLabel(p));
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

  if (error) return <div className="mx-auto max-w-5xl p-8"><Card className="border-red-200 bg-red-50 text-red-700"><b>Błąd dokumentu</b><p className="mt-2 text-sm font-bold">{error}</p></Card></div>;
  if (!doc) return <div className="p-10 font-bold text-slate-500">Ładowanie potwierdzenia...</div>;

  const totalQty = groups.reduce((sum: number, g: any) => sum + Number(g.ilosc || 0), 0);
  const isRental = !!doc.id_wynajmu;
  const isEvent = !!doc.id_wydarzenia;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"><ArrowLeft size={16} /> Powrót</button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={28} /></div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#04e0ff]">Magazyn · dokument {doc.typ === 'przyjecie' ? 'PZ' : 'WZ'}</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">{docTitle(doc)}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">Dokument <b>{doc.numer}</b> został zapisany. Poniżej masz czytelną listę sprzętu oraz PDF do druku dla klienta.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/warehouse/documents/${doc.id}/pdf`} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-[#04e0ff] px-4 py-2 text-sm font-black text-white hover:bg-cyan-700"><Download size={16} /> PDF do druku</Link>
        <Button variant="secondary" onClick={() => window.open(`/dashboard/warehouse/documents/${doc.id}/pdf?drukuj=1`, '_blank')}><Printer size={16} className="inline" /> Drukuj</Button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-5">
      <Card><p className="text-xs font-black uppercase text-slate-400">Numer</p><p className="mt-1 text-lg font-black">{doc.numer}</p></Card>
      <Card><p className="text-xs font-black uppercase text-slate-400">Data</p><p className="mt-1 text-lg font-black">{d(doc.data_operacji)}</p></Card>
      <Card><p className="text-xs font-black uppercase text-slate-400">Łącznie</p><p className="mt-1 text-xl font-black">{qty(totalQty)} szt.</p></Card>
      <Card><p className="text-xs font-black uppercase text-slate-400">Waga</p><p className="mt-1 text-xl font-black">{kg(weightSummary.totalKg)} kg</p><p className="mt-1 text-[11px] font-bold text-slate-400">sprzęt + case</p></Card>
      <Card><p className="text-xs font-black uppercase text-slate-400">Wystawił / podpisał</p><p className="mt-1 text-lg font-black">{issuerName(doc)}</p></Card>
    </div>

    <Card className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Powiązanie</p>
          <p className="mt-1 text-lg font-black text-slate-900">{isEvent ? doc.wydarzenie?.nazwa : isRental ? (doc.wynajem?.numer || `Wynajem #${doc.id_wynajmu}`) : 'Dokument magazynowy bez powiązania'}</p>
          {doc.wydarzenie?.kontrahent?.nazwa && <p className="text-sm font-bold text-slate-500">{doc.wydarzenie.kontrahent.nazwa}</p>}
          {doc.wynajem?.kontrahent?.nazwa && <p className="text-sm font-bold text-slate-500">{doc.wynajem.kontrahent.nazwa}</p>}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Odbiór / zdanie</p>
          {isRental ? <p className="mt-1 text-lg font-black text-slate-900">{doc.osoba_odbierajaca || 'Nie wpisano osoby odbierającej'}</p> : <p className="mt-1 text-lg font-black text-slate-900">Sprzęt {docVerb(doc)} z konta: {issuerName(doc)}</p>}
          <p className="text-sm font-bold text-slate-500">{doc.uwagi || 'Brak uwag'}</p>
          <p className="mt-2 text-xs font-black uppercase tracking-wider text-slate-400">Waga łączna</p>
          <p className="text-sm font-bold text-slate-600">{kg(weightSummary.totalKg)} kg — sprzęt {kg(weightSummary.sprzetKg)} kg{weightSummary.caseCount ? ` + case ${kg(weightSummary.caseKg)} kg` : ''}</p>
        </div>
      </div>
    </Card>

    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900">Lista {docAdjective(doc)} sprzętu</h2>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">{groups.length} kategorii</span>
      </div>
      <div className="space-y-5">
        {groups.map((group: any) => <div key={group.nazwa} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <b className="text-slate-900">{group.nazwa}</b>
            <span className="text-sm font-black text-slate-500">{qty(group.ilosc)} szt.</span>
          </div>
          <div className="divide-y divide-slate-100">
            {group.modele.map((m: any, idx: number) => <div key={`${m.nazwa}-${idx}`} className="grid gap-3 p-4 md:grid-cols-[1fr_120px]">
              <div>
                <p className="font-black text-slate-900">{m.nazwa}</p>
                <div className="mt-2 space-y-1 text-sm font-bold text-slate-500">
                  {m.egzemplarze.map((e: string, i: number) => <p key={`${e}-${i}`}><FileText size={13} className="mr-1 inline" />{e}</p>)}
                </div>
                {m.uwagi.length > 0 && <p className="mt-2 text-xs font-bold text-slate-400">Uwagi: {Array.from(new Set(m.uwagi)).join(' | ')}</p>}
              </div>
              <div className="text-right text-xl font-black text-slate-900">{qty(m.ilosc)} szt.</div>
            </div>)}
          </div>
        </div>)}
        {!groups.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Brak pozycji na dokumencie.</p>}
      </div>
    </Card>
  </div>;
}
