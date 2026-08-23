'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, Search, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle, SearchableSelect } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';
import { OfferDuplicateTargetModal } from '../../../components/OfferDuplicateTargetModal';

// EVENTFLOW_PRODUCT_POLISH_V17:
// Lista ofert dalej pokazuje wszystkie oferty, ale duplikacja zawsze pyta użytkownika,
// do którego wydarzenia albo wynajmu przypisać nową kopię.
export default function OffersPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [kontrahenci, setKontrahenci] = useState<any[]>([]);
  const [statusy, setStatusy] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Stan filtrów
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    kontrahent: '',
    wydarzenie: ''
  });

  async function load() {
    setLoading(true);
    try {
      const [o, e, w, k, s] = await Promise.all([
        api.get('/api/oferty').catch(() => ({ data: [] })),
        api.get('/api/wydarzenia').catch(() => ({ data: [] })),
        api.get('/api/wynajmy').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-ofert').catch(() => ({ data: [] })),
      ]);
      setItems(o.data || []);
      setEvents(e.data || []);
      setRentals(w.data || []);
      setKontrahenci(k.data || []);
      setStatusy(s.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: any) {
    e.preventDefault();
    const r = await api.post('/api/oferty', form);
    setShow(false);
    router.push(`/dashboard/offers/${r.data.id}`);
  }

  const filteredItems = useMemo(() => {
    return items.filter((o: any) => {
      if (filters.status && String(o.id_statusu_oferty || o.status?.id) !== filters.status) return false;
      if (filters.kontrahent && String(o.id_kontrahenta || o.kontrahent?.id) !== filters.kontrahent) return false;
      if (filters.wydarzenie && String(o.id_wydarzenia || o.wydarzenie?.id) !== filters.wydarzenie) return false;
      
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = `${o.numer || ''} ${o.nazwa || ''} ${o.kontrahent?.nazwa || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  return (
    <div className="mx-auto max-w-[1650px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="Oferty"
        title="Lista ofert"
        description="Oferty mogą być przypisane do wydarzenia albo bezpośrednio do wynajmu. Jeden event/wynajem może mieć wiele ofert."
        action={<Button onClick={() => setShow(true)}><Plus size={16} className="inline mr-1" /> Dodaj ofertę</Button>}
      />

      <Card className="!p-4 border-slate-200 shadow-sm">
        {/* Panel filtrów */}
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Wyszukaj">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                className={`${inputClass} pl-9`}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Numer, nazwa, klient..."
              />
            </div>
          </Field>
          
          <Field label="Status">
            <select
              className={inputClass}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Wszystkie</option>
              {statusy.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nazwa}</option>
              ))}
            </select>
          </Field>

          <Field label="Klient">
            <select
              className={inputClass}
              value={filters.kontrahent}
              onChange={(e) => setFilters({ ...filters, kontrahent: e.target.value })}
            >
              <option value="">Wszyscy</option>
              {kontrahenci.map((k: any) => (
                <option key={k.id} value={k.id}>{k.nazwa}</option>
              ))}
            </select>
          </Field>

          <Field label="Wydarzenie">
            <select
              className={inputClass}
              value={filters.wydarzenie}
              onChange={(e) => setFilters({ ...filters, wydarzenie: e.target.value })}
            >
              <option value="">Wszystkie</option>
              {events.map((ev: any) => (
                <option key={ev.id} value={ev.id}>{ev.numer ? `${ev.numer} · ` : ''}{ev.nazwa}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">Wyniki wyszukiwania</h2>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">{filteredItems.length} ofert</span>
        </div>
        
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        ) : (
          <DataTable
            rows={filteredItems}
            onRowClick={(r: any) => router.push(`/dashboard/offers/${r.id}`)}
            columns={[
              { key: 'numer', label: 'Numer', value: (r: any) => <b>{r.numer || `#${r.id}`}</b> },
              { key: 'nazwa', label: 'Nazwa', value: (r: any) => <span className="font-bold text-cyan-700">{r.nazwa}</span> },
              { key: 'wydarzenie', label: 'Wydarzenie', value: (r: any) => r.wydarzenie?.nazwa || '-' },
              { key: 'wynajem', label: 'Wynajem', value: (r: any) => r.wynajem?.numer || (r.id_wynajmu ? `#${r.id_wynajmu}` : '-') },
              { key: 'kontrahent', label: 'Klient', value: (r: any) => r.kontrahent?.nazwa || '-' },
              { key: 'status', label: 'Status', value: (r: any) => r.status?.nazwa ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{r.status.nazwa}</span> : '-' },
              { key: 'suma_netto', label: 'Netto', value: (r: any) => <span className="font-black text-slate-800">{Number(r.suma_netto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</span> },
              { key: 'akcje', label: 'Akcje', value: (r: any) => <button onClick={(e) => { e.stopPropagation(); setDuplicateTarget(r); }} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-black hover:bg-slate-50 transition"><Copy size={13} /> Duplikuj</button> },
            ]}
            empty="Brak ofert spełniających wybrane kryteria."
          />
        )}
      </Card>

      {show && (
        <SimpleModal title="Dodaj ofertę" onClose={() => setShow(false)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Wydarzenie">
              <select className={inputClass} value={form.id_wydarzenia || ''} onChange={(e) => { const ev = events.find((x: any) => String(x.id) === e.target.value); setForm({ ...form, id_wydarzenia: e.target.value, id_wynajmu: '', nazwa: form.nazwa || ev?.nazwa, id_kontrahenta: form.id_kontrahenta || ev?.id_kontrahenta }); }}>
                <option value="">Brak / wybierz wynajem poniżej</option>
                {events.map((e: any) => <option key={e.id} value={e.id}>{e.numer ? `${e.numer} · ` : ''}{e.nazwa}</option>)}
              </select>
            </Field>
            <Field label="Wynajem">
              <select className={inputClass} value={form.id_wynajmu || ''} onChange={(e) => { const w = rentals.find((x: any) => String(x.id) === e.target.value); setForm({ ...form, id_wynajmu: e.target.value, id_wydarzenia: '', nazwa: form.nazwa || `Oferta ${w?.numer || ''}`, id_kontrahenta: form.id_kontrahenta || w?.id_kontrahenta }); }}>
                <option value="">Brak</option>
                {rentals.map((w: any) => <option key={w.id} value={w.id}>{w.numer || `Wynajem #${w.id}`} · {w.kontrahent?.nazwa || ''}</option>)}
              </select>
              <p className="mt-1 text-xs font-bold text-slate-400">Wynajem jest osobnym bytem i może mieć wiele ofert roboczych. Nie łączymy go automatycznie z wydarzeniem.</p>
            </Field>
            <Field label="Skopiuj dane z innej oferty / szablon">
              <select className={inputClass} value={form.id_oferty_szablonu || ''} onChange={(e) => { const src = items.find((x: any) => String(x.id) === e.target.value); setForm({ ...form, id_oferty_szablonu: e.target.value, nazwa: form.nazwa || src?.nazwa, budzet_netto: form.budzet_netto || src?.budzet_netto }); }}>
                <option value="">Nie kopiuj — czysta oferta</option>
                {items.map((o: any) => <option key={o.id} value={o.id}>{o.numer || `#${o.id}`} · {o.nazwa}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nazwa oferty"><input className={inputClass} required value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} /></Field>
              
              <Field label="Kontrahent">
                <SearchableSelect
                  value={form.id_kontrahenta || ''}
                  onChange={(val) => setForm({ ...form, id_kontrahenta: val })}
                  options={(kontrahenci || []).map((k: any) => ({ value: String(k.id), label: k.nazwa }))}
                  placeholder="Brak / przypisz później"
                />
              </Field>

              <Field label="Budżet netto"><input type="number" step="0.01" className={inputClass} value={form.budzet_netto || ''} onChange={(e) => setForm({ ...form, budzet_netto: e.target.value })} /></Field>
              <Field label="Termin płatności (dni)"><input type="number" className={inputClass} value={form.termin_platnosci_dni || 14} onChange={(e) => setForm({ ...form, termin_platnosci_dni: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button>
              <Button type="submit">Utwórz ofertę</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {duplicateTarget && <OfferDuplicateTargetModal offer={duplicateTarget} onClose={() => setDuplicateTarget(null)} onDone={(o) => router.push(`/dashboard/offers/${o.id}`)} />}
    </div>
  );
}