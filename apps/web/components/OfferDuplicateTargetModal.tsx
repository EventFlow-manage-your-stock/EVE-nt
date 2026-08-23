'use client';

import { useEffect, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field, inputClass } from './ProductUI';
import { SimpleModal } from './SimpleModal';
import { QuickAddCalendarModal } from './QuickAddCalendarModal';

type Props = {
  offer: any;
  onClose: () => void;
  onDone?: (newOffer: any) => void;
  defaultEventId?: string | number | null;
  defaultRentalId?: string | number | null;
};

export function OfferDuplicateTargetModal({ offer, onClose, onDone, defaultEventId, defaultRentalId }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [mode, setMode] = useState(defaultRentalId ? 'rental' : 'event');
  const [eventId, setEventId] = useState(defaultEventId ? String(defaultEventId) : offer?.id_wydarzenia ? String(offer.id_wydarzenia) : 'none');
  const [rentalId, setRentalId] = useState(defaultRentalId ? String(defaultRentalId) : offer?.id_wynajmu ? String(offer.id_wynajmu) : 'none');
  
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDict, setQuickAddDict] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Ładowanie niezbędnych słowników przy montowaniu
  useEffect(() => {
    fetchLists();
    // Pobieramy słowniki potrzebne dla QuickAddCalendarModal
    Promise.all([
      api.get('/api/slowniki/typy-wydarzen').catch(() => ({ data: [] })),
      api.get('/api/slowniki/statusy-wydarzenia').catch(() => ({ data: [] })),
      api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
      api.get('/api/slowniki/miejsca').catch(() => ({ data: [] })),
      api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
    ]).then(([t, s, k, m, u]) => {
      setQuickAddDict({ typy: t.data, statusy: s.data, kontrahenci: k.data, miejsca: m.data, uzytkownicy: u.data });
    });
  }, []);

  async function fetchLists() {
    try {
      const [e, r] = await Promise.all([
        api.get('/api/wydarzenia'),
        api.get('/api/wynajmy'),
      ]);
      setEvents(e.data || []);
      setRentals(r.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function submit(e: any) {
    e.preventDefault();
    setError('');
    
    const payload: any = {};
    if (mode === 'event') {
      if (eventId === 'none') {
        payload.id_wydarzenia = null;
        payload.id_wynajmu = null;
      } else {
        if (!eventId) return setError('Wybierz wydarzenie dla duplikatu oferty.');
        payload.id_wydarzenia = Number(eventId);
        payload.id_wynajmu = null;
      }
    } else {
      if (rentalId === 'none') {
        payload.id_wynajmu = null;
        payload.id_wydarzenia = null;
      } else {
        if (!rentalId) return setError('Wybierz wynajem/wypożyczenie dla duplikatu oferty.');
        payload.id_wynajmu = Number(rentalId);
        payload.id_wydarzenia = null;
      }
    }

    setSaving(true);
    try {
      const res = await api.post(`/api/oferty/${offer.id}/duplikuj`, payload);
      onDone?.(res.data);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zduplikować oferty.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SimpleModal title="Duplikuj ofertę" onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Oferta źródłowa</p>
            <p className="mt-1 text-lg font-black text-slate-900">{offer?.numer || `#${offer?.id}`} · {offer?.nazwa}</p>
            <p className="text-sm font-bold text-slate-500">Duplikat dostanie nowy numer i oddzielną wersję roboczą.</p>
          </div>

          <Field label="Gdzie chcesz podpiąć duplikat oferty?">
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setMode('event')} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black ${mode === 'event' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600'}`}>Wydarzenia (Złożone Operacje)</button>
              <button type="button" onClick={() => setMode('rental')} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black ${mode === 'rental' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600'}`}>Wynajem sprzętu (Dry Hire)</button>
            </div>
          </Field>

          {mode === 'event' ? (
            <Field label="Wydarzenie docelowe">
              <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)} required>
                <option value="none" className="font-bold text-slate-400">Brak (Luźna kopia bez powiązania)</option>
                {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.numer ? `${ev.numer} · ` : ''}{ev.nazwa}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Wynajem docelowy">
              <select className={inputClass} value={rentalId} onChange={(e) => setRentalId(e.target.value)} required>
                <option value="none" className="font-bold text-slate-400">Brak (Luźna kopia bez powiązania)</option>
                {rentals.map((r: any) => <option key={r.id} value={r.id}>{r.numer || `Wynajem #${r.id}`} · {r.kontrahent?.nazwa || ''}</option>)}
              </select>
            </Field>
          )}

          <div className="text-center pt-2">
            <button type="button" onClick={() => setShowQuickAdd(true)} className="text-sm font-bold text-cyan-600 hover:text-cyan-800 transition flex items-center gap-1.5 mx-auto">
              <Plus size={16}/> Lub utwórz nowe wydarzenie/wynajem w systemie
            </button>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={saving}><Copy size={16} className="inline mr-1" /> {saving ? 'Zapisuję...' : 'Skopiuj ofertę'}</Button>
          </div>
        </form>
      </SimpleModal>

      {/* Modal nałożony do szybkiego tworzenia nowego wydarzenia / wynajmu przed duplikacją */}
      {showQuickAdd && (
        <QuickAddCalendarModal 
          dict={quickAddDict} 
          onClose={() => setShowQuickAdd(false)} 
          onSaved={async () => {
             await fetchLists();
             setShowQuickAdd(false);
          }} 
        />
      )}
    </>
  );
}