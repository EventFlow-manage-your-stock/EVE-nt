'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, QrCode } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';
import { SimpleModal } from '../../../../components/SimpleModal';
import { PrintLabelsModal } from '../../../../components/PrintLabelsModal';

export default function PackagesPage() {
  const router = useRouter();
  const [view, setView] = useState<'egzemplarze' | 'typy'>('egzemplarze');
  const [items, setItems] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [magazyny, setMagazyny] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ rozroznij_kod_qr: false, typ_sprzetu: 'opakowanie' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const [filters, setFilters] = useState({ search: '', magazyn: '', kategoria: '', typ_sprzetu: '' });

  async function load() {
    setLoading(true);
    try {
      const [p, m, mag, cat] = await Promise.all([
        api.get('/api/magazyn/opakowania').catch(() => ({ data: [] })),
        api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
        api.get('/api/magazyn/slowniki/magazyny').catch(() => ({ data: [] })),
        api.get('/api/magazyn/kategorie/plasko').catch(() => api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })))
      ]);
      setItems(p.data || []);
      setModels((m.data || []).filter((x: any) => ['opakowanie', 'rack', 'zestaw'].includes(x.typ_sprzetu)));
      setMagazyny(mag.data || []);
      setCategories(cat.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function updateBarcode(value: string) {
    setForm((prev: any) => ({ ...prev, kod_kreskowy: value, zewnetrzny_kod_kreskowy: value, zewnetrzny_qr_kod: prev.rozroznij_kod_qr ? prev.zewnetrzny_qr_kod : value, qr_kod: prev.rozroznij_kod_qr ? prev.qr_kod : value }));
  }

  async function save(e: any) {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, zewnetrzny_qr_kod: form.rozroznij_kod_qr ? form.zewnetrzny_qr_kod : (form.kod_kreskowy || form.zewnetrzny_kod_kreskowy), qr_kod: form.rozroznij_kod_qr ? form.qr_kod : (form.kod_kreskowy || form.zewnetrzny_kod_kreskowy) };
      await api.post('/api/magazyn/opakowania', payload);
      setShow(false); setForm({ rozroznij_kod_qr: false, typ_sprzetu: 'opakowanie' }); load();
    } catch (err: any) { setError(err?.response?.data?.message || err.message || 'Nie udało się dodać opakowania.'); }
  }

  const filteredItems = useMemo(() => {
    return items.filter((i: any) => {
      if (filters.magazyn && String(i.id_magazynu || i.magazyn?.id) !== filters.magazyn) return false;
      const t = i.model?.typ_sprzetu || i.typ_sprzetu;
      if (filters.typ_sprzetu && t !== filters.typ_sprzetu && !(filters.typ_sprzetu === 'zestaw' && t === 'rack')) return false; 
      
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = `${i.nazwa || ''} ${i.model?.nazwa || ''} ${i.numer_egzemplarza || i.numer_urzadzenia || ''} ${i.kod_kreskowy || ''} ${i.qr_kod || ''} ${i.zewnetrzny_kod_kreskowy || ''} ${i.zewnetrzny_qr_kod || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  function handleOpenPrintModal() {
    // Jeśli nic nie zaznaczono w widoku 'egzemplarze', pobieramy aktualnie odfiltrowane fizyczne case'y
    if (selected.length === 0 && filteredItems.length > 0) {
      setSelected(filteredItems.map((i: any) => i.id));
    }
    setShowPrintModal(true);
  }

  const modelRows = useMemo(() => {
    return models.filter((m: any) => {
      if (filters.kategoria && String(m.id_kategorii || m.kategoria?.id) !== filters.kategoria) return false;
      const t = m.typ_sprzetu;
      if (filters.typ_sprzetu && t !== filters.typ_sprzetu && !(filters.typ_sprzetu === 'zestaw' && t === 'rack')) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = `${m.nazwa || ''} ${m.kategoria?.nazwa || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    }).map((m: any) => ({ ...m, egzemplarzy: items.filter((i: any) => String(i.id_modelu) === String(m.id)).length }));
  }, [models, items, filters]);

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle 
      eyebrow="Magazyn" 
      title="Opakowania i Zestawy" 
      description="Case'y rozpakowują swoją zawartość na dokumencie WZ. Zestawy lądują na dokumencie jako pojedynczy wiersz z ukrytą w uwagach zawartością." 
      action={
        <div className="flex gap-2">
             {/* NOWY GUZIK */}
             {view === 'egzemplarze' && (
               <Button variant="secondary" onClick={handleOpenPrintModal} disabled={filteredItems.length === 0}>
                 <QrCode size={16} className="inline mr-1" /> Generuj naklejki {selected.length > 0 ? `(${selected.length})` : ''}
               </Button>
             )}
            <Button onClick={() => setShow(true)}><Plus size={16} className="inline mr-1" /> Dodaj</Button>
          </div>
          }
      />
    <Card className="!p-4"><div className="flex flex-wrap gap-2"><button onClick={() => setView('egzemplarze')} className={`rounded-xl px-4 py-2 text-sm font-black ${view === 'egzemplarze' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Fizyczne skrzynie / Zestawy</button><button onClick={() => setView('typy')} className={`rounded-xl px-4 py-2 text-sm font-black ${view === 'typy' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Typy i parametry modeli</button></div></Card>
    
    <Card>
      {/* SEKCJA FILTRÓW */}
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Field label="Szukaj">
          <div className="relative">
             <Search size={16} className="absolute left-3 top-3 text-slate-400" />
             <input className={`${inputClass} pl-9`} value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="Szukaj nazwy, kodu..." />
          </div>
        </Field>
        
        <Field label="Typ">
          <select className={inputClass} value={filters.typ_sprzetu} onChange={e => setFilters({...filters, typ_sprzetu: e.target.value})}>
            <option value="">Wszystkie</option>
            <option value="opakowanie">Case / Opakowanie</option>
            <option value="zestaw">Zestaw</option>
          </select>
        </Field>

        {view === 'egzemplarze' ? (
          <Field label="Magazyn">
            <select className={inputClass} value={filters.magazyn} onChange={e => setFilters({...filters, magazyn: e.target.value})}>
              <option value="">Wszystkie</option>
              {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Kategoria">
            <select className={inputClass} value={filters.kategoria} onChange={e => setFilters({...filters, kategoria: e.target.value})}>
              <option value="">Wszystkie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
            </select>
          </Field>
        )}
      </div>
      
      {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : view === 'egzemplarze' ? (
      <DataTable 
        rows={filteredItems} 
        onRowClick={(r:any)=>router.push(`/dashboard/warehouse/packages/${r.id}`)}
        columns={[
          { key: 'select', label: '', value: (r:any) => <input type="checkbox" checked={selected.includes(r.id)} onChange={(e)=>setSelected(s=>e.target.checked?[...s,r.id]:s.filter(x=>x!==r.id))} onClick={e=>e.stopPropagation()}/> },
          { key: 'nazwa', label: 'Nazwa', value: (r: any) => <b>{r.nazwa || r.model?.nazwa}</b> }, 
          { 
            key: 'model', 
            label: 'Model / Typ', 
            value: (r: any) => {
              const t = r.model?.typ_sprzetu || r.typ_sprzetu;
              return (
                <div className="flex flex-col items-start gap-1">
                  <span className="font-bold text-slate-600">{r.model?.nazwa || '-'}</span>
                  {t === 'rack' || t === 'zestaw'
                    ? <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700">ZESTAW</span> 
                    : <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">CASE</span>}
                </div>
              );
            }
          }, 
          { key: 'numer_egzemplarza', label: 'Nr', value: (r: any) => r.numer_egzemplarza || r.numer_urzadzenia || '-' }, 
          { key: 'magazyn', label: 'Magazyn', value: (r: any) => r.magazyn?.nazwa || '-' }, 
          { key: 'kod_kreskowy', label: 'Kod kreskowy', value: (r: any) => <span className="font-mono">{r.kod_kreskowy || r.qr_kod || '-'}</span> }, 
          { key: 'zawartosc', label: 'Zawartość', value: (r: any) => <span><b className="text-cyan-700">{r.zawartosc_case?.length || 0} szt.</b></span> }
        ]} 
      /> 
      ) : (
      <DataTable 
        rows={modelRows} 
        onRowClick={(r:any)=>router.push(`/dashboard/warehouse/models/${r.id}`)} 
        columns={[
          { key: 'nazwa', label: 'Typ opakowania / Zestawu', value: (r:any)=><b className="text-cyan-700">{r.nazwa}</b> }, 
          { 
            key: 'typ', 
            label: 'Logika', 
            value: (r:any) => {
              const t = r.typ_sprzetu;
              return t === 'rack' || t === 'zestaw'
                ? <span className="rounded bg-indigo-100 px-2 py-1 text-[10px] font-black uppercase text-indigo-700">ZESTAW</span> 
                : <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-700">CASE</span>;
            }
          }, 
          { key: 'kategoria', label: 'Kategoria', value: (r:any)=>r.kategoria?.nazwa || '-' }, 
          { key: 'egzemplarzy', label: 'Egzemplarzy fizycznych', value: (r:any) => <b className="text-slate-800">{r.egzemplarzy}</b> }
        ]} 
      />
      )}
    </Card>
    <PrintLabelsModal 
        isOpen={showPrintModal} 
        onClose={() => { setShowPrintModal(false); setSelected([]); }} 
        ids={selected} 
      />
    
    {show && <SimpleModal title="Dodaj kontener / skrzynię / Zestaw" onClose={() => setShow(false)}>{error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}<form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">
      <Field label="Istniejący typ opakowania">
        <select className={inputClass} value={form.id_modelu || ''} onChange={(e) => setForm({ ...form, id_modelu: e.target.value })}>
          <option value="">Utwórz nowy typ</option>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
        </select>
      </Field>
      {!form.id_modelu && (
        <Field label="Logika skanowania">
          <select className={inputClass} value={form.typ_sprzetu || 'opakowanie'} onChange={e => setForm({ ...form, typ_sprzetu: e.target.value })}>
            <option value="opakowanie">Standardowy Case (rozpakowuje zawartość na WZ)</option>
            <option value="zestaw">Zestaw (stanowi jedną pozycję na dokumencie z ukrytą zawartością)</option>
          </select>
        </Field>
      )}
      <Field label="Nazwa typu, jeśli nowy"><input className={inputClass} value={form.nazwa_modelu || ''} onChange={(e) => setForm({ ...form, nazwa_modelu: e.target.value })}/></Field>
      <Field label="Nazwa skrzyni / Zestawu"><input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })}/></Field>
      <Field label="Numer egzemplarza"><input className={inputClass} value={form.numer_egzemplarza || ''} onChange={(e) => setForm({ ...form, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })}/></Field>
      <Field label="Magazyn"><select className={inputClass} value={form.id_magazynu || ''} onChange={(e) => setForm({ ...form, id_magazynu: e.target.value })}><option value="">Brak</option>{magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field>
      <Field label="Kod kreskowy / QR"><input className={inputClass} value={form.kod_kreskowy || ''} onChange={(e) => updateBarcode(e.target.value)}/></Field>
    </div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}
  </div>;
}