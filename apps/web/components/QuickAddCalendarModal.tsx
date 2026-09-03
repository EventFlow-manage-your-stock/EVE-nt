'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { googleMapsDirectionsUrl } from '../lib/googleMaps';
import { Button, Field, inputClass, SearchableSelect } from './ProductUI';
import { SimpleModal } from './SimpleModal';
import { QuickAddCrmModal } from './QuickAddCrmModal';

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
  initialKind = 'wydarzenie',
}: {
  dict: QuickAddDictionaries;
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date;
  initialKind?: 'wydarzenie' | 'wypozyczenie' | 'urlop' | 'inne' | 'spotkanie';
}) {
  const [form, setForm] = useState<any>(() => {
    const start = initialDate ? new Date(initialDate) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

    return {
      typ: initialKind,
      nazwa: '',
      startDate: startDateStr,
      startTime: '', 
      endDate: startDateStr,
      endTime: '',
      id_kontrahenta: '',
      id_kontaktu: '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [localKontrahenci, setLocalKontrahenci] = useState<any[]>(dict.kontrahenci || []);
  const [kontakty, setKontakty] = useState<any[]>([]);
  const [crmModalMode, setCrmModalMode] = useState<'kontrahent' | 'kontakt' | null>(null);

  useEffect(() => {
    setLocalKontrahenci(dict.kontrahenci || []);
  }, [dict.kontrahenci]);

  useEffect(() => {
    if (form.id_kontrahenta) {
      api.get(`/api/crm/kontakty?kontrahentId=${form.id_kontrahenta}`)
         .then(res => setKontakty(res.data || []))
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
      const payload: any = { ...form };
      
      if (form.typ === 'inne') {
        payload.typ = 'wydarzenie';
      }

      payload.data_start = form.startTime 
        ? `${form.startDate}T${form.startTime}:00` 
        : `${form.startDate}T00:00:00`;
        
      payload.data_koniec = form.endTime 
        ? `${form.endDate}T${form.endTime}:00` 
        : `${form.endDate}T23:59:59`;

      // Precyzyjna normalizacja powiązań CRM dla backendu
      payload.id_kontrahenta = form.id_kontrahenta ? Number(form.id_kontrahenta) : null;
      payload.id_kontaktu = form.id_kontaktu ? Number(form.id_kontaktu) : null;
      payload.id_typu_wydarzenia = form.id_typu_wydarzenia ? Number(form.id_typu_wydarzenia) : null;
      payload.id_statusu_wydarzenia = form.id_statusu_wydarzenia ? Number(form.id_statusu_wydarzenia) : null;
      payload.id_miejsca = form.id_miejsca ? Number(form.id_miejsca) : null;

      await api.post('/api/kalendarz/szybkie-dodanie', payload);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Nie udało się zapisać wpisu.');
    } finally {
      setSaving(false);
    }
  }

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

  const currentTypesList = useMemo(() => {
    const all = dict.typy || [];
    if (form.typ === 'inne') {
      return all.filter((t: any) => t.kategoria_glowna === 'inne');
    }
    if (form.typ === 'spotkanie') {
      return all.filter((t: any) => t.kategoria_glowna === 'spotkanie');
    }
    if (form.typ === 'wynajem' || form.typ === 'wypozyczenie') {
      return all.filter((t: any) => t.kategoria_glowna === 'wynajem' || t.kategoria_glowna === 'wypozyczenie');
    }
    return all.filter((t: any) => !t.kategoria_glowna || t.kategoria_glowna === 'wydarzenie');
  }, [dict.typy, form.typ]);

  return (
    <>
      <SimpleModal title="Dodaj do kalendarza" onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Co dodajesz?">
              <select 
                className={inputClass} 
                value={form.typ} 
                onChange={(e) => setForm({ ...form, typ: e.target.value, id_typu_wydarzenia: '' })}
              >
                <option value="wydarzenie">Wydarzenie</option>
                <option value="wypozyczenie">Wypożyczenie</option>
                <option value="spotkanie">Spotkanie</option>
                <option value="inne">Inne (Zdarzenie firmowe / Wewnętrzne)</option>
                <option value="urlop">Urlop / Nieobecność</option>
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
                {typ !== 'wypozyczenie' && typ !== 'spotkanie' && (
                  <Field label={typ === 'inne' ? "Typ zdarzenia firmowego" : "Typ wydarzenia"}>
                    <select className={inputClass} value={form.id_typu_wydarzenia || ''} onChange={(e) => setForm({ ...form, id_typu_wydarzenia: e.target.value })}>
                      <option value="">Wybierz</option>
                      {currentTypesList.map((t: any) => <option key={t.id} value={t.id}>{t.nazwa}</option>)}
                    </select>
                  </Field>
                )}
                
                <Field label="Status">
                  <select className={inputClass} value={form.id_statusu_wydarzenia || ''} onChange={(e) => setForm({ ...form, id_statusu_wydarzenia: e.target.value })}>
                    <option value="">Wybierz</option>
                    {(dict.statusy || []).map((s: any) => <option key={s.id} value={s.id}>{s.ikona || '●'} {s.nazwa}</option>)}
                  </select>
                </Field>

                {/* KLIENT Z PEŁNĄ ZGODNOŚCIĄ SearchableSelect */}
                <Field label="Klient">
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={form.id_kontrahenta ? String(form.id_kontrahenta) : ''}
                        onChange={(val) => setForm({ ...form, id_kontrahenta: val ? String(val) : '', id_kontaktu: '' })}
                        options={(localKontrahenci || []).map((k: any) => ({
                          id: k.id,
                          value: String(k.id),
                          label: k.nazwa || `${k.imie || ''} ${k.nazwisko || ''}`.trim()
                        }))}
                        placeholder="Brak / wpiszę później"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setCrmModalMode('kontrahent')} 
                      className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                      title="Dodaj klienta"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </Field>

                {/* OSOBA KONTAKTOWA Z SearchableSelect */}
                <Field label="Osoba kontaktowa">
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={form.id_kontaktu ? String(form.id_kontaktu) : ''}
                        onChange={(val) => setForm({ ...form, id_kontaktu: val ? String(val) : '' })}
                        options={(kontakty || []).map((k: any) => ({
                          id: k.id,
                          value: String(k.id),
                          label: `${k.imie || ''} ${k.nazwisko || ''} ${k.stanowisko ? `(${k.stanowisko})` : ''}`.trim() || `Kontakt #${k.id}`
                        }))}
                        placeholder={form.id_kontrahenta ? "Wybierz osobę..." : "Najpierw wybierz klienta"}
                        disabled={!form.id_kontrahenta}
                      />
                    </div>
                    <button 
                      type="button" 
                      disabled={!form.id_kontrahenta} 
                      onClick={() => setCrmModalMode('kontakt')} 
                      className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50 disabled:pointer-events-none" 
                      title="Dodaj nową osobę kontaktową"
                    >
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