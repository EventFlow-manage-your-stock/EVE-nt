'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function d(v: any) { return v ? new Date(v).toLocaleDateString('pl-PL') : '-'; }

export default function LeavesPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ user: '', typ: '', od: '', do: '' });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ typ: 'urlop' });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })), api.get('/api/urlopy').catch(() => ({ data: [] }))]);
      setUsers(u.data || []);
      setItems(l.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((i: any) => {
    if (filters.user && String(i.id_uzytkownika || i.uzytkownik?.id) !== filters.user) return false;
    if (filters.typ && !String(i.typ || '').toLowerCase().includes(filters.typ.toLowerCase())) return false;
    const od = i.data_od?.slice?.(0, 10);
    const do_ = i.data_do?.slice?.(0, 10);
    if (filters.od && do_ && do_ < filters.od) return false;
    if (filters.do && od && od > filters.do) return false;
    return true;
  }), [items, filters]);

  async function save(e: any) {
    e.preventDefault();
    await api.post('/api/urlopy', form);
    setShow(false);
    setForm({ typ: 'urlop' });
    load();
  }

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle eyebrow="Urlopy" title="Nieobecności" description="Lista z filtrowaniem po osobie, typie i zakresie dat. Urlopy są widoczne także w kalendarzu." action={<Button onClick={() => setShow(true)}><Plus size={16} className="inline" /> Dodaj</Button>} />
    <Card>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Field label="Osoba"><select className={inputClass} value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })}><option value="">Wszyscy</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}</select></Field>
        <Field label="Typ"><input className={inputClass} value={filters.typ} onChange={(e) => setFilters({ ...filters, typ: e.target.value })} placeholder="urlop, L4..." /></Field>
        <Field label="Od"><input type="date" className={inputClass} value={filters.od} onChange={(e) => setFilters({ ...filters, od: e.target.value })} /></Field>
        <Field label="Do"><input type="date" className={inputClass} value={filters.do} onChange={(e) => setFilters({ ...filters, do: e.target.value })} /></Field>
      </div>
      {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : <DataTable rows={filtered} onRowClick={(r:any)=>router.push(`/dashboard/leaves/${r.id}`)} columns={[{ key: 'uzytkownik', label: 'Osoba', value: (r: any) => `${r.uzytkownik?.imie || ''} ${r.uzytkownik?.nazwisko || ''}`.trim() || '-' }, { key: 'typ', label: 'Typ' }, { key: 'data_od', label: 'Od', value: (r: any) => d(r.data_od), sortValue: (r: any) => r.data_od }, { key: 'data_do', label: 'Do', value: (r: any) => d(r.data_do), sortValue: (r: any) => r.data_do }, { key: 'opis', label: 'Opis' }]} />}
    </Card>
    {show && <SimpleModal title="Dodaj urlop / nieobecność" onClose={() => setShow(false)}><form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Pracownik"><select className={inputClass} value={form.id_uzytkownika || ''} onChange={(e) => setForm({ ...form, id_uzytkownika: e.target.value })} required><option value="">Wybierz</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}</select></Field><Field label="Typ"><input className={inputClass} value={form.typ || ''} onChange={(e) => setForm({ ...form, typ: e.target.value })} /></Field><Field label="Od"><input type="date" className={inputClass} onChange={(e) => setForm({ ...form, data_od: e.target.value })} required /></Field><Field label="Do"><input type="date" className={inputClass} onChange={(e) => setForm({ ...form, data_do: e.target.value })} required /></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={(e) => setForm({ ...form, opis: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}
  </div>;
}
