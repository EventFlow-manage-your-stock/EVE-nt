'use client';

import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field, inputClass } from './ProductUI';
import { SimpleModal } from './SimpleModal';

interface Props {
  mode: 'kontrahent' | 'kontakt';
  parentId?: string; // Używane tylko gdy dodajemy kontakt do istniejącej firmy
  onClose: () => void;
  onSuccess: (mode: 'kontrahent' | 'kontakt', data: any) => void;
}

export function QuickAddCrmModal({ mode, parentId, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [fetchingGus, setFetchingGus] = useState(false);
  const [error, setError] = useState('');

  // Funkcja pobierająca z GUS
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
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się pobrać danych z GUS.');
    } finally {
      setFetchingGus(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      if (mode === 'kontrahent') {
        const res = await api.post('/api/crm/kontrahenci', {
          ...form,
          czy_klient: true,
          zrodlo_danych: 'recznie'
        });
        onSuccess('kontrahent', res.data);
      } else {
        const res = await api.post('/api/crm/kontakty', {
          ...form,
          id_kontrahenta: parentId,
        });
        onSuccess('kontakt', res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać rekordu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SimpleModal 
      title={mode === 'kontrahent' ? 'Szybkie dodawanie firmy' : 'Szybkie dodawanie osoby'} 
      onClose={onClose}
    >
      <form onSubmit={save} className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {mode === 'kontrahent' ? (
          <>
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
                  {fetchingGus ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />} GUS
                </button>
              </div>
            </Field>
            <Field label="Nazwa firmy *">
              <input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} required autoFocus />
            </Field>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Imię"><input className={inputClass} value={form.imie || ''} onChange={(e) => setForm({ ...form, imie: e.target.value })} required autoFocus /></Field>
              <Field label="Nazwisko"><input className={inputClass} value={form.nazwisko || ''} onChange={(e) => setForm({ ...form, nazwisko: e.target.value })} required /></Field>
            </div>
            <Field label="Stanowisko"><input className={inputClass} value={form.stanowisko || ''} onChange={(e) => setForm({ ...form, stanowisko: e.target.value })} /></Field>
            <Field label="E-mail"><input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Telefon"><input className={inputClass} value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></Field>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button type="submit" disabled={saving}>Zapisz i wybierz</Button>
        </div>
      </form>
    </SimpleModal>
  );
}