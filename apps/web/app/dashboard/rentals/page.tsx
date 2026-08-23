'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function d(v: any) { return v ? new Date(v).toLocaleDateString('pl-PL') : '-'; }

export default function RentalsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [dict, setDict] = useState<any>({ kontrahenci: [], statusy: [], statusyMagazynowe: [], statusyKsiegowe: [] });
  const [filters, setFilters] = useState<any>({ kontrahent: '', status: '', statusMagazynowy: '', statusKsiegowy: '', od: '', do: '' });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, k, s, sm, sk] = await Promise.all([
        api.get('/api/wynajmy').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-wynajmu').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-magazynowe').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-ksiegowe').catch(() => ({ data: [] })),
      ]);
      setItems(r.data || []);
      setDict({ kontrahenci: k.data || [], statusy: s.data || [], statusyMagazynowe: sm.data || [], statusyKsiegowe: sk.data || [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((w: any) => {
    if (filters.kontrahent && String(w.id_kontrahenta || w.kontrahent?.id) !== filters.kontrahent) return false;
    if (filters.status && String(w.id_statusu_wynajmu || w.status?.id) !== filters.status) return false;
    if (filters.statusMagazynowy && String(w.id_statusu_magazynowego || w.status_magazynowy?.id) !== filters.statusMagazynowy) return false;
    if (filters.statusKsiegowy && String(w.id_statusu_ksiegowego || w.status_ksiegowy?.id) !== filters.statusKsiegowy) return false;
    
    const date = w.data_wydania?.slice?.(0, 10);
    if (filters.od && date && date < filters.od) return false;
    if (filters.do && date && date > filters.do) return false;
    return true;
  }), [items, filters]);

  async function save(e: any) {
    e.preventDefault();
    await api.post('/api/wynajmy', form);
    setShow(false);
    setForm({});
    load();
  }

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle eyebrow="Wypożyczenia" title="Lista wypożyczeń" description="Wynajem udostępnia statusy główne i poboczne. Wydanie sprzętu obsługujesz przez WZ/PZ, nie przez moduł wynajmu." action={<Button onClick={() => setShow(true)}><Plus size={16} className="inline" /> Dodaj</Button>} />
    <Card>
      <div className="mb-4 grid gap-3 md:grid-cols-6">
        <Field label="Status wynajmu"><select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Wszystkie</option>{dict.statusy.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '●'} {s.nazwa}</option>)}</select></Field>
        <Field label="Status magazynowy"><select className={inputClass} value={filters.statusMagazynowy} onChange={(e) => setFilters({ ...filters, statusMagazynowy: e.target.value })}><option value="">Wszystkie</option>{dict.statusyMagazynowe.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '📦'} {s.nazwa}</option>)}</select></Field>
        <Field label="Status księgowy"><select className={inputClass} value={filters.statusKsiegowy} onChange={(e) => setFilters({ ...filters, statusKsiegowy: e.target.value })}><option value="">Wszystkie</option>{dict.statusyKsiegowe.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '💰'} {s.nazwa}</option>)}</select></Field>
        
        <Field label="Kontrahent"><select className={inputClass} value={filters.kontrahent} onChange={(e) => setFilters({ ...filters, kontrahent: e.target.value })}><option value="">Wszyscy</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field>
        <Field label="Od"><input type="date" className={inputClass} value={filters.od} onChange={(e) => setFilters({ ...filters, od: e.target.value })} /></Field>
        <Field label="Do"><input type="date" className={inputClass} value={filters.do} onChange={(e) => setFilters({ ...filters, do: e.target.value })} /></Field>
      </div>

      {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : <DataTable rows={filtered} onRowClick={(r:any)=>router.push(`/dashboard/rentals/${r.id}`)} columns={[
        { key: 'numer', label: 'Numer', value: (r: any) => <b>{r.numer || `#${r.id}`}</b> }, 
        { key: 'kontrahent', label: 'Kontrahent', value: (r: any) => r.kontrahent?.nazwa || '-' }, 
        { key: 'status', label: 'Status główny', value: (r: any) => <span>{r.status?.ikona || '●'} {r.status?.nazwa || '-'}</span> }, 
        { key: 'status_magazynowy', label: 'Magazyn', value: (r: any) => <span>{r.status_magazynowy?.ikona || '📦'} {r.status_magazynowy?.nazwa || '-'}</span> }, 
        { key: 'status_ksiegowy', label: 'Księgowość', value: (r: any) => <span>{r.status_ksiegowy?.ikona || '💰'} {r.status_ksiegowy?.nazwa || '-'}</span> }, 
        { key: 'data_wydania', label: 'Wydanie', value: (r: any) => d(r.data_wydania), sortValue: (r: any) => r.data_wydania }, 
        { key: 'data_zwrotu_planowana', label: 'Zwrot planowany', value: (r: any) => d(r.data_zwrotu_planowana) }, 
        { key: 'pozycje', label: 'Pozycji', value: (r: any) => r.pozycje?.length || 0 }
      ]} />}
    </Card>

    {show && <SimpleModal title="Dodaj wypożyczenie" onClose={() => setShow(false)}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Numer"><input className={inputClass} value={form.numer || ''} onChange={(e) => setForm({ ...form, numer: e.target.value })} placeholder="Automatyczny, jeśli puste" /></Field>
          <Field label="Kontrahent"><select className={inputClass} value={form.id_kontrahenta || ''} onChange={(e) => setForm({ ...form, id_kontrahenta: e.target.value })}><option value="">Brak</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field>
          
          <Field label="Status główny"><select className={inputClass} value={form.id_statusu_wynajmu || ''} onChange={(e) => setForm({ ...form, id_statusu_wynajmu: e.target.value })}><option value="">Domyślny</option>{dict.statusy.map((s: any) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}</select></Field>
          <Field label="Wydanie sprzętu"><input type="datetime-local" className={inputClass} onChange={(e) => setForm({ ...form, data_wydania: e.target.value })} /></Field>
          <Field label="Planowany zwrot"><input type="datetime-local" className={inputClass} onChange={(e) => setForm({ ...form, data_zwrotu_planowana: e.target.value })} /></Field>
        </div>
        <Field label="Notatki"><textarea className={inputClass} value={form.notatki_wewnetrzne || ''} onChange={(e) => setForm({ ...form, notatki_wewnetrzne: e.target.value })} /></Field>
        
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div>
      </form>
    </SimpleModal>}
  </div>;
}