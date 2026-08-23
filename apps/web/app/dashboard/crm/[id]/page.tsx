'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Users, Search, Mail, Phone, Plus } from 'lucide-react';
import { EntityEditorPage } from '../../../../components/EntityEditorPage';
import { DataTable } from '../../../../components/DataTable';
import { Button, Field, inputClass } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';
import { api } from '../../../../lib/api';

// Pomocnicza funkcja do formatowania walut
function money(v: any) {
  return `${Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

// ==========================================
// SUBKOMPONENTY ZAKŁADEK
// ==========================================

function ContactsTab({ contacts, kontrahentId }: { contacts: any[], kontrahentId: number }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ glowny: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/crm/kontakty', {
        ...form,
        id_kontrahenta: kontrahentId
      });
      setShowModal(false);
      setForm({ glowny: false });
      
      // Proste wymuszenie odświeżenia widoku z bazy danych
      window.location.reload();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się dodać kontaktu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-black text-slate-900">Osoby kontaktowe ({contacts?.length || 0})</h3>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="inline mr-1" /> Dodaj szybki kontakt
        </Button>
      </div>

      {!contacts || contacts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Brak przypisanych kontaktów do tego kontrahenta.</p>
      ) : (
        <DataTable
          rows={contacts}
          columns={[
            { 
              key: 'nazwisko', 
              label: 'Imię i nazwisko', 
              value: (r: any) => (
                <span className="font-bold text-slate-900">
                  {r.imie} {r.nazwisko} {r.glowny && <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-700">Główny</span>}
                </span>
              ) 
            },
            { key: 'stanowisko', label: 'Stanowisko', value: (r: any) => r.stanowisko || '-' },
            { 
              key: 'email', 
              label: 'E-mail', 
              value: (r: any) => r.email ? <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-cyan-700 hover:underline"><Mail size={14}/> {r.email}</a> : '-' 
            },
            { 
              key: 'telefon', 
              label: 'Telefon', 
              value: (r: any) => r.telefon ? <a href={`tel:${r.telefon}`} className="flex items-center gap-1 text-slate-600 hover:text-cyan-700"><Phone size={14}/> {r.telefon}</a> : '-' 
            },
          ]}
        />
      )}

      {showModal && (
        <SimpleModal title="Nowy kontakt" onClose={() => setShowModal(false)}>
          {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <form onSubmit={saveContact} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Imię"><input className={inputClass} value={form.imie || ''} onChange={e => setForm({...form, imie: e.target.value})} required /></Field>
              <Field label="Nazwisko"><input className={inputClass} value={form.nazwisko || ''} onChange={e => setForm({...form, nazwisko: e.target.value})} required /></Field>
              <Field label="E-mail"><input type="email" className={inputClass} value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></Field>
              <Field label="Telefon"><input type="tel" className={inputClass} value={form.telefon || ''} onChange={e => setForm({...form, telefon: e.target.value})} /></Field>
              <Field label="Stanowisko"><input className={inputClass} value={form.stanowisko || ''} onChange={e => setForm({...form, stanowisko: e.target.value})} /></Field>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-black cursor-pointer hover:bg-slate-50 transition">
              <input type="checkbox" checked={!!form.glowny} onChange={e => setForm({...form, glowny: e.target.checked})} className="w-5 h-5 accent-cyan-600 cursor-pointer" />
              Oznacz jako główną osobę decyzyjną
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Anuluj</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Zapisywanie...' : 'Zapisz kontakt'}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}

function EventsTab({ events }: { events: any[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    return (events || []).filter((e: any) => {
      if (status && e.status?.nazwa !== status) return false;
      if (search && !e.nazwa.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, search, status]);

  const uniqueStatuses = useMemo(() => Array.from(new Set((events || []).map(e => e.status?.nazwa).filter(Boolean))), [events]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-black text-slate-900">Historia wydarzeń</h3>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input 
              placeholder="Szukaj wydarzenia..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className={`${inputClass} pl-9`} 
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`${inputClass} min-w-[180px]`}>
            <option value="">Wszystkie statusy</option>
            {uniqueStatuses.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Brak wydarzeń spełniających kryteria.</p>
      ) : (
        <DataTable
          rows={filtered}
          onRowClick={(r: any) => router.push(`/dashboard/events/${r.id}`)}
          columns={[
            { key: 'nazwa', label: 'Nazwa wydarzenia', value: (r: any) => <span className="font-bold text-cyan-700 hover:underline">{r.nazwa}</span> },
            { key: 'data_start', label: 'Data', value: (r: any) => r.data_start ? new Date(r.data_start).toLocaleDateString('pl-PL') : '-' },
            { key: 'typ', label: 'Typ', value: (r: any) => r.typ?.nazwa || '-' },
            { key: 'status', label: 'Status', value: (r: any) => r.status ? <span className="rounded-xl px-3 py-1.5 text-xs font-black text-white shadow-sm" style={{ backgroundColor: r.status.kolor || '#64748B' }}>{r.status.ikona || '●'} {r.status.nazwa}</span> : '-' },
            { key: 'manager', label: 'Manager', value: (r: any) => r.manager ? `${r.manager.imie} ${r.manager.nazwisko}` : '-' },
          ]}
        />
      )}
    </div>
  );
}

function OffersTab({ offers }: { offers: any[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    return (offers || []).filter((o: any) => {
      if (status && o.status?.nazwa !== status) return false;
      if (search && !`${o.numer} ${o.nazwa}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [offers, search, status]);

  const uniqueStatuses = useMemo(() => Array.from(new Set((offers || []).map(o => o.status?.nazwa).filter(Boolean))), [offers]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-black text-slate-900">Historia wycen i ofert</h3>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input 
              placeholder="Szukaj po numerze / nazwie..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className={`${inputClass} pl-9`} 
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`${inputClass} min-w-[180px]`}>
            <option value="">Wszystkie statusy</option>
            {uniqueStatuses.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Brak ofert spełniających kryteria.</p>
      ) : (
        <DataTable
          rows={filtered}
          onRowClick={(r: any) => router.push(`/dashboard/offers/${r.id}`)}
          columns={[
            { key: 'numer', label: 'Numer', value: (r: any) => <span className="font-black text-slate-600">{r.numer || `#${r.id}`}</span> },
            { key: 'nazwa', label: 'Nazwa', value: (r: any) => <span className="font-bold text-cyan-700 hover:underline">{r.nazwa}</span> },
            { key: 'data', label: 'Data utworzenia', value: (r: any) => r.data_sporzadzenia ? new Date(r.data_sporzadzenia).toLocaleDateString('pl-PL') : '-' },
            { key: 'status', label: 'Status', value: (r: any) => r.status?.nazwa ? <span className="font-bold text-slate-600">{r.status.nazwa}</span> : 'Nowa' },
            { key: 'suma_netto', label: 'Suma netto', value: (r: any) => <span className="font-black text-slate-900">{money(r.suma_netto)}</span> },
          ]}
        />
      )}
    </div>
  );
}

// ==========================================
// GŁÓWNY KOMPONENT STRONY
// ==========================================

export default function ContractorEditorPage() {
  return (
    <EntityEditorPage 
      config={{
        moduleLabel: 'Kontrahenci',
        title: 'Edycja kontrahenta',
        listHref: '/dashboard/crm',
        getEndpoint: (id) => `/api/crm/kontrahenci/${id}`,
        updateEndpoint: (id) => `/api/crm/kontrahenci/${id}`,
        deleteEndpoint: (id) => `/api/crm/kontrahenci/${id}`,
        titleFromRecord: (r) => r.nazwa || `Kontrahent #${r.id}`,
        subtitleFromRecord: (r) => [r.nip ? `NIP ${r.nip}` : null, r.email].filter(Boolean).join(' • '),
        
        // Zabezpieczenie: Domyślnie ładujemy zakładkę z kontaktami
        defaultTab: 'kontakty',
        
        // Zdefiniowane zakładki z naszymi nowymi komponentami
        tabs: [
          { id: 'kontakty', label: 'Kontakty', icon: Users, render: (r) => <ContactsTab contacts={r?.kontakty || []} kontrahentId={r?.id} /> },
          { id: 'wydarzenia', label: 'Wydarzenia', icon: Calendar, render: (r) => <EventsTab events={r?.wydarzenia || []} /> },
          { id: 'oferty', label: 'Oferty / Wyceny', icon: DollarSign, render: (r) => <OffersTab offers={r?.oferty || []} /> },
        ],
        
        fields: [
          { key: 'nazwa', label: 'Nazwa firmy / klienta' },
          { key: 'nazwa_skrocona', label: 'Nazwa skrócona' },
          { key: 'nip', label: 'NIP' },
          { key: 'regon', label: 'REGON' },
          { key: 'krs', label: 'KRS' },
          { key: 'kraj', label: 'Kraj' },
          { key: 'miasto', label: 'Miasto' },
          { key: 'kod_pocztowy', label: 'Kod pocztowy' },
          { key: 'ulica', label: 'Adres / ulica', colSpan: 'full' },
          { key: 'email', label: 'Główny e-mail' },
          { key: 'telefon', label: 'Główny telefon' },
          { key: 'nr_konta', label: 'Numer konta bankowego' },
          { key: 'czy_klient', label: 'Klient (Odbiorca)', type: 'checkbox' },
          { key: 'czy_dostawca', label: 'Dostawca (Podwykonawca)', type: 'checkbox' },
          { key: 'uwagi', label: 'Wewnętrzne uwagi i notatki', type: 'textarea' },
        ],
      }} 
    />
  );
}