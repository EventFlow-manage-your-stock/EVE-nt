'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { googleMapsDirectionsUrl } from '../lib/googleMaps';
import { Button, Field, inputClass, SearchableSelect } from './ProductUI';
import { SimpleModal } from './SimpleModal';
import { QuickAddCrmModal } from './QuickAddCrmModal'; // Dodany import

export type QuickAddDictionaries = {
  typy?: any[];
  statusy?: any[];
  kontrahenci?: any[];
  miejsca?: any[];
  uzytkownicy?: any[];
};

export function QuickAddCalendarModal({
  dict,
  onClose,
  onSaved,
  initialDate,
}: {
  dict: QuickAddDictionaries;
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date;
}) {
  const [form, setForm] = useState<any>(() => {
    const start = initialDate ? new Date(initialDate) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

    return {
      typ: 'wydarzenie',
      nazwa: '',
      startDate: startDateStr,
      startTime: '', 
      endDate: startDateStr,
      endTime: '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Stany przechowujące lokalne słowniki
  const [localKontrahenci, setLocalKontrahenci] = useState<any[]>(dict.kontrahenci || []);
  const [kontakty, setKontakty] = useState<any[]>([]);
  
  // Stan dla podmodala CRM
  const [crmModalMode, setCrmModalMode] = useState<'kontrahent' | 'kontakt' | null>(null);

  // Synchronizacja słownika prop z lokalnym stanem przy pierwszym renderowaniu
  useEffect(() => {
    setLocalKontrahenci(dict.kontrahenci || []);
  }, [dict.kontrahenci]);

  // Efekt nasłuchujący zmiany w wybranym kontrahencie
  useEffect(() => {
    if (form.id_kontrahenta) {
      api.get(`/api/crm/kontakty?kontrahentId=${form.id_kontrahenta}`)
         .then(res => setKontakty(res.data))
         .catch(() => setKontakty([]));
    } else {
      setKontakty([]);
    }
  }, [form.id_kontrahenta]);

  async function submit(e: any) {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      const payload = { ...form };
      
      payload.data_start = form.startTime 
        ? `${form.startDate}T${form.startTime}:00` 
        : `${form.startDate}T00:00:00`;
        
      payload.data_koniec = form.endTime 
        ? `${form.endDate}T${form.endTime}:00` 
        : `${form.endDate}T23:59:59`;

      await api.post('/api/kalendarz/szybkie-dodanie', payload);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Nie udało się zapisać wpisu.');
    } finally {
      setSaving(false);
    }
  }

  // Automatyczne podpięcie klienta lub kontaktu ze zagnieżdżonego modala
  function handleCrmSuccess(type: 'kontrahent' | 'kontakt', newData: any) {
    if (type === 'kontrahent') {
      setLocalKontrahenci(prev => [...prev, newData]);
      setForm((prev: any) => ({ ...prev, id_kontrahenta: String(newData.id), id_kontaktu: '' }));
    } else if (type === 'kontakt') {
      setKontakty(prev => [...prev, newData]);
      setForm((prev: any) => ({ ...prev, id_kontaktu: String(newData.id) }));
    }
    setCrmModalMode(null);
  }

  const maps = googleMapsDirectionsUrl(form.adres_reczny);
  const typ = form.typ;

  return (
    <>
      <SimpleModal title="Dodaj do kalendarza" onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Co dodajesz?">
              <select className={inputClass} value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value })}>
                <option value="wydarzenie">Wydarzenie</option>
                <option value="wypozyczenie">Wypożyczenie</option>
                <option value="spotkanie">Spotkanie</option>
                <option value="urlop">Urlop</option>
              </select>
            </Field>
            
            <Field label={typ === 'urlop' ? 'Nazwa / opis urlopu' : 'Nazwa'}>
              <input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} required={typ !== 'urlop'} />
            </Field>

            <Field label="Data startu">
              <input type="date" className={inputClass} value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </Field>
            <Field label="Godzina startu (Opcjonalnie)">
              <input type="time" className={inputClass} value={form.startTime || ''} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </Field>

            <Field label="Data końca">
              <input type="date" className={inputClass} value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            </Field>
            <Field label="Godzina końca (Opcjonalnie)">
              <input type="time" className={inputClass} value={form.endTime || ''} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Field>

            {typ === 'urlop' ? (
              <>
                <Field label="Pracownik">
                  <select className={inputClass} value={form.id_uzytkownika || ''} onChange={(e) => setForm({ ...form, id_uzytkownika: e.target.value })}>
                    <option value="">Ja / użytkownik zalogowany</option>
                    {(dict.uzytkownicy || []).map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}
                  </select>
                </Field>
                <Field label="Rodzaj nieobecności">
                  <input className={inputClass} value={form.rodzaj || 'urlop'} onChange={(e) => setForm({ ...form, rodzaj: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                {typ !== 'wypozyczenie' && typ !== 'spotkanie' ?(
                  <>
                    <Field label="Typ wydarzenia">
                      <select className={inputClass} value={form.id_typu_wydarzenia || ''} onChange={(e) => setForm({ ...form, id_typu_wydarzenia: e.target.value })}>
                        <option value="">Wybierz</option>
                        {(dict.typy || []).map((t: any) => <option key={t.id} value={t.id}>{t.nazwa}</option>)}
                      </select>
                    </Field>
                  </>
                ):(<></>)}
                <Field label="Status">
                <select className={inputClass} value={form.id_statusu_wydarzenia || ''} onChange={(e) => setForm({ ...form, id_statusu_wydarzenia: e.target.value })}>
                  <option value="">Wybierz</option>
                  {(dict.statusy || []).map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '●'} {s.nazwa}</option>)}
                </select>
              </Field>

              <Field label="Klient">
                <SearchableSelect
                  value={form.id_kontrahenta || ''}
                  onChange={(val) => setForm({ ...form, id_kontrahenta: val })}
                  options={(dict.kontrahenci || []).map((k: any) => ({ id: k.id, label: k.nazwa }))}
                  placeholder="Brak / wpiszę później"
                />
              </Field>

                <Field label="Osoba kontaktowa">
                  <div className="flex gap-2">
                    <select className={`${inputClass} flex-1 disabled:opacity-50`} disabled={!form.id_kontrahenta} value={form.id_kontaktu || ''} onChange={(e) => setForm({ ...form, id_kontaktu: e.target.value })}>
                      <option value="">{form.id_kontrahenta ? 'Wybierz osobę...' : 'Najpierw wybierz klienta'}</option>
                      {kontakty.map((k: any) => (
                        <option key={k.id} value={k.id}>{k.imie} {k.nazwisko} {k.stanowisko ? `(${k.stanowisko})` : ''}</option>
                      ))}
                    </select>
                    <button type="button" disabled={!form.id_kontrahenta} onClick={() => setCrmModalMode('kontakt')} className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 disabled:pointer-events-none" title="Dodaj nową osobę kontaktową dla tego klienta">
                      <Plus size={18} />
                    </button>
                  </div>
                </Field>

                <Field label="Miejsce z bazy">
                  <select className={inputClass} value={form.id_miejsca || ''} onChange={(e) => setForm({ ...form, id_miejsca: e.target.value })}>
                    <option value="">Dodam ręcznie</option>
                    {(dict.miejsca || []).map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </Field>
                <Field label="Miejsce ręcznie">
                  <input className={inputClass} value={form.miejsce_reczne || ''} onChange={(e) => setForm({ ...form, miejsce_reczne: e.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Adres / Google Maps">
                    <input className={inputClass} value={form.adres_reczny || ''} onChange={(e) => setForm({ ...form, adres_reczny: e.target.value })} />
                    {maps && <a className="mt-2 inline-flex items-center gap-1 text-xs font-black text-cyan-700" href={maps} target="_blank" rel="noreferrer"><MapPin size={13} /> Sprawdź trasę w Google Maps</a>}
                  </Field>
                </div>
              </>
            )}
          </div>
          <Field label="Opis">
            <textarea className={inputClass} value={form.opis || ''} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
          </div>
        </form>
      </SimpleModal>

      {/* MODAL SZYBKIEGO DODAWANIA KLIENTA / KONTAKTU */}
      {crmModalMode && (
        <QuickAddCrmModal 
          mode={crmModalMode} 
          parentId={form.id_kontrahenta}
          onClose={() => setCrmModalMode(null)} 
          onSuccess={handleCrmSuccess} 
        />
      )}
    </>
  );
}