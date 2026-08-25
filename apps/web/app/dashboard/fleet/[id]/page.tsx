'use client';
import { useState } from 'react';
import { FileArchive, Paperclip, FileText, Download, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass } from '../../../../components/ProductUI';
import { EntityEditorPage, defaultTabs } from '../../../../components/EntityEditorPage';

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
      window.location.reload(); // Proste odświeżenie danych z EntityEditorPage
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

export default function FleetVehicleEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Flota',
    title: 'Edycja pojazdu',
    listHref: '/dashboard/fleet',
    getEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    updateEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    deleteEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    tabs: [
      ...defaultTabs.fleet,
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