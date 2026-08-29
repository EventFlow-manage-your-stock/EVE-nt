'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  FileArchive, Paperclip, FileText, Download, Trash2, CalendarDays, History, 
  List, GitCommit, Clock, Car, Wrench, ShieldCheck, MapPin, Truck, Loader2, 
  Plus, DollarSign, User, AlertTriangle, CheckCircle2, Edit2, Building2, Gauge
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass } from '../../../../components/ProductUI';
import { EntityEditorPage } from '../../../../components/EntityEditorPage';
import { DataTable } from '../../../../components/DataTable';
import { SimpleModal } from '../../../../components/SimpleModal';

function fd(v: any) { return v ? new Date(v).toLocaleDateString('pl-PL') : '-'; }
function fdt(v: any) { 
  return v ? new Date(v).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '-'; 
}
function money(v: any) {
  const n = Number(v || 0);
  return `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

const TYPY_SERWISU = [
  { value: 'przeglad_techniczny', label: 'Przegląd techniczny (SKP)' },
  { value: 'przeglad_olejowy', label: 'Przegląd olejowy / filtry' },
  { value: 'usterka', label: 'Awaria / Usterka bieżąca' },
  { value: 'opony', label: 'Wymiana / Serwis opon' },
  { value: 'blacharka', label: 'Naprawa blacharsko-lakiernicza' },
  { value: 'hamulce', label: 'Układ hamulcowy' },
  { value: 'zawieszenie', label: 'Zawieszenie i układ jezdny' },
  { value: 'inne', label: 'Inne prace serwisowe' },
];

const STATUSY_SERWISU = [
  { value: 'w_trakcie', label: 'W trakcie naprawy', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'oczekuje_na_czesci', label: 'Oczekuje na części', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'zakonczony', label: 'Naprawa zakończona', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'anulowany', label: 'Anulowane', color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

// -------------------------------------------------------------
// PANEL SERWISU FLOTY
// -------------------------------------------------------------
function FleetServicePanel({ vehicleId, vehicleRecord, reloadVehicle }: any) {
  const [serwisy, setSerwisy] = useState<any[]>([]);
  const [uzytkownicy, setUzytkownicy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingSerwis, setEditingSerwis] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  
  const [uploadingForId, setUploadingForId] = useState<number | null>(null);
  const [serviceFile, setServiceFile] = useState<File | null>(null);

  async function loadData() {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const [sRes, uRes] = await Promise.all([
        api.get(`/api/flota/pojazdy/${vehicleId}/serwisy`),
        api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      ]);
      setSerwisy(sRes.data || []);
      setUzytkownicy(uRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [vehicleId]);

  const summary = useMemo(() => {
    const totalCostNetto = serwisy.reduce((sum, s) => sum + Number(s.koszt_netto || 0), 0);
    const activeCount = serwisy.filter(s => s.status === 'w_trakcie' || s.status === 'oczekuje_na_czesci').length;
    const completedCount = serwisy.filter(s => s.status === 'zakonczony').length;
    return { totalCostNetto, activeCount, completedCount, totalCount: serwisy.length };
  }, [serwisy]);

  function openCreate() {
    setEditingSerwis(null);
    setForm({
      typ_serwisu: 'usterka',
      status: 'w_trakcie',
      data_serwisu: new Date().toISOString().slice(0, 10),
      przebieg_km: vehicleRecord?.przebieg_km || '',
      zmien_status_auta: true,
      nowy_status_auta: 'W serwisie',
    });
    setShowModal(true);
  }

  function openEdit(serwis: any) {
    setEditingSerwis(serwis);
    setForm({
      typ_serwisu: serwis.typ_serwisu || 'usterka',
      status: serwis.status || 'w_trakcie',
      id_nadzorcy: serwis.id_nadzorcy ? String(serwis.id_nadzorcy) : '',
      miejsce_serwisu: serwis.miejsce_serwisu || '',
      data_serwisu: serwis.data_serwisu ? String(serwis.data_serwisu).slice(0, 10) : '',
      data_zakonczenia: serwis.data_zakonczenia ? String(serwis.data_zakonczenia).slice(0, 10) : '',
      przebieg_km: serwis.przebieg_km || '',
      opis: serwis.opis || '',
      zalecenia: serwis.zalecenia || '',
      koszt_netto: serwis.koszt_netto || '',
      koszt_brutto: serwis.koszt_brutto || '',
      przywroc_dostepnosc_auta: serwis.status !== 'zakonczony',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSerwis) {
        await api.put(`/api/flota/serwisy/${editingSerwis.id}`, form);
      } else {
        await api.post(`/api/flota/pojazdy/${vehicleId}/serwisy`, form);
      }
      setShowModal(false);
      await loadData();
      reloadVehicle?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Wystąpił błąd podczas zapisu serwisu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serwisId: number) {
    if (!confirm('Na pewno usunąć to zgłoszenie serwisowe z historii?')) return;
    try {
      await api.delete(`/api/flota/serwisy/${serwisId}`);
      await loadData();
      reloadVehicle?.();
    } catch (e) {
      alert('Nie udało się usunąć wpisu.');
    }
  }

  async function handleUploadServiceDoc(serwisId: number) {
    if (!serviceFile) return alert('Wybierz plik faktury lub protokołu!');
    try {
      const formData = new FormData();
      formData.append('file', serviceFile);
      formData.append('nazwa', serviceFile.name);

      await api.post(`/api/flota/serwisy/${serwisId}/zalaczniki`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setServiceFile(null);
      setUploadingForId(null);
      await loadData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Błąd uploadu załącznika.');
    }
  }

  async function handleDownload(z: any) {
    try {
      const res = await api.get(`/api/storage/download/${z.id}`);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (err: any) {
      alert('Nie udało się pobrać pliku.');
    }
  }

  if (!vehicleId) return <div className="p-10 border border-dashed rounded-3xl text-center text-slate-400 font-bold">Zapisz pojazd, aby zarządzać serwisem.</div>;
  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8"/></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wszystkie zgłoszenia</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{summary.totalCount}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-600 dark:text-slate-300">
            <Wrench size={22} />
          </div>
        </Card>

        <Card className={`flex items-center justify-between border ${summary.activeCount > 0 ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Aktywne naprawy</p>
            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">{summary.activeCount}</p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-2xl">
            <AlertTriangle size={22} />
          </div>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Naprawy ukończone</p>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{summary.completedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-2xl">
            <CheckCircle2 size={22} />
          </div>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Łączny koszt serwisu (Netto)</p>
            <p className="mt-1 text-2xl font-black text-cyan-700 dark:text-[#04e0ff]">{money(summary.totalCostNetto)}</p>
          </div>
          <div className="p-3 bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 rounded-2xl">
            <DollarSign size={22} />
          </div>
        </Card>
      </div>

      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <h3 className="font-black text-xl text-slate-900 dark:text-white">Książka Serwisowa i Zgłoszenia Napraw</h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Rejestr awarii, wymian oleju, opon, przeglądów technicznych oraz faktur warsztatowych.</p>
          </div>
          <Button onClick={openCreate}><Plus size={16} className="inline mr-1" /> Nowe zgłoszenie serwisowe</Button>
        </div>

        <div className="space-y-4">
          {serwisy.map((s: any) => {
            const statusObj = STATUSY_SERWISU.find(st => st.value === s.status) || STATUSY_SERWISU[0];
            const typObj = TYPY_SERWISU.find(t => t.value === s.typ_serwisu) || TYPY_SERWISU[0];

            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-cyan-300 dark:hover:border-cyan-500/40 transition">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-[#04e0ff] font-black text-xs px-2.5 py-1 border border-cyan-100 dark:border-cyan-800">
                        {typObj.label}
                      </span>
                      <span className={`rounded-lg font-black text-xs px-2.5 py-1 border ${statusObj.color}`}>
                        {statusObj.label}
                      </span>
                      {s.miejsce_serwisu && (
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                          <Building2 size={13} /> {s.miejsce_serwisu}
                        </span>
                      )}
                    </div>

                    <p className="text-base font-black text-slate-900 dark:text-white pt-1">
                      {s.opis || 'Prace serwisowe pojazdu'}
                    </p>

                    {s.zalecenia && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                        <b>Zalecenia warsztatu:</b> {s.zalecenia}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 pt-2">
                      <span className="flex items-center gap-1.5"><Clock size={13} className="text-cyan-600"/> Data zlecenia: {fd(s.data_serwisu)}</span>
                      {s.data_zakonczenia && <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-600"/> Ukończono: {fd(s.data_zakonczenia)}</span>}
                      {s.przebieg_km && <span className="flex items-center gap-1.5"><Gauge size={13}/> Stan licznika: {s.przebieg_km.toLocaleString()} km</span>}
                      {s.nadzorca && (
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <User size={13} className="text-indigo-500"/> Nadzoruje: {s.nadzorca.imie} {s.nadzorca.nazwisko}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-400">Koszt naprawy</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{s.koszt_netto ? money(s.koszt_netto) : 'W trakcie wyceny'}</p>
                      {s.koszt_brutto && <p className="text-[11px] font-bold text-slate-400">Brutto: {money(s.koszt_brutto)}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setUploadingForId(uploadingForId === s.id ? null : s.id)} className="p-2 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition" title="Dołącz fakturę / protokół">
                        <Paperclip size={16} />
                      </button>
                      <button onClick={() => openEdit(s)} className="p-2 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition" title="Edytuj zgłoszenie">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition" title="Usuń z historii">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {s.zalaczniki && s.zalaczniki.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-2">
                    {s.zalaczniki.map((z: any) => (
                      <button key={z.id} onClick={() => handleDownload(z)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition">
                        <FileText size={13} /> {z.nazwa || z.nazwa_pliku}
                      </button>
                    ))}
                  </div>
                )}

                {uploadingForId === s.id && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-black/30 rounded-xl border border-dashed border-slate-300 dark:border-white/10 flex flex-col sm:flex-row items-center gap-3">
                    <input type="file" onChange={(e) => setServiceFile(e.target.files?.[0] || null)} className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:font-bold file:text-white cursor-pointer" />
                    <Button onClick={() => handleUploadServiceDoc(s.id)} disabled={!serviceFile}>Wgraj dokument</Button>
                    <Button variant="secondary" onClick={() => { setUploadingForId(null); setServiceFile(null); }}>Anuluj</Button>
                  </div>
                )}
              </div>
            );
          })}

          {serwisy.length === 0 && (
            <div className="p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">
              Pojazd nie posiada zarejestrowanych awarii ani wpisów serwisowych.
            </div>
          )}
        </div>
      </Card>

      {showModal && (
        <SimpleModal 
          title={editingSerwis ? `Edycja zgłoszenia serwisowego #${editingSerwis.id}` : 'Zarejestruj zgłoszenie serwisowe / awarię'} 
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Typ prac / usterki *">
                <select className={inputClass} value={form.typ_serwisu} onChange={e => setForm({...form, typ_serwisu: e.target.value})} required>
                  {TYPY_SERWISU.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <Field label="Status naprawy *">
                <select className={inputClass} value={form.status} onChange={e => setForm({...form, status: e.target.value})} required>
                  {STATUSY_SERWISU.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Warsztat / ASO / Miejsce naprawy">
                <input className={inputClass} placeholder="np. ASO / Warsztat własny" value={form.miejsce_serwisu || ''} onChange={e => setForm({...form, miejsce_serwisu: e.target.value})} />
              </Field>

              <Field label="Osoba nadzorująca (Z zespołu)">
                <select className={inputClass} value={form.id_nadzorcy || ''} onChange={e => setForm({...form, id_nadzorcy: e.target.value})}>
                  <option value="">Brak / wybierz osobę</option>
                  {uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}
                </select>
              </Field>

              <Field label="Data rozpoczęcia / oddania do serwisu *">
                <input type="date" className={inputClass} value={form.data_serwisu || ''} onChange={e => setForm({...form, data_serwisu: e.target.value})} required />
              </Field>

              <Field label="Data zakończenia / odbioru auta">
                <input type="date" className={inputClass} value={form.data_zakonczenia || ''} onChange={e => setForm({...form, data_zakonczenia: e.target.value})} />
              </Field>

              <Field label="Stan licznika [km]">
                <input type="number" className={inputClass} placeholder="np. 145000" value={form.przebieg_km || ''} onChange={e => setForm({...form, przebieg_km: e.target.value})} />
              </Field>

              {form.typ_serwisu === 'przeglad_techniczny' && (
                <Field label="Data następnego przeglądu SKP">
                  <input type="date" className={inputClass} value={form.data_nastepnego_przegladu || ''} onChange={e => setForm({...form, data_nastepnego_przegladu: e.target.value})} />
                </Field>
              )}

              <Field label="Koszt netto [PLN]">
                <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={form.koszt_netto || ''} onChange={e => setForm({...form, koszt_netto: e.target.value})} />
              </Field>

              <Field label="Koszt brutto [PLN]">
                <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={form.koszt_brutto || ''} onChange={e => setForm({...form, koszt_brutto: e.target.value})} />
              </Field>
            </div>

            <Field label="Opis usterki / zakres wykonanych prac *">
              <textarea required className={`${inputClass} min-h-[90px]`} placeholder="Opisz powód wizyty w warsztacie lub zakres wymian..." value={form.opis || ''} onChange={e => setForm({...form, opis: e.target.value})} />
            </Field>

            <Field label="Zalecenia mechanika / uwagi do następnego serwisu">
              <textarea className={`${inputClass} min-h-[60px]`} placeholder="np. Wymiana klocków hamulcowych za 10 000 km..." value={form.zalecenia || ''} onChange={e => setForm({...form, zalecenia: e.target.value})} />
            </Field>

            {!editingSerwis ? (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 dark:bg-cyan-900/20 dark:border-cyan-800 p-4 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-sm text-cyan-950 dark:text-cyan-200">
                  <input type="checkbox" checked={form.zmien_status_auta} onChange={e => setForm({...form, zmien_status_auta: e.target.checked})} className="w-4 h-4 rounded text-cyan-600" />
                  Zmień status pojazdu w systemie na czas trwania naprawy
                </label>
                {form.zmien_status_auta && (
                  <div className="pl-6 pt-1">
                    <select className={inputClass} value={form.nowy_status_auta} onChange={e => setForm({...form, nowy_status_auta: e.target.value})}>
                      <option value="W serwisie">W serwisie (Blokada dyspozycyjności)</option>
                      <option value="Niedostępny">Niedostępny</option>
                    </select>
                  </div>
                )}
              </div>
            ) : form.status === 'zakonczony' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-sm text-emerald-950 dark:text-emerald-200">
                  <input type="checkbox" checked={form.przywroc_dostepnosc_auta} onChange={e => setForm({...form, przywroc_dostepnosc_auta: e.target.checked})} className="w-4 h-4 rounded text-emerald-600" />
                  Naprawa zakończona: Przywróć status pojazdu na „Dostępny”
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)} disabled={saving}>Anuluj</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Zapisywanie...' : editingSerwis ? 'Zapisz zmiany w zgłoszeniu' : 'Zarejestruj zgłoszenie'}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// PANEL KALENDARZA FLOTY
// -------------------------------------------------------------
function FleetCalendarPanel({ vehicleId }: { vehicleId?: number }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    const now = new Date();
    const od = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const doDate = new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString();
    
    api.get(`/api/flota/pojazdy/${vehicleId}/dostepnosc?od=${od}&do=${doDate}`)
      .then(res => {
         const rez = res.data.rezerwacje || [];
         const inf = res.data.informacyjne || [];
         
         const combined = [
           ...rez.map((r: any) => ({
             id: `rez-${r.id}`,
             type: 'event',
             title: r.wydarzenie?.nazwa,
             start: r.wydarzenie?.data_start,
             end: r.wydarzenie?.data_koniec,
             role: r.rola_pojazdu,
             location: r.wydarzenie?.miejsce_reczne || r.wydarzenie?.miejsce?.nazwa
           })),
           ...inf.map((i: any) => ({
             id: `inf-${i.typ}-${i.start}`,
             type: i.typ,
             title: i.tytul,
             start: i.start,
             end: i.start,
             role: 'Wymagane działanie (System)',
             location: ''
           }))
         ].filter(e => new Date(e.end || e.start) >= new Date(new Date().setHours(0,0,0,0)))
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          
         setEvents(combined);
      })
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (!vehicleId) return <div className="p-10 border border-dashed border-slate-200 rounded-3xl text-center font-bold text-slate-400">Zapisz pojazd w systemie, aby zarządzać kalendarzem.</div>;
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8"/></div>;

  return (
    <Card className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
        <div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Nadchodzący Grafik</h3>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Rezerwacje projektowe oraz powiadomienia o przeglądach i OC.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
         {events.map(e => (
            <div key={e.id} className={`rounded-[20px] p-5 border shadow-sm flex gap-4 items-start transition-all hover:shadow-md ${e.type === 'event' ? 'border-cyan-200 bg-cyan-50 dark:bg-cyan-900/10 dark:border-cyan-500/20' : 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-500/20'}`}>
               <div className={`p-3 rounded-2xl shrink-0 ${e.type === 'event' ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                  {e.type === 'event' ? <Car size={24} strokeWidth={2.5}/> : e.type === 'oc' ? <ShieldCheck size={24} strokeWidth={2.5}/> : <Wrench size={24} strokeWidth={2.5}/>}
               </div>
               <div className="min-w-0">
                  <h4 className="font-black text-slate-900 dark:text-white text-[15px] truncate">{e.title}</h4>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5"><Clock size={12} className="shrink-0"/> {fdt(e.start)} {e.type === 'event' ? `→ ${fdt(e.end)}` : ''}</p>
                  {e.location && <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5 truncate"><MapPin size={12} className="shrink-0"/> {e.location}</p>}
                  <p className="text-[10px] uppercase tracking-widest font-black text-cyan-700 dark:text-cyan-400 mt-3 inline-block bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">{e.role}</p>
               </div>
            </div>
         ))}
      </div>
      {events.length === 0 && <div className="p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Pojazd nie ma przypisanych żadnych przyszłych zdarzeń w kalendarzu.</div>}
    </Card>
  );
}

// -------------------------------------------------------------
// PANEL HISTORII PRZEJAZDÓW
// -------------------------------------------------------------
function FleetHistoryPanel({ vehicleId }: { vehicleId?: number }) {
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    const od = new Date('2020-01-01').toISOString();
    const doDate = new Date().toISOString(); 
    
    api.get(`/api/flota/pojazdy/${vehicleId}/dostepnosc?od=${od}&do=${doDate}`)
      .then(res => {
         const rez = res.data.rezerwacje || [];
         const combined = rez.map((r: any) => ({
             id: `rez-${r.id}`,
             eventId: r.wydarzenie?.id,
             title: r.wydarzenie?.nazwa,
             start: r.wydarzenie?.data_start,
             end: r.wydarzenie?.data_koniec,
             role: r.rola_pojazdu,
             status: r.wydarzenie?.status?.nazwa || 'Zakończone'
           }))
           .filter((e: any) => new Date(e.end || e.start) < new Date())
           .sort((a: any, b: any) => new Date(b.start).getTime() - new Date(a.start).getTime());
         setEvents(combined);
      })
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (!vehicleId) return <div className="p-10 border border-dashed border-slate-200 rounded-3xl text-center font-bold text-slate-400">Zapisz pojazd w systemie, aby przeglądać historię.</div>;
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8"/></div>;

  return (
    <Card className="space-y-4">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
        <div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Historia Przejazdów</h3>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Archiwum projektów, w których uczestniczył ten pojazd.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/5">
           <button onClick={() => setView('timeline')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${view === 'timeline' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600 dark:text-[#04e0ff]' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><GitCommit size={14}/> Oś Czasu</button>
           <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600 dark:text-[#04e0ff]' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><List size={14}/> Lista</button>
        </div>
      </div>

      {events.length === 0 && <div className="p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Historia pojazdu jest pusta.</div>}

      {events.length > 0 && view === 'timeline' && (
        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-5 space-y-8 pb-4 pt-2">
          {events.map((e) => (
             <div key={e.id} className="relative pl-8 group">
                <div className="absolute -left-[11px] top-1.5 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 bg-cyan-500 z-10 shadow-sm transition-transform group-hover:scale-125" />
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md">
                   <div className="flex justify-between items-start mb-2">
                     <h4 className="text-lg font-black text-slate-900 dark:text-white">{e.title}</h4>
                     <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg border border-slate-100 dark:border-white/5">{e.status}</span>
                   </div>
                   <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5"><Clock size={13} className="text-cyan-600"/> {fdt(e.start)} → {fdt(e.end)}</p>
                   <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                     <p className="text-[11px] uppercase tracking-wider font-black text-slate-400">Rola: <span className="text-slate-800 dark:text-slate-200 ml-1">{e.role || 'Udział'}</span></p>
                     <Button variant="secondary" onClick={() => window.open(`/dashboard/events/${e.eventId}`, '_blank')}>Zobacz Event</Button>
                   </div>
                </div>
             </div>
          ))}
        </div>
      )}

      {events.length > 0 && view === 'list' && (
        <DataTable 
          rows={events}
          columns={[
            { key: 'title', label: 'Wydarzenie', value: (r: any) => <b className="text-slate-900 dark:text-white">{r.title}</b> },
            { key: 'role', label: 'Rola pojazdu', value: (r: any) => r.role || '-' },
            { key: 'start', label: 'Start', value: (r: any) => fdt(r.start), sortValue: (r: any) => r.start },
            { key: 'end', label: 'Koniec', value: (r: any) => fdt(r.end) },
            { key: 'status', label: 'Status' }
          ]}
        />
      )}
    </Card>
  );
}

// -------------------------------------------------------------
// PANEL ZAŁĄCZNIKÓW POJAZDU (S3)
// -------------------------------------------------------------
function AttachmentsPanel({ vehicleId, zalaczniki }: any) {
  const [form, setForm] = useState<any>({});
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function saveFile(e: any) {
    e.preventDefault();
    if (!file) return alert('Wybierz plik!');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (form.nazwa) formData.append('nazwa', form.nazwa);

      await api.post(`/api/flota/pojazdy/${vehicleId}/zalaczniki`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setForm({});
      setFile(null);
      setAdding(false);
      window.location.reload(); 
    } catch (error: any) {
      alert(error.response?.data?.message || 'Nie udało się wgrać pliku.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(z: any) {
    try {
      const res = await api.get(`/api/storage/download/${z.id}`);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (err: any) {
      alert('Nie udało się pobrać pliku.');
    }
  }

  if (!vehicleId) return <div className="p-10 border border-dashed border-slate-200 rounded-3xl text-center font-bold text-slate-400">Zapisz pojazd w systemie, aby dodawać załączniki.</div>;

  return (
    <Card className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Pliki i Dokumentacja Pojazdu</h3>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Dowody rejestracyjne, polisy OC, umowy leasingowe.</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={uploading}><Paperclip size={16} className="inline mr-1"/> Dodaj plik</Button>
      </div>

      {adding && (
        <div className="mb-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] p-5">
          <form onSubmit={saveFile} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <Field label="Nazwa wyświetlana (Opcjonalnie)">
              <input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({...form, nazwa: e.target.value})} placeholder="np. Polisa OC 2026"/>
            </Field>
            <Field label="Wybierz Plik z Dysku">
              <input required type="file" className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-black file:text-white hover:file:bg-cyan-700 transition cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => {setAdding(false); setForm({}); setFile(null);}} disabled={uploading}>Anuluj</Button>
              <Button type="submit" disabled={uploading || !file}>{uploading ? 'Wysyłanie...' : 'Wgraj na serwer'}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
         {zalaczniki.map((z: any) => (
           <div key={z.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between group hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20"><FileText size={24} strokeWidth={1.5}/></div>
                 <div className="min-w-0 pr-2">
                    <p className="font-black text-[15px] text-slate-900 dark:text-white truncate">{z.nazwa || z.nazwa_pliku}</p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{z.nazwa_pliku} · {((z.rozmiar_bajtow||0) / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Dodał: {z.dodal?.imie || 'System'} · {new Date(z.data_utworzenia).toLocaleDateString()}</p>
                 </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => handleDownload(z)} className="p-2 text-[#04e0ff] hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition" title="Podgląd / Pobierz bezpiecznie">
                  <Download size={18}/>
                </button>
                <button type="button" onClick={async () => { if(confirm('Usunąć załącznik z serwera?')) { await api.delete(`/api/flota/pojazdy/${vehicleId}/zalaczniki/${z.id}`); window.location.reload(); } }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition" title="Usuń z S3 i Bazy">
                  <Trash2 size={18}/>
                </button>
              </div>
           </div>
         ))}
         {zalaczniki.length === 0 && !adding && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak wgranych plików do tego pojazdu. Dodaj skany dokumentów i polis.</div>}
      </div>
    </Card>
  );
}

// -------------------------------------------------------------
// GŁÓWNY EDYTOR POJAZDU (EntityEditorPage)
// -------------------------------------------------------------
export default function FleetVehicleEditorPage() {
  return (
    <EntityEditorPage config={{
      moduleLabel: 'Flota',
      title: 'Edycja pojazdu',
      listHref: '/dashboard/fleet',
      getEndpoint: (id) => `/api/flota/pojazdy/${id}`,
      updateEndpoint: (id) => `/api/flota/pojazdy/${id}`,
      deleteEndpoint: (id) => `/api/flota/pojazdy/${id}`,
      tabs: [
        { 
          id: 'serwis', 
          label: 'Serwis i naprawy', 
          icon: Wrench, 
          render: (record: any) => <FleetServicePanel vehicleId={record?.id} vehicleRecord={record} reloadVehicle={() => window.location.reload()} /> 
        },
        { 
          id: 'kalendarz', 
          label: 'Kalendarz', 
          icon: CalendarDays, 
          render: (record: any) => <FleetCalendarPanel vehicleId={record?.id} /> 
        },
        { 
          id: 'historia', 
          label: 'Historia', 
          icon: History, 
          render: (record: any) => <FleetHistoryPanel vehicleId={record?.id} /> 
        },
        { 
          id: 'zalaczniki', 
          label: 'Załączniki', 
          icon: FileArchive, 
          render: (record: any) => <AttachmentsPanel vehicleId={record?.id} zalaczniki={record?.zalaczniki || []} /> 
        }
      ],
      titleFromRecord: (r) => r.nazwa || r.nr_rejestracyjny || `Pojazd #${r.id}`,
      subtitleFromRecord: (r) => [r.nr_rejestracyjny, r.vin ? `VIN ${r.vin}` : null, r.status ? `Status: ${r.status}` : null].filter(Boolean).join(' · '),
      fields: [
        { key: 'zdjecie', label: 'Zdjęcie pojazdu', type: 'image', colSpan: 'full' },
        { key: 'nazwa', label: 'Nazwa pojazdu' },
        { key: 'nr_rejestracyjny', label: 'Nr rejestracyjny' },
        { 
          key: 'status', 
          label: 'Status dyspozycyjności', 
          type: 'select',
          options: [
            { id: 'Dostępny', nazwa: 'Dostępny' },
            { id: 'W serwisie', nazwa: 'W serwisie (Naprawa)' },
            { id: 'W trasie', nazwa: 'W trasie / Na evencie' },
            { id: 'Niedostępny', nazwa: 'Niedostępny (Wyłączony)' },
          ]
        },
        { key: 'marka', label: 'Marka' },
        { key: 'model', label: 'Model' },
        { key: 'rok_produkcji', label: 'Rok produkcji', type: 'number' },
        { key: 'vin', label: 'VIN' },
        { key: 'przebieg_km', label: 'Przebieg km', type: 'number' },
        { key: 'data_przegladu', label: 'Data przeglądu SKP', type: 'date' },
        { key: 'data_oc', label: 'Data ważności OC', type: 'date' },
        { key: 'numer_polisy_oc', label: 'Numer polisy OC' },
        { key: 'ubezpieczyciel', label: 'Ubezpieczyciel' },
        { key: 'ladownosc_kg', label: 'Ładowność [kg]', type: 'number' },
        { key: 'objetosc_m3', label: 'Objętość paki [m³]', type: 'number' },
        { key: 'notatki', label: 'Notatki wewnętrzne', type: 'textarea' },
      ],
    }} />
  );
}