'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, LayoutGrid, List, Plus, Search, QrCode } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function sprzęt(r: any) { return `${r.egzemplarz?.model?.nazwa || ''} ${r.egzemplarz?.nazwa || ''}`.trim() || '-'; }
function data(v: any) { return v ? new Date(v).toLocaleString('pl-PL') : '-'; }

export default function ServicePage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [archivedItems, setArchivedItems] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [egz, setEgz] = useState<any[]>([]);
  
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});
  
  const [view, setView] = useState<'kanban' | 'lista' | 'archiwum'>('kanban');
  const [error, setError] = useState('');

  // Stan dla Drag & Drop
  const [draggedId, setDraggedId] = useState<number | null>(null);

  // Stany dla skanera i zaawansowanego modala
  const [scanCode, setScanCode] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');

  async function load() {
    const [z, s, e, a] = await Promise.all([
      api.get('/api/serwis').catch(() => ({ data: [] })),
      api.get('/api/serwis/statusy').catch(() => ({ data: [] })),
      api.get('/api/magazyn/wszystkie-egzemplarze').catch(() => ({ data: [] })),
      api.get('/api/serwis/archiwum').catch(() => ({ data: [] }))
    ]);
    setItems(z.data || []);
    setStatuses((s.data || []).filter((x: any) => String(x.nazwa || '').toLowerCase() !== 'działa'));
    setEgz(e.data || []);
    setArchivedItems(a.data || []);
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => statuses.map((s: any) => ({ ...s, items: items.filter((i: any) => i.id_statusu_serwisu === s.id || i.status?.id === s.id) })), [statuses, items]);

  // Wyszukiwarka i selekcja w modalu
  const availableModels = useMemo(() => {
    const map = new Map();
    egz.forEach(e => {
      if (e.model && !map.has(e.model.id)) {
        map.set(e.model.id, e.model);
      }
    });
    return Array.from(map.values()).sort((a: any, b: any) => a.nazwa.localeCompare(b.nazwa));
  }, [egz]);

  const filteredEgz = useMemo(() => {
    if (!selectedModelId) return egz;
    return egz.filter(e => String(e.id_modelu || e.model?.id) === String(selectedModelId));
  }, [egz, selectedModelId]);

  function handleScan(e?: any) {
    e?.preventDefault();
    setError('');
    const code = scanCode.trim().toLowerCase();
    if (!code) return;

    const found = egz.find(x =>
      (x.kod_kreskowy && x.kod_kreskowy.toLowerCase() === code) ||
      (x.zewnetrzny_kod_kreskowy && x.zewnetrzny_kod_kreskowy.toLowerCase() === code) ||
      (x.qr_kod && x.qr_kod.toLowerCase() === code) ||
      (x.zewnetrzny_qr_kod && x.zewnetrzny_qr_kod.toLowerCase() === code) ||
      (x.sn && x.sn.toLowerCase() === code)
    );

    if (found) {
      setSelectedModelId(found.id_modelu ? String(found.id_modelu) : '');
      setForm((prev: any) => ({ ...prev, id_egzemplarza: String(found.id) }));
      setScanCode('');
    } else {
      setError(`Nie znaleziono sprzętu o kodzie: ${scanCode}`);
    }
  }

  function openNewTicketModal() {
    setForm({});
    setSelectedModelId('');
    setScanCode('');
    setError('');
    setShow(true);
  }

  async function save(e: any) {
    e.preventDefault(); 
    setError('');
    try {
      await api.post('/api/serwis', form);
      setShow(false);
      setForm({});
      setSelectedModelId('');
      setScanCode('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać zgłoszenia.');
    }
  }

  async function archiveTicket(id: number) {
    if (!confirm('Zarchiwizować to zgłoszenie? Trafi ono do zakładki Archiwum, a sprzęt odzyska status "Naprawiony".')) return;
    try {
      await api.put(`/api/serwis/${id}/archiwizuj`, {});
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się zarchiwizować zgłoszenia.');
    }
  }

  async function handleDrop(e: React.DragEvent, newStatusId: number) {
    e.preventDefault();
    if (!draggedId) return;

    const currentItem = items.find(i => i.id === draggedId);
    if (!currentItem || currentItem.id_statusu_serwisu === newStatusId) {
      setDraggedId(null);
      return;
    }

    const originalItems = [...items];
    setItems(items.map(item => item.id === draggedId ? { ...item, id_statusu_serwisu: newStatusId } : item));

    try {
      await api.patch(`/api/serwis/${draggedId}/status`, { id_statusu_serwisu: newStatusId });
      api.get('/api/serwis').then(res => setItems(res.data || [])); 
    } catch (err: any) {
      setItems(originalItems); 
      setError('Nie udało się przenieść zgłoszenia.');
    } finally {
      setDraggedId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle 
        eyebrow="Serwis" 
        title="Zgłoszenia serwisowe" 
        description="Widok pierwotny jako tablica statusów oraz alternatywnie lista tabelaryczna. Łap i przeciągaj zgłoszenia między statusami." 
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant={view === 'kanban' ? 'primary' : 'secondary'} onClick={() => setView('kanban')}><LayoutGrid size={16} className="inline mr-1" /> Nasz widok</Button>
            <Button variant={view === 'lista' ? 'primary' : 'secondary'} onClick={() => setView('lista')}><List size={16} className="inline mr-1" /> Lista</Button>
            <Button variant={view === 'archiwum' ? 'primary' : 'secondary'} onClick={() => setView('archiwum')}><Archive size={16} className="inline mr-1" /> Archiwum</Button>
            <Button onClick={openNewTicketModal}><Plus size={16} className="inline" /> Nowe zgłoszenie</Button>
          </div>
        }
      />
      
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      {view === 'kanban' && (
        <div className="grid gap-4 xl:grid-cols-5">
          {grouped.map((s: any, index: number) => (
            <Card 
              key={s.id} 
              className={`!p-4 transition-colors duration-200 ${draggedId ? 'border-dashed border-cyan-300 bg-cyan-50/10' : ''}`}
              onDragOver={(e: any) => e.preventDefault()}
              onDrop={(e: any) => handleDrop(e, s.id)}
            >
              <div className="mb-3 flex items-center justify-between pointer-events-none">
                <h2 className="text-sm font-black">
                  <span className="mr-2 inline-block h-4 w-4 rounded-full align-middle" style={{ background: s.kolor || '#94a3b8' }} /> 
                  {s.nazwa}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">{s.items.length}</span>
              </div>
              <div className="space-y-2 min-h-[50vh]">
                {s.items.map((r: any) => (
                  <div 
                    key={r.id} 
                    draggable
                    onDragStart={() => setDraggedId(r.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => router.push(`/dashboard/service/${r.id}`)} 
                    className={`group relative w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-cyan-300 hover:bg-cyan-50 cursor-grab active:cursor-grabbing transition-opacity ${draggedId === r.id ? 'opacity-40 scale-95' : 'opacity-100'}`}
                  >
                    
                    {index === grouped.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); archiveTicket(r.id); }}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 opacity-0 shadow-sm transition-all hover:scale-110 hover:bg-emerald-500 hover:text-white group-hover:opacity-100"
                        title="Zakończ i przenieś do archiwum"
                      >
                        <Check size={16} strokeWidth={3} />
                      </button>
                    )}

                    <p className="pr-8 font-black text-slate-900">{r.tytul}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{sprzęt(r)}</p>
                    <p className="mt-2 text-[11px] font-black text-slate-400">{data(r.data_zgloszenia)}</p>
                  </div>
                ))}
                {s.items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs font-bold text-slate-400 pointer-events-none">Przeciągnij tutaj</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {view === 'lista' && (
        <Card>
          <DataTable 
            rows={items} 
            onRowClick={(r: any) => router.push(`/dashboard/service/${r.id}`)} 
            columns={[
              { key: 'tytul', label: 'Tytuł', value: (r: any) => <b>{r.tytul}</b> }, 
              { key: 'sprzet', label: 'Sprzęt', value: sprzęt }, 
              { key: 'status', label: 'Status', value: (r: any) => <span><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: r.status?.kolor || '#94a3b8' }} /> {r.status?.nazwa || '-'}</span> }, 
              { key: 'zglosil', label: 'Zgłosił', value: (r: any) => `${r.zglosil?.imie || ''} ${r.zglosil?.nazwisko || ''}`.trim() || '-' }, 
              { key: 'data_zgloszenia', label: 'Data', value: (r: any) => data(r.data_zgloszenia) }, 
              { key: 'data_rozwiazania', label: 'Rozwiązano', value: (r: any) => data(r.data_rozwiazania) }
            ]} 
          />
        </Card>
      )}

      {view === 'archiwum' && (
        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-black">Zakończone zgłoszenia</h2>
            <p className="text-sm font-bold text-slate-500">Zarchiwizowane usterki. Powiązany sprzęt został przywrócony jako "Naprawiony".</p>
          </div>
          <DataTable 
            rows={archivedItems} 
            onRowClick={(r: any) => router.push(`/dashboard/service/${r.id}`)} 
            columns={[
              { key: 'tytul', label: 'Tytuł', value: (r: any) => <b className="text-slate-500 line-through">{r.tytul}</b> }, 
              { key: 'sprzet', label: 'Sprzęt', value: sprzęt }, 
              { key: 'zglosil', label: 'Zgłosił', value: (r: any) => `${r.zglosil?.imie || ''} ${r.zglosil?.nazwisko || ''}`.trim() || '-' }, 
              { key: 'rozwiazal', label: 'Rozwiązał', value: (r: any) => `${r.rozwiazal?.imie || ''} ${r.rozwiazal?.nazwisko || ''}`.trim() || '-' }, 
              { key: 'data_zgloszenia', label: 'Zgłoszono', value: (r: any) => data(r.data_zgloszenia) }, 
              { key: 'data_rozwiazania', label: 'Zarchiwizowano', value: (r: any) => data(r.data_rozwiazania) }
            ]} 
          />
        </Card>
      )}

      {show && (
        <SimpleModal title="Nowe zgłoszenie serwisowe" onClose={() => setShow(false)}>
          <form onSubmit={save} className="space-y-6">
            
            {/* KROK 1: Wybór sprzętu */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-800">1. Zidentyfikuj sprzęt</h3>

              <Field label="Zeskanuj kod sprzętu (QR / Kreskowy / SN)">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode size={18} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      className={`${inputClass} pl-10`}
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }}
                      placeholder="Zeskanuj czytnikiem lub wpisz ręcznie i wciśnij Enter..."
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={handleScan}>Szukaj</Button>
                </div>
              </Field>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">LUB WYBIERZ RĘCZNIE</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Model sprzętu (Zawęża listę)">
                  <select 
                    className={inputClass} 
                    value={selectedModelId} 
                    onChange={e => { setSelectedModelId(e.target.value); setForm({ ...form, id_egzemplarza: '' }); }}
                  >
                    <option value="">Wszystkie modele</option>
                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </Field>
                <Field label="Konkretny egzemplarz *">
                  <select 
                    className={inputClass} 
                    required 
                    value={form.id_egzemplarza || ''} 
                    onChange={e => setForm({ ...form, id_egzemplarza: e.target.value })}
                  >
                    <option value="">Wybierz egzemplarz...</option>
                    {filteredEgz.map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.model?.nazwa ? `${x.model.nazwa} - ` : ''}{x.nazwa || x.numer_egzemplarza || x.numer_urzadzenia || `#${x.id}`} {x.sn ? `(SN: ${x.sn})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* KROK 2: Szczegóły usterki */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-800">2. Rejestracja usterki</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kolejka / Status zgłoszenia">
                  <select className={inputClass} value={form.id_statusu_serwisu || ''} onChange={e => setForm({ ...form, id_statusu_serwisu: e.target.value })}>
                    <option value="">Status domyślny</option>
                    {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
                  </select>
                </Field>
                <Field label="Kondycja urządzenia (Status Sprzętu)">
                  <select className={inputClass} value={form.status_serwisowy_sprzetu || ''} onChange={e => setForm({ ...form, status_serwisowy_sprzetu: e.target.value })}>
                    <option value="">Bez zmiany</option>
                    <option>Działa</option>
                    <option>Wymaga serwisu (działa)</option>
                    <option>Wymaga serwisu (nie działa)</option>
                    <option>W serwisie</option>
                    <option>Naprawiony</option>
                  </select>
                </Field>
              </div>
              <Field label="Krótki tytuł usterki *">
                <input className={inputClass} required value={form.tytul || ''} onChange={e => setForm({ ...form, tytul: e.target.value })} placeholder="np. Przepalona dioda LED, Pęknięta matryca" />
              </Field>
              <Field label="Opis szczegółowy">
                <textarea className={`${inputClass} min-h-24 resize-none`} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} placeholder="Opisz dokładnie objawy oraz kiedy usterka wystąpiła..." />
              </Field>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button>
              <Button type="submit">Zapisz i utwórz zgłoszenie</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}