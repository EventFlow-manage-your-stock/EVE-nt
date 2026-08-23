'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

const tabs = [
  { key: 'wydarzenia', label: 'Wydarzenia' },
  { key: 'wynajmy', label: 'Wynajmy' },
  { key: 'urlopy', label: 'Urlopy' },
] as const;

function toDate(value: any) { return value ? new Date(value).toLocaleDateString('pl-PL') : '-'; }
function asDay(value: any) { return value?.slice?.(0, 10) || ''; }

export default function EventsPage() {
  const router = useRouter();
  const [active, setActive] = useState<typeof tabs[number]['key']>('wydarzenia');
  const [events, setEvents] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [dict, setDict] = useState<any>({ kontrahenci: [], typy: [], statusy: [], statusyMagazynowe: [], statusyKsiegowe: [], statusyWynajmu: [], uzytkownicy: [] });
  const [filters, setFilters] = useState<any>({ status: '', statusMagazynowy: '', statusKsiegowy: '', typ: '', kontrahent: '', osoba: '', od: '', do: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [e, r, l, k, t, s, sm, sk, sw, u] = await Promise.all([
        api.get('/api/wydarzenia').catch(() => ({ data: [] })),
        api.get('/api/wynajmy').catch(() => ({ data: [] })),
        api.get('/api/urlopy').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
        api.get('/api/slowniki/typy-wydarzen').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-wydarzenia').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-magazynowe').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-ksiegowe').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-wynajmu').catch(() => ({ data: [] })),
        api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      ]);
      setEvents(e.data || []); setRentals(r.data || []); setLeaves(l.data || []);
      setDict({ kontrahenci: k.data || [], typy: t.data || [], statusy: s.data || [], statusyMagazynowe: sm.data || [], statusyKsiegowe: sk.data || [], statusyWynajmu: sw.data || [], uzytkownicy: u.data || [] });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filteredEvents = useMemo(() => events.filter((e: any) => {
    if (filters.status && String(e.id_statusu_wydarzenia || e.status?.id) !== filters.status) return false;
    if (filters.statusMagazynowy && String(e.id_statusu_magazynowego || e.status_magazynowy?.id) !== filters.statusMagazynowy) return false;
    if (filters.statusKsiegowy && String(e.id_statusu_ksiegowego || e.status_ksiegowy?.id) !== filters.statusKsiegowy) return false;
    if (filters.typ && String(e.id_typu_wydarzenia || e.typ?.id) !== filters.typ) return false;
    if (filters.kontrahent && String(e.id_kontrahenta || e.kontrahent?.id) !== filters.kontrahent) return false;
    const d = asDay(e.data_start);
    if (filters.od && d && d < filters.od) return false;
    if (filters.do && d && d > filters.do) return false;
    return true;
  }), [events, filters]);

  const filteredRentals = useMemo(() => rentals.filter((r: any) => {
    if (filters.status && String(r.id_statusu_wynajmu || r.status?.id) !== filters.status) return false;
    if (filters.kontrahent && String(r.id_kontrahenta || r.kontrahent?.id) !== filters.kontrahent) return false;
    const d = asDay(r.data_wydania);
    if (filters.od && d && d < filters.od) return false;
    if (filters.do && d && d > filters.do) return false;
    return true;
  }), [rentals, filters]);

  const filteredLeaves = useMemo(() => leaves.filter((l: any) => {
    if (filters.osoba && String(l.id_uzytkownika || l.uzytkownik?.id) !== filters.osoba) return false;
    if (filters.typ && !String(l.typ || '').toLowerCase().includes(String(filters.typ).toLowerCase())) return false;
    const od = asDay(l.data_od); const do_ = asDay(l.data_do);
    if (filters.od && do_ && do_ < filters.od) return false;
    if (filters.do && od && od > filters.do) return false;
    return true;
  }), [leaves, filters]);

  function resetFiltersFor(tab: string) { setActive(tab as any); setFilters({ status: '', statusMagazynowy: '', statusKsiegowy: '', typ: '', kontrahent: '', osoba: '', od: '', do: '' }); }

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle eyebrow="Wydarzenia" title="Lista operacyjna" description="Wydarzenia, wynajmy i urlopy jako listy z filtrowaniem, wyszukiwaniem i sortowaniem." action={<Button onClick={() => setShowAdd(true)}><Plus size={16} className="inline" /> Dodaj</Button>} />
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map(t => <button key={t.key} onClick={() => resetFiltersFor(t.key)} className={`rounded-xl px-4 py-2 text-sm font-black ${active === t.key ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.label}</button>)}</div>
      {active === 'wydarzenia' && <EventFilters filters={filters} setFilters={setFilters} dict={dict} />}
      {active === 'wynajmy' && <RentalFilters filters={filters} setFilters={setFilters} dict={dict} />}
      {active === 'urlopy' && <LeaveFilters filters={filters} setFilters={setFilters} dict={dict} />}
      {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : active === 'wydarzenia' ? <DataTable rows={filteredEvents} onRowClick={(r: any) => router.push(`/dashboard/events/${r.id}`)} columns={[{ key: 'nazwa', label: 'Nazwa', value: (r: any) => <b>{r.nazwa}</b> }, { key: 'typ', label: 'Typ', value: (r: any) => r.typ?.nazwa || '-' }, { key: 'status', label: 'Status', value: (r: any) => <span>{r.status?.ikona || '●'} {r.status?.nazwa || '-'}</span> }, { key: 'status_magazynowy', label: 'Magazyn', value: (r: any) => <span>{r.status_magazynowy?.ikona || '📦'} {r.status_magazynowy?.nazwa || '-'}</span> }, { key: 'status_ksiegowy', label: 'Księgowość', value: (r: any) => <span>{r.status_ksiegowy?.ikona || '💰'} {r.status_ksiegowy?.nazwa || '-'}</span> }, { key: 'kontrahent', label: 'Kontrahent', value: (r: any) => r.kontrahent?.nazwa || '-' }, { key: 'data_start', label: 'Start', value: (r: any) => toDate(r.data_start), sortValue: (r: any) => r.data_start }, { key: 'data_koniec', label: 'Koniec', value: (r: any) => toDate(r.data_koniec) }]} /> : active === 'wynajmy' ? <DataTable rows={filteredRentals} onRowClick={(r:any)=>router.push(`/dashboard/rentals/${r.id}`)} columns={[{ key: 'numer', label: 'Numer', value: (r: any) => <b>{r.numer || `#${r.id}`}</b> }, { key: 'wydarzenie', label: 'Wydarzenie', value: (r: any) => r.wydarzenie?.nazwa || '-' }, { key: 'kontrahent', label: 'Kontrahent', value: (r: any) => r.kontrahent?.nazwa || '-' }, { key: 'status', label: 'Status', value: (r: any) => r.status?.nazwa || '-' }, { key: 'data_wydania', label: 'Wydanie', value: (r: any) => toDate(r.data_wydania), sortValue: (r: any) => r.data_wydania }, { key: 'data_zwrotu_planowana', label: 'Zwrot planowany', value: (r: any) => toDate(r.data_zwrotu_planowana) }, { key: 'pozycje', label: 'Pozycji', value: (r: any) => r.pozycje?.length || 0 }]} /> : <DataTable rows={filteredLeaves} onRowClick={(r:any)=>router.push(`/dashboard/leaves/${r.id}`)} columns={[{ key: 'uzytkownik', label: 'Osoba', value: (r: any) => `${r.uzytkownik?.imie || ''} ${r.uzytkownik?.nazwisko || ''}`.trim() || '-' }, { key: 'typ', label: 'Typ' }, { key: 'data_od', label: 'Od', value: (r: any) => toDate(r.data_od), sortValue: (r: any) => r.data_od }, { key: 'data_do', label: 'Do', value: (r: any) => toDate(r.data_do) }, { key: 'opis', label: 'Opis' }]} />}
    </Card>
    {showAdd && <AddModal active={active} dict={dict} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
  </div>;
}

function EventFilters({ filters, setFilters, dict }: any) { return <div className="mb-4 grid gap-3 md:grid-cols-7"><Field label="Status główny"><select className={inputClass} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Wszystkie</option>{dict.statusy.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '●'} {s.nazwa}</option>)}</select></Field><Field label="Status magazynowy"><select className={inputClass} value={filters.statusMagazynowy} onChange={e => setFilters({ ...filters, statusMagazynowy: e.target.value })}><option value="">Wszystkie</option>{dict.statusyMagazynowe.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '📦'} {s.nazwa}</option>)}</select></Field><Field label="Status księgowy"><select className={inputClass} value={filters.statusKsiegowy} onChange={e => setFilters({ ...filters, statusKsiegowy: e.target.value })}><option value="">Wszystkie</option>{dict.statusyKsiegowe.map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '💰'} {s.nazwa}</option>)}</select></Field><Field label="Typ"><select className={inputClass} value={filters.typ} onChange={e => setFilters({ ...filters, typ: e.target.value })}><option value="">Wszystkie</option>{dict.typy.map((t: any) => <option key={t.id} value={t.id}>{t.nazwa}</option>)}</select></Field><Field label="Kontrahent"><select className={inputClass} value={filters.kontrahent} onChange={e => setFilters({ ...filters, kontrahent: e.target.value })}><option value="">Wszyscy</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field><Field label="Od"><input type="date" className={inputClass} value={filters.od} onChange={e => setFilters({ ...filters, od: e.target.value })} /></Field><Field label="Do"><input type="date" className={inputClass} value={filters.do} onChange={e => setFilters({ ...filters, do: e.target.value })} /></Field></div>; }
function RentalFilters({ filters, setFilters, dict }: any) { return <div className="mb-4 grid gap-3 md:grid-cols-4"><Field label="Status"><select className={inputClass} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Wszystkie</option>{dict.statusyWynajmu.map((s: any) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}</select></Field><Field label="Kontrahent"><select className={inputClass} value={filters.kontrahent} onChange={e => setFilters({ ...filters, kontrahent: e.target.value })}><option value="">Wszyscy</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field><Field label="Od"><input type="date" className={inputClass} value={filters.od} onChange={e => setFilters({ ...filters, od: e.target.value })} /></Field><Field label="Do"><input type="date" className={inputClass} value={filters.do} onChange={e => setFilters({ ...filters, do: e.target.value })} /></Field></div>; }
function LeaveFilters({ filters, setFilters, dict }: any) { return <div className="mb-4 grid gap-3 md:grid-cols-4"><Field label="Osoba"><select className={inputClass} value={filters.osoba} onChange={e => setFilters({ ...filters, osoba: e.target.value })}><option value="">Wszyscy</option>{dict.uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}</select></Field><Field label="Typ"><input className={inputClass} value={filters.typ} onChange={e => setFilters({ ...filters, typ: e.target.value })} /></Field><Field label="Od"><input type="date" className={inputClass} value={filters.od} onChange={e => setFilters({ ...filters, od: e.target.value })} /></Field><Field label="Do"><input type="date" className={inputClass} value={filters.do} onChange={e => setFilters({ ...filters, do: e.target.value })} /></Field></div>; }

function AddModal({ active, dict, onClose, onSaved }: any) {
  const [kind, setKind] = useState(active);
  const [form, setForm] = useState<any>({});
  async function save(e: any) {
    e.preventDefault();
    if (kind === 'wydarzenia') await api.post('/api/wydarzenia', { ...form, data_start: form.data_start || new Date().toISOString(), data_koniec: form.data_koniec || new Date().toISOString() });
    if (kind === 'wynajmy') await api.post('/api/wynajmy', form);
    if (kind === 'urlopy') await api.post('/api/urlopy', form);
    onSaved();
  }
  return <SimpleModal title="Dodaj" onClose={onClose}><form onSubmit={save} className="space-y-4"><Field label="Rodzaj"><select className={inputClass} value={kind} onChange={e => setKind(e.target.value)}><option value="wydarzenia">Wydarzenie</option><option value="wynajmy">Wynajem</option><option value="urlopy">Urlop</option></select></Field>{kind === 'wydarzenia' && <div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa"><input className={inputClass} required value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} /></Field><Field label="Kontrahent"><select className={inputClass} value={form.id_kontrahenta || ''} onChange={e => setForm({ ...form, id_kontrahenta: e.target.value })}><option value="">Brak</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field><Field label="Typ"><select className={inputClass} value={form.id_typu_wydarzenia || ''} onChange={e => setForm({ ...form, id_typu_wydarzenia: e.target.value })}><option value="">Wybierz</option>{dict.typy.map((t: any) => <option key={t.id} value={t.id}>{t.nazwa}</option>)}</select></Field><Field label="Status"><select className={inputClass} value={form.id_statusu_wydarzenia || ''} onChange={e => setForm({ ...form, id_statusu_wydarzenia: e.target.value })}><option value="">Wybierz</option>{dict.statusy.map((s: any) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}</select></Field><Field label="Start"><input type="datetime-local" className={inputClass} onChange={e => setForm({ ...form, data_start: e.target.value })} /></Field><Field label="Koniec"><input type="datetime-local" className={inputClass} onChange={e => setForm({ ...form, data_koniec: e.target.value })} /></Field></div>}{kind === 'wynajmy' && <div className="grid gap-4 md:grid-cols-2"><Field label="Numer"><input className={inputClass} value={form.numer || ''} onChange={e => setForm({ ...form, numer: e.target.value })} /></Field><Field label="Kontrahent"><select className={inputClass} value={form.id_kontrahenta || ''} onChange={e => setForm({ ...form, id_kontrahenta: e.target.value })}><option value="">Brak</option>{dict.kontrahenci.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field><Field label="Wydanie"><input type="datetime-local" className={inputClass} onChange={e => setForm({ ...form, data_wydania: e.target.value })} /></Field><Field label="Zwrot planowany"><input type="datetime-local" className={inputClass} onChange={e => setForm({ ...form, data_zwrotu_planowana: e.target.value })} /></Field></div>}{kind === 'urlopy' && <div className="grid gap-4 md:grid-cols-2"><Field label="Osoba"><select className={inputClass} value={form.id_uzytkownika || ''} onChange={e => setForm({ ...form, id_uzytkownika: e.target.value })}>{dict.uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}</select></Field><Field label="Typ"><input className={inputClass} value={form.typ || 'urlop'} onChange={e => setForm({ ...form, typ: e.target.value })} /></Field><Field label="Od"><input type="date" className={inputClass} required onChange={e => setForm({ ...form, data_od: e.target.value })} /></Field><Field label="Do"><input type="date" className={inputClass} required onChange={e => setForm({ ...form, data_do: e.target.value })} /></Field></div>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>;
}
