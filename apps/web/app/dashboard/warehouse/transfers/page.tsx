'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowRightLeft, Loader2, Save, Truck, Users } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';

export default function TransfersPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  
  const [sourceItems, setSourceItems] = useState<any[]>([]);
  const [targetItems, setTargetItems] = useState<any[]>([]); // Zwykły podgląd, co tam już jest
  const [transferList, setTransferList] = useState<any[]>([]);
  
  const [dict, setDict] = useState<any>({ uzytkownicy: [], pojazdy: [] });
  const [loading, setLoading] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Modal zadania
  const [showModal, setShowModal] = useState(false);
  const [taskForm, setTaskForm] = useState<any>({ przypisani: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/wydarzenia'),
      api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      api.get('/api/flota/pojazdy').catch(() => ({ data: [] }))
    ]).then(([e, u, p]) => {
      setEvents(e.data || []);
      setDict({ uzytkownicy: u.data || [], pojazdy: p.data || [] });
      setLoading(false);
    });
  }, []);

  // Ładowanie stanu wydanego sprzętu przy zmianie eventu źródłowego
  useEffect(() => {
    if (!sourceId) {
      setSourceItems([]);
      setTransferList([]);
      return;
    }
    api.get(`/api/magazyn/wydarzenia/${sourceId}/sprzet`).then((res) => {
      // Bierzemy tylko pozycje, które są aktualnie na zewnątrz (wydana_ilosc > przyjeta_ilosc)
      const availableToTransfer = (res.data?.pozycje || [])
        .filter((p: any) => p.do_przyjecia > 0)
        .map((p: any) => ({
          ...p,
          ilosc_transfer: p.do_przyjecia // Domyślnie proponujemy transfer całości
        }));
      setSourceItems(availableToTransfer);
      setTransferList([]);
    });
  }, [sourceId]);

  // Ładowanie podglądu sprzętu dla eventu docelowego
  useEffect(() => {
    if (!targetId) {
      setTargetItems([]);
      return;
    }
    api.get(`/api/magazyn/wydarzenia/${targetId}/sprzet`).then((res) => {
      setTargetItems(res.data?.pozycje || []);
    });
  }, [targetId]);

  // Obsługa Drag & Drop
  const handleDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    try {
      const item = JSON.parse(e.dataTransfer.getData('application/json'));
      moveToTransfer(item);
    } catch (err) {
      console.error("Błąd upuszczania", err);
    }
  };

  const moveToTransfer = (item: any) => {
    // Sprawdź, czy już nie jest w transferList (identyfikacja po kluczu_sprzetu)
    if (transferList.some(t => t.klucz_sprzetu === item.klucz_sprzetu)) return;
    setTransferList(prev => [...prev, item]);
    setSourceItems(prev => prev.filter(s => s.klucz_sprzetu !== item.klucz_sprzetu));
  };

  const revertTransfer = (item: any) => {
    setSourceItems(prev => [...prev, item]);
    setTransferList(prev => prev.filter(t => t.klucz_sprzetu !== item.klucz_sprzetu));
  };

  const submitTransfer = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const sourceName = events.find(ev => String(ev.id) === sourceId)?.nazwa || 'Event A';
      const targetName = events.find(ev => String(ev.id) === targetId)?.nazwa || 'Event B';

      await api.post('/api/magazyn/transfer', {
        sourceEventId: sourceId,
        sourceEventName: sourceName,
        targetEventId: targetId,
        targetEventName: targetName,
        items: transferList,
        task: taskForm
      });
      
      setShowModal(false);
      setTransferList([]);
      // Odświeżenie list
      setSourceId('');
      setTargetId('');
      alert('Transfer zakończony sukcesem! Wygenerowano WZ i PZ.');
      router.push(`/dashboard/warehouse`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się wykonać transferu.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle 
        eyebrow="Magazyn" 
        title="Przeniesienia między eventowe" 
        description="Wybierz wydarzenie, z którego schodzi sprzęt, oraz to, na które jedzie. Przeciągnij sprzęt lub kliknij strzałkę. Transfer zdejmie go z pierwszego eventu (utworzy PZ) i przypisze do drugiego (utworzy WZ)." 
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* KOLUMNA LEWA: ŹRÓDŁO */}
        <Card className="flex flex-col h-[75vh]">
          <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">A</span>
              Wydarzenie zdejmujące (Źródło)
            </h2>
            <Field label="Wybierz wydarzenie">
              <select className={inputClass} value={sourceId} onChange={e => setSourceId(e.target.value)}>
                <option value="">Wybierz...</option>
                {events.filter(e => String(e.id) !== targetId).map(e => <option key={e.id} value={e.id}>{e.nazwa}</option>)}
              </select>
            </Field>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {!sourceId && <p className="text-center text-sm font-bold text-slate-400 mt-10">Wybierz wydarzenie, aby wczytać wydany na nie sprzęt.</p>}
            
            {sourceId && sourceItems.length === 0 && <p className="text-center text-sm font-bold text-slate-400 mt-10">Brak sprzętu oczekującego na zwrot z tego wydarzenia.</p>}
            
            {sourceItems.map(item => (
              <div 
                key={item.klucz_sprzetu}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 cursor-grab hover:border-cyan-300 hover:shadow-sm transition-all active:cursor-grabbing"
              >
                <div>
                  <p className="font-black text-slate-900">{item.nazwa}</p>
                  <p className="text-xs font-bold text-slate-400">{item.kod ? `Kod: ${item.kod}` : item.kategoria}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400">Dostępne</p>
                    <p className="font-black text-slate-700">{item.do_przyjecia} {item.jednostka || 'szt.'}</p>
                  </div>
                  <button onClick={() => moveToTransfer(item)} className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-cyan-600 hover:text-white">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* KOLUMNA PRAWA: CEL */}
        <Card className="flex flex-col h-[75vh]">
          <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs text-cyan-700">B</span>
                Wydarzenie docelowe
              </span>
              <Button onClick={() => setShowModal(true)} disabled={transferList.length === 0 || !targetId}>
                <ArrowRightLeft size={16} className="inline mr-1" /> Zatwierdź transfer
              </Button>
            </h2>
            <Field label="Wybierz wydarzenie">
              <select className={inputClass} value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">Wybierz...</option>
                {events.filter(e => String(e.id) !== sourceId).map(e => <option key={e.id} value={e.id}>{e.nazwa}</option>)}
              </select>
            </Field>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 overflow-y-auto pr-2 space-y-2 rounded-2xl p-2 transition-colors duration-300 ${isDraggingOver ? 'bg-cyan-50/80 ring-2 ring-cyan-200 border-dashed' : ''} ${!targetId ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {targetId && transferList.length === 0 && targetItems.length === 0 && (
              <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-400">Przeciągnij tutaj sprzęt z kolumny lewej.</p>
              </div>
            )}

            {/* Sprzęt wyznaczony do transferu (podświetlony) */}
            {transferList.length > 0 && (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-600">Przygotowane do transferu</p>
                <div className="space-y-2">
                  {transferList.map(item => (
                    <div key={item.klucz_sprzetu} className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm">
                      <div>
                        <p className="font-black text-cyan-900">{item.nazwa}</p>
                        <p className="text-xs font-bold text-cyan-700/60">{item.kod || item.kategoria}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-cyan-700/60">Ilość</p>
                          <input 
                            type="number" 
                            min="1" 
                            max={item.do_przyjecia}
                            value={item.ilosc_transfer} 
                            onChange={(e) => setTransferList(prev => prev.map(t => t.klucz_sprzetu === item.klucz_sprzetu ? { ...t, ilosc_transfer: Number(e.target.value) } : t))}
                            className="w-16 rounded-lg border border-cyan-200 bg-white p-1 text-center text-sm font-black outline-none focus:border-cyan-500"
                          />
                        </div>
                        <button onClick={() => revertTransfer(item)} className="text-xs font-black text-cyan-700 hover:underline">
                          Cofnij
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sprzęt już istniejący na evencie B (tylko do podglądu, szare) */}
            {targetItems.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Sprzęt już obecny na tym wydarzeniu</p>
                <div className="space-y-2 opacity-60">
                  {targetItems.filter((p: any) => p.stan_operacyjny === 'wydany').map((item: any) => (
                    <div key={item.klucz_sprzetu} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 pointer-events-none">
                      <p className="font-bold text-slate-700">{item.nazwa}</p>
                      <p className="font-black text-slate-600">{item.wydana_ilosc - item.przyjeta_ilosc} {item.jednostka || 'szt.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {showModal && (
        <SimpleModal title="Zatwierdź transfer" onClose={() => setShowModal(false)}>
          {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <form onSubmit={submitTransfer} className="space-y-5">
            <div className="rounded-2xl bg-cyan-50 p-4 border border-cyan-100">
              <p className="text-sm font-bold text-cyan-800">
                Wykonanie tej akcji wygeneruje <b>PZ</b> na zdanie sprzętu z pierwszego wydarzenia oraz <b>WZ</b> na wydanie go na drugie. <br/><br/>
                Opcjonalnie możesz od razu wygenerować w systemie <b>Zadanie logistyczne</b> i przypisać kogoś do transportu.
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data i godzina transferu">
                <input type="datetime-local" className={inputClass} value={taskForm.data_start || ''} onChange={e => setTaskForm({...taskForm, data_start: e.target.value})} />
              </Field>
              <Field label="Przypisz pojazd (Flota)">
                <select className={inputClass} value={taskForm.id_pojazdu || ''} onChange={e => setTaskForm({...taskForm, id_pojazdu: e.target.value})}>
                  <option value="">Nie przypisuj pojazdu</option>
                  {dict.pojazdy.map((p: any) => <option key={p.id} value={p.id}>{p.nazwa} ({p.nr_rejestracyjny})</option>)}
                </select>
              </Field>
            </div>

            <Field label="Osoby odpowiedzialne (Ekipa transportowa)">
              <select multiple className={`${inputClass} min-h-[100px]`} value={taskForm.przypisani} onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setTaskForm({...taskForm, przypisani: values});
              }}>
                {dict.uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}
              </select>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Przytrzymaj CTRL/CMD aby wybrać wiele osób.</p>
            </Field>

            <Field label="Uwagi do transportu (opcjonalnie)">
              <textarea className={inputClass} rows={2} value={taskForm.uwagi || ''} onChange={e => setTaskForm({...taskForm, uwagi: e.target.value})} />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Anuluj</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Przetwarzanie dokumentów...' : 'Zatwierdź transfer'}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}