'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, PackageCheck, QrCode, Search, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';

function d(v: any) { return v ? new Date(v).toLocaleString('pl-PL') : '-'; }
function itemName(item: any) { return item?.nazwa || item?.model?.nazwa || item?.egzemplarz?.nazwa || 'Pozycja sprzętu'; }
function docTypeLabel(t: string) { return t === 'przyjecie' ? 'Przyjęcie' : t === 'plan' ? 'Plan sprzętu' : 'Wydanie'; }

export default function ReceivingPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [active, setActive] = useState<'wydanie' | 'przyjecie'>('wydanie');
  const [query, setQuery] = useState('');
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ typ: 'wydanie', data_operacji: new Date().toISOString().slice(0, 16) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const [docs, i, e, r] = await Promise.all([
      api.get('/api/magazyn/dokumenty').catch(() => ({ data: [] })),
      api.get('/api/magazyn/wszystkie-egzemplarze').catch(() => ({ data: [] })),
      api.get('/api/wydarzenia').catch(() => ({ data: [] })),
      api.get('/api/wynajmy').catch(() => ({ data: [] })),
    ]);
    setDocuments(docs.data || []);
    setItems(i.data || []);
    setEvents(e.data || []);
    setRentals(r.data || []);
  }
  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = items.filter((x: any) => x.model?.typ_sprzetu !== 'opakowanie');
    if (!q) return visible.slice(0, 40);
    return visible.filter((x: any) => `${x.nazwa || ''} ${x.model?.nazwa || ''} ${x.sn || ''} ${x.kod_kreskowy || ''} ${x.qr_kod || ''} ${x.zewnetrzny_kod_kreskowy || ''} ${x.zewnetrzny_qr_kod || ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [items, query]);


  function caseScanMeta(row: any) {
    if (!row) return null;
    return {
      id: row.id || row.id_egzemplarza,
      nazwa: row.nazwa || row.nazwa_modelu || 'Case',
      kod: row.kod || row.kod_kreskowy || '',
    };
  }

  function addItem(item: any) {
    if (item?.model?.typ_sprzetu === 'opakowanie' && item?.rowType !== 'case') {
      setError('Case/opakowanie nie może być pozycją dokumentu. Zeskanuj case, aby automatycznie dodać sprzęt ze środka.');
      return;
    }

    if (item?.isCase || item?.rowType === 'case') {
      const contents = item.contents || item.zawartosc_case || [];
      if (!contents.length) {
        setError('Ten case jest pusty albo nie ma aktywnych egzemplarzy w środku.');
        return;
      }
      const meta = caseScanMeta(item);
      setNotice(item.message || `Dodano ${contents.length} egzemplarzy z wnętrza case.`);
      contents.forEach((child: any) => addItem({ ...child, system_case_scan: meta, id_zeskanowanego_case: meta?.id, nazwa_zeskanowanego_case: meta?.nazwa }));
      return;
    }

    const idEgzemplarza = item.id_egzemplarza || item.id;
    if (!idEgzemplarza) {
      setError('Do dokumentu można dodać tylko konkretny egzemplarz sprzętu, nie model ani pozycję.');
      return;
    }

    const modelName = item.nazwa_modelu || item.model?.nazwa || itemName(item);
    const number = item.numer_egzemplarza || item.numer_urzadzenia || '';
    const displayName = [modelName, item.nazwa && item.nazwa !== modelName ? item.nazwa : null, number ? `nr ${number}` : null].filter(Boolean).join(' | ');

    setSelected((prev) => {
      const idx = prev.findIndex((p) => p.id_egzemplarza === idEgzemplarza);
      if (idx >= 0) {
        setNotice('Ten egzemplarz jest już dodany do dokumentu.');
        return prev;
      }
      return [...prev, {
        id_egzemplarza: idEgzemplarza,
        id_modelu: item.id_modelu || item.model?.id,
        nazwa: displayName || itemName(item),
        nazwa_modelu: modelName,
        numer_egzemplarza: number,
        kategoria: item.kategoria || item.model?.kategoria?.nazwa || 'Bez kategorii',
        ilosc: 1,
        status: active === 'przyjecie' ? 'przyjety' : 'wydany',
        kod: item.kod || item.kod_kreskowy || item.qr_kod || item.zewnetrzny_kod_kreskowy || item.zewnetrzny_qr_kod,
        system_case_scan: item.system_case_scan || item.case_scan || null,
        id_zeskanowanego_case: item.id_zeskanowanego_case,
        nazwa_zeskanowanego_case: item.nazwa_zeskanowanego_case,
        uwagi: item.uwagi || '', // <--- PRZENIESIENIE ZAWARTOŚCI RACKA DO UWAG WZ/PZ
      }];
    });
  }

  async function handleScan(e: any) {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    setError('');
    setNotice('');
    try {
      const response = await api.get(`/api/magazyn/skan?kod=${encodeURIComponent(code)}`);
      addItem(response.data);
      setScan('');
    } catch (err: any) {
      setError(err?.response?.data?.message || `Nie znaleziono kodu: ${scan}`);
    }
  }

  async function saveDocument() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, typ: active, pozycje: selected };
      const r = await api.post('/api/magazyn/dokumenty', payload);
      setSelected([]);
      setForm({ typ: active, data_operacji: new Date().toISOString().slice(0, 16) });
      await load();
      router.push(`/dashboard/warehouse/documents/${r.data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się zapisać dokumentu.');
    } finally { setSaving(false); }
  }

  const selectedGroups = selected.reduce((acc: any[], p: any) => {
    const category = p.kategoria || 'Bez kategorii';
    let group = acc.find((g) => g.nazwa === category);
    if (!group) { group = { nazwa: category, pozycje: [], ilosc: 0 }; acc.push(group); }
    group.pozycje.push(p);
    group.ilosc += Number(p.ilosc || 0);
    return acc;
  }, []);

  return <div className="mx-auto max-w-[1800px] space-y-6">
    <PageTitle eyebrow="Magazyn" title="Wydania i przyjęcia" description="Skanuj kody egzemplarzy albo case. Po zapisie otwiera się czytelne potwierdzenie wydania/przyjęcia z listą sprzętu i przyciskiem PDF do druku." action={<Button onClick={saveDocument} disabled={!selected.length || saving}><FileText size={16} className="inline" /> {saving ? 'Zapisywanie...' : 'Zapisz dokument'}</Button>} />

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</div>}
    {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">{notice}</div>}

    <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setActive('wydanie'); setForm({ ...form, typ: 'wydanie' }); }} className={`rounded-xl px-4 py-2 text-sm font-black ${active === 'wydanie' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Wydanie</button>
          <button onClick={() => { setActive('przyjecie'); setForm({ ...form, typ: 'przyjecie' }); }} className={`rounded-xl px-4 py-2 text-sm font-black ${active === 'przyjecie' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Przyjęcie</button>
          <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">WZ/PZ: egzemplarze + sprzęt ilościowy</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Wydarzenie"><select className={inputClass} value={form.id_wydarzenia || ''} onChange={(e) => setForm({ ...form, id_wydarzenia: e.target.value })}><option value="">Brak</option>{events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.nazwa}</option>)}</select></Field>
          <Field label="Wynajem"><select className={inputClass} value={form.id_wynajmu || ''} onChange={(e) => setForm({ ...form, id_wynajmu: e.target.value })}><option value="">Brak</option>{rentals.map((r: any) => <option key={r.id} value={r.id}>{r.numer || `Wynajem #${r.id}`} {r.wydarzenie?.nazwa ? `· ${r.wydarzenie.nazwa}` : ''}</option>)}</select></Field>
          <Field label="Data operacji"><input type="datetime-local" className={inputClass} value={form.data_operacji || ''} onChange={(e) => setForm({ ...form, data_operacji: e.target.value })} /></Field>
          <Field label="Osoba odbierająca / zdająca, wymagana przy wynajmie"><input className={inputClass} value={form.osoba_odbierajaca || ''} onChange={(e) => setForm({ ...form, osoba_odbierajaca: e.target.value })} /></Field>
        </div>
        <Field label="Podpis odbierającego / zdającego"><input className={inputClass} placeholder="Imię i nazwisko lub podpis wpisany w obecnej wersji" value={form.podpis_odbierajacego || ''} onChange={(e) => setForm({ ...form, podpis_odbierajacego: e.target.value })} /></Field>
        <Field label="Uwagi"><textarea className={inputClass} value={form.uwagi || ''} onChange={(e) => setForm({ ...form, uwagi: e.target.value })} /></Field>

        <form onSubmit={handleScan} className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
          <Field label="Skanuj kod kreskowy / QR / S/N"><div className="flex gap-2"><input className={inputClass} value={scan} onChange={(e) => { setError(''); setScan(e.target.value); }} placeholder="Zeskanuj i naciśnij Enter" autoFocus /><Button type="submit"><QrCode size={16} className="inline" /> Dodaj</Button></div></Field>
        </form>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj ręcznie: model, egzemplarz, kod, kategoria..." />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">Egzemplarze</h3>
            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{filteredItems.map((it: any) => <button key={it.id} onClick={() => addItem(it)} className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-300 hover:bg-cyan-50"><b>{itemName(it)}</b><p className="text-xs font-bold text-slate-500">{it.model?.nazwa || '-'} · {it.kod_kreskowy || it.qr_kod || it.sn || 'brak kodu'}</p></button>)}</div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">Modele</h3>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">
              Modele są ukryte w WZ/PZ. Dokument magazynowy musi zawierać konkretne egzemplarze sprzętu. Model możesz wykorzystać w planowaniu sprzętu wydarzenia, a tutaj wybierasz egzemplarz skanem albo wyszukiwarką.
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Pozycje dokumentu</h2><span className="rounded-xl bg-slate-100 px-3 py-1 text-sm font-black">{selected.length} pozycji</span></div>
        <div className="space-y-3">{selectedGroups.map((group: any) => <div key={group.nazwa} className="rounded-2xl border border-slate-100 bg-slate-50 p-2"><div className="mb-2 flex items-center justify-between px-2 text-xs font-black uppercase tracking-wider text-slate-400"><span>{group.nazwa}</span><span>{group.ilosc} szt.</span></div>{group.pozycje.map((p: any) => { const idx = selected.indexOf(p); return <div key={`${p.id_egzemplarza || p.id_modelu || p.nazwa}-${idx}`} className="mb-2 rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div><b>{p.nazwa}</b><p className="text-xs font-bold text-slate-500">{[p.nazwa_modelu, p.numer_egzemplarza ? `nr ${p.numer_egzemplarza}` : null, p.kod || p.status].filter(Boolean).join(' · ') || '-'}</p></div><button onClick={() => setSelected((s) => s.filter((_, i) => i !== idx))} className="rounded-xl p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_110px]"><Field label="Nazwa/numer na dokumencie"><input className={inputClass} value={p.nazwa || ''} onChange={(e) => setSelected((s) => s.map((x, i) => i === idx ? { ...x, nazwa: e.target.value, nazwa_na_dokumencie: e.target.value } : x))} /></Field><Field label="Ilość"><input type="number" className={inputClass} value={1} disabled /></Field></div><Field label="Uwagi"><input className={inputClass} value={p.uwagi || ''} onChange={(e) => setSelected((s) => s.map((x, i) => i === idx ? { ...x, uwagi: e.target.value } : x))} /></Field></div>; })}</div>)}{!selected.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Dodaj egzemplarze sprzętu skanem albo wyszukiwarką.</p>}</div>
      </Card>
    </div>

    <Card>
      <h2 className="mb-4 text-xl font-black">Ostatnie dokumenty</h2>
      <DataTable rows={documents} onRowClick={(r: any) => router.push(`/dashboard/warehouse/documents/${r.id}`)} columns={[{ key: 'numer', label: 'Numer', value: (r: any) => <b>{r.numer}</b> }, { key: 'typ', label: 'Typ', value: (r: any) => docTypeLabel(r.typ) }, { key: 'wydarzenie', label: 'Wydarzenie', value: (r: any) => r.wydarzenie?.nazwa || '-' }, { key: 'wynajem', label: 'Wynajem', value: (r: any) => r.wynajem?.numer || '-' }, { key: 'data_operacji', label: 'Data', value: (r: any) => d(r.data_operacji), sortValue: (r: any) => r.data_operacji }, { key: 'pozycje', label: 'Pozycji', value: (r: any) => r.pozycje?.length || 0 }, { key: 'pdf', label: 'Dokument', value: (r: any) => <Link className="inline-flex items-center gap-1 text-cyan-700" href={`/dashboard/warehouse/documents/${r.id}`}><PackageCheck size={14} /> Otwórz</Link> }]} />
    </Card>
  </div>;
}
