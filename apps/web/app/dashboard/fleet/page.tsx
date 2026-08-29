'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Car, 
  AlertTriangle, 
  CalendarDays, 
  Wrench, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Filter
} from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function d(v: any) { 
  return v ? new Date(v).toLocaleDateString('pl-PL') : '-'; 
}

function num(v: any) { 
  return v === '' || v == null ? null : Number(v); 
}

function payload(form: any) {
  return {
    ...form,
    przebieg_km: num(form.przebieg_km),
    rok_produkcji: num(form.rok_produkcji),
    ladownosc_kg: num(form.ladownosc_kg),
    objetosc_m3: num(form.objetosc_m3),
    zdjecie: form.zdjecie || null,
  };
}

function getDaysDifference(targetDate: string | Date | null | undefined): number | null {
  if (!targetDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export default function FleetPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ status: 'Dostępny' });
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  // Filtry kalendarza
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<'all' | 'przeglad' | 'oc' | 'serwis'>('all');
  const [calendarUrgencyFilter, setCalendarUrgencyFilter] = useState<'all' | 'overdue' | 'soon'>('all');

  async function load() {
    const r = await api.get('/api/flota/pojazdy').catch(() => ({ data: [] }));
    setItems(r.data || []);
  }

  useEffect(() => { load(); }, []);

  const rawCalendar = useMemo(() => items.flatMap((p: any) => {
    const list: any[] = [];
    
    if (p.data_przegladu) {
      const days = getDaysDifference(p.data_przegladu);
      list.push({
        id: `p-${p.id}`,
        vehicleId: p.id,
        vehicleName: p.nazwa,
        plate: p.nr_rejestracyjny,
        type: 'przeglad',
        date: p.data_przegladu,
        title: `Przegląd techniczny SKP: ${p.nazwa}`,
        daysRemaining: days,
        isOverdue: days !== null && days < 0,
        isSoon: days !== null && days >= 0 && days <= 30,
      });
    }

    if (p.data_oc) {
      const days = getDaysDifference(p.data_oc);
      list.push({
        id: `oc-${p.id}`,
        vehicleId: p.id,
        vehicleName: p.nazwa,
        plate: p.nr_rejestracyjny,
        type: 'oc',
        date: p.data_oc,
        title: `Ważność polisy OC: ${p.nazwa}`,
        daysRemaining: days,
        isOverdue: days !== null && days < 0,
        isSoon: days !== null && days >= 0 && days <= 30,
      });
    }

    (p.serwisy_pojazdu || []).forEach((s: any) => {
      const days = getDaysDifference(s.data_serwisu);
      list.push({
        id: `s-${s.id}`,
        vehicleId: p.id,
        vehicleName: p.nazwa,
        plate: p.nr_rejestracyjny,
        type: 'serwis',
        date: s.data_serwisu,
        title: `Serwis: ${p.nazwa} (${s.opis || 'Prace warsztatowe'})`,
        status: s.status,
        daysRemaining: days,
        isOverdue: false,
        isSoon: false,
      });
    });

    return list;
  }), [items]);

  const filteredCalendar = useMemo(() => {
    return rawCalendar
      .filter((item) => {
        if (calendarTypeFilter !== 'all' && item.type !== calendarTypeFilter) return false;
        if (calendarUrgencyFilter === 'overdue' && !item.isOverdue) return false;
        if (calendarUrgencyFilter === 'soon' && !item.isSoon) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [rawCalendar, calendarTypeFilter, calendarUrgencyFilter]);

  const calendarAlertsCount = useMemo(() => {
    const overdue = rawCalendar.filter((i) => i.isOverdue).length;
    const soon = rawCalendar.filter((i) => i.isSoon).length;
    return { overdue, soon };
  }, [rawCalendar]);

  async function save(e: any) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/flota/pojazdy', payload(form));
      setShow(false);
      setForm({ status: 'Dostępny' });
      setPreview('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać pojazdu.');
    }
  }

  async function updateRow(row: any) {
    await api.put(`/api/flota/pojazdy/${row.id}`, payload(row));
    await load();
  }

  return (
    <div className="mx-auto max-w-[1750px] space-y-6">
      <PageTitle
        eyebrow="Flota"
        title="Pojazdy i Transport"
        description="Ewidencja floty firmowej, dyspozycyjność maszyn, polisy ubezpieczeniowe oraz rejestr badań technicznych SKP."
        action={
          <Button onClick={() => setShow(true)}>
            <Plus size={16} className="inline mr-1" /> Dodaj pojazd
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-[1fr_390px] min-w-0">
        {/* LEWA STRONA: TABELA POJAZDÓW */}
        <Card className="min-w-0 overflow-hidden !p-0">
          <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Stan floty ({items.length})
            </span>
          </div>
          <div className="p-4">
            <DataTable
              rows={items}
              onRowClick={(r: any) => router.push(`/dashboard/fleet/${r.id}`)}
              onSaveRow={updateRow}
              columns={[
                {
                  key: 'pojazd',
                  label: 'Pojazd i model',
                  value: (r: any) => {
                    const status = r.status || 'Dostępny';
                    const isAvailable = status === 'Dostępny';
                    const isService = status === 'W serwisie';
                    const isTrip = status === 'W trasie';

                    return (
                      <div className="flex items-center gap-3.5 py-1 min-w-0">
                        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-white/10 dark:bg-slate-800">
                          {r.zdjecie ? (
                            <img src={r.zdjecie} alt={r.nazwa} className="h-full w-full object-cover" />
                          ) : (
                            <Car size={18} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-black text-slate-900 group-hover:text-cyan-700 dark:text-white transition truncate">
                              {r.nazwa}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                              isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400' :
                              isService ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400' :
                              isTrip ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-400' :
                              'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                            }`}>
                              {status}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{r.marka || ''} {r.model || ''}</p>
                        </div>
                      </div>
                    );
                  },
                },
                { 
                  key: 'nr_rejestracyjny', 
                  label: 'Rejestracja', 
                  value: (r: any) => <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{r.nr_rejestracyjny}</span> 
                },
                { 
                  key: 'przebieg_km', 
                  label: 'Przebieg', 
                  value: (r: any) => r.przebieg_km ? <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.przebieg_km.toLocaleString()} km</span> : '-' 
                },
                { 
                  key: 'data_przegladu', 
                  label: 'Przegląd SKP', 
                  value: (r: any) => {
                    const days = getDaysDifference(r.data_przegladu);
                    const isOverdue = days !== null && days < 0;
                    const isSoon = days !== null && days >= 0 && days <= 30;

                    return (
                      <div className="text-xs">
                        <span className={`font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : isSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {d(r.data_przegladu)}
                        </span>
                        {isOverdue && <span className="block text-[10px] font-black text-rose-500 uppercase tracking-tight">Wymagany</span>}
                        {isSoon && <span className="block text-[10px] font-semibold text-amber-500">za {days} dni</span>}
                      </div>
                    );
                  }, 
                  sortValue: (r: any) => r.data_przegladu 
                },
                { 
                  key: 'data_oc', 
                  label: 'Ważność OC', 
                  value: (r: any) => {
                    const days = getDaysDifference(r.data_oc);
                    const isOverdue = days !== null && days < 0;
                    const isSoon = days !== null && days >= 0 && days <= 30;

                    return (
                      <div className="text-xs">
                        <span className={`font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : isSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {d(r.data_oc)}
                        </span>
                        {isOverdue && <span className="block text-[10px] font-black text-rose-500 uppercase tracking-tight">Wygasła</span>}
                        {isSoon && <span className="block text-[10px] font-semibold text-amber-500">za {days} dni</span>}
                      </div>
                    );
                  }, 
                  sortValue: (r: any) => r.data_oc 
                },
                { 
                  key: 'ladownosc_kg', 
                  label: 'Ładowność', 
                  value: (r: any) => r.ladownosc_kg ? <span className="text-xs font-semibold text-slate-500">{r.ladownosc_kg} kg</span> : '-' 
                },
              ]}
            />
          </div>
        </Card>

        {/* PRAWA STRONA: KALENDARZ I POWIADOMIENIA */}
        <Card className="space-y-4 min-w-0">
          <div className="border-b border-slate-100 dark:border-white/5 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                <CalendarDays size={16} className="text-cyan-600" /> Terminarz floty
              </h2>
              <div className="flex items-center gap-1.5">
                {calendarAlertsCount.overdue > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-200 dark:border-rose-800">
                    <ShieldAlert size={12} /> {calendarAlertsCount.overdue}
                  </span>
                )}
                {calendarAlertsCount.soon > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                    <Clock size={12} /> {calendarAlertsCount.soon}
                  </span>
                )}
              </div>
            </div>

            {/* SELEKTORY KATEGORII I PILNOŚCI */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCalendarTypeFilter('all')}
                  className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${calendarTypeFilter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => setCalendarTypeFilter('przeglad')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${calendarTypeFilter === 'przeglad' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
                >
                  SKP
                </button>
                <button
                  onClick={() => setCalendarTypeFilter('oc')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${calendarTypeFilter === 'oc' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
                >
                  Polisy OC
                </button>
                <button
                  onClick={() => setCalendarTypeFilter('serwis')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${calendarTypeFilter === 'serwis' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
                >
                  Serwis
                </button>
              </div>

              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => setCalendarUrgencyFilter('all')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${calendarUrgencyFilter === 'all' ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 font-black' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => setCalendarUrgencyFilter('overdue')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded transition ${calendarUrgencyFilter === 'overdue' ? 'bg-rose-600 text-white font-black' : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'}`}
                >
                  <AlertCircle size={10} /> Po terminie
                </button>
                <button
                  onClick={() => setCalendarUrgencyFilter('soon')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded transition ${calendarUrgencyFilter === 'soon' ? 'bg-amber-600 text-white font-black' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20'}`}
                >
                  <Clock size={10} /> Do 30 dni
                </button>
              </div>
            </div>
          </div>

          {/* LISTA ZDARZEŃ */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {filteredCalendar.map((e: any) => {
              const isOverdue = e.isOverdue;
              const isSoon = e.isSoon;

              let cardStyles = 'border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900/60';
              let iconNode = <Car size={15} className="text-slate-400" />;

              if (isOverdue) {
                cardStyles = 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50';
                iconNode = <AlertTriangle size={15} className="text-rose-500" />;
              } else if (isSoon) {
                cardStyles = 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50';
                iconNode = <Clock size={15} className="text-amber-500" />;
              } else if (e.type === 'serwis') {
                iconNode = <Wrench size={15} className="text-indigo-500" />;
              }

              return (
                <div 
                  key={e.id} 
                  onClick={() => router.push(`/dashboard/fleet/${e.vehicleId}`)}
                  className={`rounded-xl border p-3 transition hover:border-cyan-400 dark:hover:border-cyan-500 cursor-pointer shadow-sm ${cardStyles}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">{iconNode}</div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
                          {e.title}
                        </span>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                          {d(e.date)}
                          {isOverdue && <span className="text-rose-600 dark:text-rose-400 font-black ml-1.5">· Upłynęło {Math.abs(e.daysRemaining)} dni temu</span>}
                          {isSoon && <span className="text-amber-600 dark:text-amber-400 font-bold ml-1.5">· Za {e.daysRemaining} dni</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded shrink-0">
                      {e.plate}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredCalendar.length === 0 && (
              <p className="font-bold text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl p-6 text-center text-xs">
                Brak wpisów spełniających wybrane kryteria.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* MODAL DODAWANIA POJAZDU */}
      {show && (
        <SimpleModal title="Dodaj nowy pojazd" onClose={() => { setShow(false); setPreview(''); setForm({}); }}>
          {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
          <form onSubmit={save} className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start gap-5 p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div className="aspect-video w-full sm:w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {preview || form.zdjecie ? (
                  <img src={preview || form.zdjecie} className="w-full h-full object-cover" alt="Podgląd" />
                ) : (
                  <Car size={32} className="text-slate-300" />
                )}
              </div>
              <div className="space-y-2 w-full pt-1">
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">Zdjęcie pojazdu</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => { 
                        setPreview(reader.result as string); 
                        setForm({ ...form, zdjecie: reader.result }); 
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                  className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3.5 file:py-2 file:font-black file:text-white cursor-pointer hover:file:bg-cyan-700 transition"
                />
                <p className="text-[11px] font-semibold text-slate-400">Zalecane proporcje 16:9.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nazwa (Identyfikator wewn.) *">
                <input className={inputClass} required value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} placeholder="np. Bus Długi Ford" />
              </Field>
              <Field label="Nr rejestracyjny *">
                <input className={`${inputClass} uppercase`} required value={form.nr_rejestracyjny || ''} onChange={(e) => setForm({ ...form, nr_rejestracyjny: e.target.value })} placeholder="WZ 12345" />
              </Field>
              <Field label="Status początkowy">
                <select className={inputClass} value={form.status || 'Dostępny'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="Dostępny">Dostępny</option>
                  <option value="W serwisie">W serwisie</option>
                  <option value="W trasie">W trasie</option>
                  <option value="Niedostępny">Niedostępny</option>
                </select>
              </Field>
              <Field label="Marka">
                <input className={inputClass} value={form.marka || ''} onChange={(e) => setForm({ ...form, marka: e.target.value })} placeholder="np. Ford" />
              </Field>
              <Field label="Model">
                <input className={inputClass} value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="np. Transit L4H3" />
              </Field>
              <Field label="Przebieg [km]">
                <input type="number" className={inputClass} value={form.przebieg_km || ''} onChange={(e) => setForm({ ...form, przebieg_km: e.target.value })} />
              </Field>
              <Field label="Rok produkcji">
                <input type="number" className={inputClass} value={form.rok_produkcji || ''} onChange={(e) => setForm({ ...form, rok_produkcji: e.target.value })} />
              </Field>
              <Field label="Numer VIN">
                <input className={`${inputClass} uppercase`} value={form.vin || ''} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
              </Field>
              <Field label="Polisa OC">
                <input className={inputClass} value={form.numer_polisy_oc || ''} onChange={(e) => setForm({ ...form, numer_polisy_oc: e.target.value })} />
              </Field>
              <Field label="Ważność przeglądu technicznego">
                <input type="date" className={inputClass} value={form.data_przegladu || ''} onChange={(e) => setForm({ ...form, data_przegladu: e.target.value })} />
              </Field>
              <Field label="Ważność ubezpieczenia OC">
                <input type="date" className={inputClass} value={form.data_oc || ''} onChange={(e) => setForm({ ...form, data_oc: e.target.value })} />
              </Field>
              <Field label="Ładowność [kg]">
                <input type="number" step="0.01" className={inputClass} value={form.ladownosc_kg || ''} onChange={(e) => setForm({ ...form, ladownosc_kg: e.target.value })} />
              </Field>
              <Field label="Pojemność / Kubatura [m³]">
                <input type="number" step="0.01" className={inputClass} value={form.objetosc_m3 || ''} onChange={(e) => setForm({ ...form, objetosc_m3: e.target.value })} />
              </Field>
            </div>
            <Field label="Notatki i specyfikacja">
              <textarea className={`${inputClass} min-h-[90px]`} value={form.notatki || ''} onChange={(e) => setForm({ ...form, notatki: e.target.value })} placeholder="Dodatkowe informacje o pojeździe..." />
            </Field>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button variant="secondary" onClick={() => { setShow(false); setPreview(''); }}>Anuluj</Button>
              <Button type="submit">Zapisz pojazd</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}