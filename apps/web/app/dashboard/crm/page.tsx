'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Building2, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

export default function CrmPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [fetchingGus, setFetchingGus] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const url = search ? `/api/crm/kontrahenci?search=${encodeURIComponent(search)}` : '/api/crm/kontrahenci';
      const res = await api.get(url);
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Prosty debounce dla wyszukiwania
    const delay = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(delay);
  }, [search]);

  // Pobieranie danych o firmie z MF / GUS
  async function fetchGusData() {
    if (!form.nip) return;
    setFetchingGus(true);
    setError('');
    try {
      const res = await api.get(`/api/gus/${form.nip.replace(/[\s-]/g, '')}`);
      const data = res.data;
      setForm((prev: any) => ({
        ...prev,
        nazwa: data.nazwa || prev.nazwa,
        ulica: data.ulica || prev.ulica,
        kod_pocztowy: data.kod_pocztowy || prev.kod_pocztowy,
        miasto: data.miasto || prev.miasto,
        regon: data.regon || prev.regon,
        krs: data.krs || prev.krs,
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się pobrać danych z GUS. Sprawdź czy NIP jest poprawny.');
    } finally {
      setFetchingGus(false);
    }
  }

  async function save(e: any) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await api.post('/api/crm/kontrahenci', {
        ...form,
        czy_klient: true, 
        zrodlo_danych: 'recznie'
      });
      
      setShowAdd(false);
      setForm({});
      // Automatyczne przejście do edycji nowo dodanego klienta
      router.push(`/dashboard/crm/${res.data.id}`);

    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Nie udało się dodać kontrahenta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle 
        eyebrow="CRM" 
        title="Baza kontrahentów" 
        description="Zarządzaj swoimi klientami i dostawcami. NIP dla każdego kontrahenta musi być unikalny w systemie." 
        action={<Button onClick={() => setShowAdd(true)}><Plus size={16} className="inline mr-1" /> Dodaj klienta</Button>} 
      />

      <Card>
        <div className="mb-4 relative max-w-md">
           <Search size={16} className="absolute left-3 top-3 text-slate-400" />
           <input 
             className={`${inputClass} pl-9`} 
             value={search} 
             onChange={(e) => setSearch(e.target.value)} 
             placeholder="Szukaj po nazwie, NIP lub emailu..." 
           />
        </div>

        {loading ? (
          <p className="p-8 text-center font-bold text-slate-400">Ładowanie kontrahentów...</p>
        ) : (
          <DataTable 
            rows={items} 
            onRowClick={(r: any) => router.push(`/dashboard/crm/${r.id}`)} 
            columns={[
              { key: 'nazwa', label: 'Nazwa firmy', value: (r: any) => <b className="text-cyan-700">{r.nazwa}</b> }, 
              { key: 'nip', label: 'NIP' }, 
              { key: 'email', label: 'E-mail' }, 
              { key: 'telefon', label: 'Telefon' }, 
              { key: 'miasto', label: 'Miasto' },
              { key: 'kontakty', label: 'Os. kontaktowych', value: (r: any) => r._count?.kontakty || 0 },
              { key: 'wydarzenia', label: 'Wydarzenia', value: (r: any) => r._count?.wydarzenia || 0 }
            ]} 
          />
        )}
      </Card>

      {showAdd && (
        <SimpleModal title="Nowy klient" onClose={() => setShowAdd(false)}>
          <form onSubmit={save} className="space-y-4">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="NIP">
                  <div className="flex gap-2">
                    <input 
                      className={inputClass} 
                      value={form.nip || ''} 
                      onChange={(e) => setForm({ ...form, nip: e.target.value })} 
                      placeholder="Wpisz NIP..." 
                    />
                    <button 
                      type="button" 
                      onClick={fetchGusData} 
                      disabled={!form.nip || fetchingGus} 
                      className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition"
                    >
                      {fetchingGus ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />} Pobierz z GUS
                    </button>
                  </div>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Nazwa firmy / Klienta *">
                  <input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} required />
                </Field>
              </div>
              <Field label="E-mail ogólny">
                <input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Telefon">
                <input className={inputClass} value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
              </Field>
              <Field label="Ulica">
                <input className={inputClass} value={form.ulica || ''} onChange={(e) => setForm({ ...form, ulica: e.target.value })} />
              </Field>
              <Field label="Kod pocztowy">
                <input className={inputClass} value={form.kod_pocztowy || ''} onChange={(e) => setForm({ ...form, kod_pocztowy: e.target.value })} />
              </Field>
              <Field label="Miasto">
                <input className={inputClass} value={form.miasto || ''} onChange={(e) => setForm({ ...form, miasto: e.target.value })} />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Anuluj</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Trwa zapisywanie...' : 'Utwórz i przejdź do edycji'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}