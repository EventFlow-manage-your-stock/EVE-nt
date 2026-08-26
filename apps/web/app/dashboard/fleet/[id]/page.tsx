'use client';
import { useState, useEffect } from 'react';
import { FileArchive, Paperclip, FileText, Download, Trash2, CalendarDays, History, List, GitCommit, Clock, Car, Wrench, ShieldCheck, MapPin, Truck, Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass } from '../../../../components/ProductUI';
import { EntityEditorPage } from '../../../../components/EntityEditorPage';
import { DataTable } from '../../../../components/DataTable';

// --- HELPERY FORMATOWANIA DAT ---
function fd(v: any) { return v ? new Date(v).toLocaleDateString('pl-PL') : '-'; }
function fdt(v: any) { 
  return v ? new Date(v).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '-'; 
}

// -------------------------------------------------------------
// PANEL KALENDARZA FLOTY (Nadchodzące rezerwacje i statusy)
// -------------------------------------------------------------
function FleetCalendarPanel({ vehicleId }: { vehicleId?: number }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    const now = new Date();
    // Pobieramy od miesiąca temu, żeby złapać trwające wydarzenia, aż do roku w przód
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
         ].filter(e => new Date(e.end || e.start) >= new Date(new Date().setHours(0,0,0,0))) // Tylko nadchodzące i dzisiejsze
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
          <p className="text-sm font-bold text-slate-500">Rezerwacje projektowe oraz powiadomienia o przeglądach i OC.</p>
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
// PANEL HISTORII FLOTY (Zrealizowane eventy)
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
           // Filtrujemy tylko te, które już się zakończyły lub rozpoczęły w przeszłości
           .filter((e: any) => new Date(e.end || e.start) < new Date())
           .sort((a: any, b: any) => new Date(b.start).getTime() - new Date(a.start).getTime()); // Sortowanie malejące (najnowsze na górze)
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
          <p className="text-sm font-bold text-slate-500">Archiwum projektów, w których uczestniczył ten pojazd.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/5">
           <button onClick={() => setView('timeline')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${view === 'timeline' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><GitCommit size={14}/> Oś Czasu</button>
           <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><List size={14}/> Lista</button>
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
// PANEL ZAŁĄCZNIKÓW (Wsparcie dla S3 / MinIO) - Flota
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
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(z: any) {
    try {
      if (z.sciezka?.startsWith('data:')) {
        const link = document.createElement('a'); link.href = z.sciezka; link.download = z.nazwa_pliku || 'plik'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      } else {
        const res = await api.get(`/api/storage/download/${z.id}`);
        if (res.data?.url) window.open(res.data.url, '_blank');
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Nie udało się uzyskać bezpiecznego linku.');
    }
  }

  if (!vehicleId) return <div className="p-10 border border-dashed border-slate-200 rounded-3xl text-center font-bold text-slate-400">Zapisz pojazd w systemie, aby dodawać załączniki.</div>;

  return (
    <Card className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Pliki i Dokumentacja Pojazdu</h3>
          <p className="text-sm font-bold text-slate-500">Dowody rejestracyjne, polisy OC, umowy leasingowe.</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={uploading}><Paperclip size={16} className="inline mr-1"/> Dodaj plik</Button>
      </div>

      {adding && <div className="mb-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] p-5">
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
      </div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
         {zalaczniki.map((z: any) => <div key={z.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between group hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-colors">
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
         </div>)}
         {zalaczniki.length === 0 && !adding && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak wgranych plików do tego pojazdu. Dodaj skany dokumentów i polis.</div>}
      </div>
    </Card>
  );
}

// -------------------------------------------------------------
// GŁÓWNY EDYTOR (EntityEditorPage)
// -------------------------------------------------------------
export default function FleetVehicleEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Flota',
    title: 'Edycja pojazdu',
    listHref: '/dashboard/fleet',
    getEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    updateEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    deleteEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    tabs: [
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
    subtitleFromRecord: (r) => [r.nr_rejestracyjny, r.vin ? `VIN ${r.vin}` : null].filter(Boolean).join(' · '),
    fields: [
      { key: 'zdjecie', label: 'Zdjęcie pojazdu', type: 'image', colSpan: 'full' },
      { key: 'nazwa', label: 'Nazwa' },
      { key: 'nr_rejestracyjny', label: 'Nr rejestracyjny' },
      { key: 'marka', label: 'Marka' },
      { key: 'model', label: 'Model' },
      { key: 'rok_produkcji', label: 'Rok produkcji', type: 'number' },
      { key: 'vin', label: 'VIN' },
      { key: 'przebieg_km', label: 'Przebieg km', type: 'number' },
      { key: 'data_przegladu', label: 'Data przeglądu', type: 'date' },
      { key: 'data_oc', label: 'Data OC', type: 'date' },
      { key: 'numer_polisy_oc', label: 'Numer polisy OC' },
      { key: 'ubezpieczyciel', label: 'Ubezpieczyciel' },
      { key: 'ladownosc_kg', label: 'Ładowność kg', type: 'number' },
      { key: 'objetosc_m3', label: 'Objętość m³', type: 'number' },
      { key: 'notatki', label: 'Notatki', type: 'textarea' },
    ],
  }} />;
}