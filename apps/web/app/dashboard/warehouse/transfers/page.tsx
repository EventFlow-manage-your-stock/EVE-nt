'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowRightLeft, Loader2, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle, SearchableSelect } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';

// --- HELPERY KALENDARZA ---
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Poniedziałek jako pierwszy dzień tygodnia
}
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function formatCalDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TransfersPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  
  const [sourceItems, setSourceItems] = useState<any[]>([]);
  const [targetItems, setTargetItems] = useState<any[]>([]); 
  const [transferList, setTransferList] = useState<any[]>([]);
  const [moveQuantities, setMoveQuantities] = useState<Record<string, number>>({});
  
  const [dict, setDict] = useState<any>({ uzytkownicy: [], pojazdy: [] });
  const [loading, setLoading] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Kalendarz
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      const fetchedEvents = e.data || [];
      setEvents(fetchedEvents);
      setDict({ uzytkownicy: u.data || [], pojazdy: p.data || [] });
      
      // AUTO-SELEKCJA NAJBLIŻSZEGO WYDARZENIA (ŹRÓDŁO)
      if (fetchedEvents.length > 0) {
        const now = new Date();
        const closest = fetchedEvents.reduce((prev: any, curr: any) => {
          if (!curr.data_start) return prev;
          if (!prev.data_start) return curr;
          const diffCurr = Math.abs(new Date(curr.data_start).getTime() - now.getTime());
          const diffPrev = Math.abs(new Date(prev.data_start).getTime() - now.getTime());
          return diffCurr < diffPrev ? curr : prev;
        });
        if (closest?.id) {
          setSourceId(String(closest.id));
          setCurrentMonth(new Date(closest.data_start || now));
        }
      }
      setLoading(false);
    });
  }, []);

  // Sortowanie i filtrowanie po kalendarzu
  const sortedEvents = useMemo(() => {
    let sorted = [...events].sort((a, b) => new Date(a.data_start || 0).getTime() - new Date(b.data_start || 0).getTime());
    if (selectedDate) {
      sorted = sorted.filter(e => e.data_start && isSameDay(new Date(e.data_start), selectedDate));
    }
    return sorted;
  }, [events, selectedDate]);

  const handleCalendarSelect = (clickedId: string) => {
    const strId = String(clickedId);
    if (sourceId === strId) { setSourceId(''); return; }
    if (targetId === strId) { setTargetId(''); return; }

    if (!sourceId && !targetId) {
      setSourceId(strId);
    } else if (sourceId && !targetId) {
      const evSrc = events.find(e => String(e.id) === sourceId);
      const evNew = events.find(e => String(e.id) === strId);
      if (evSrc && evNew && new Date(evNew.data_start) < new Date(evSrc.data_start)) {
        setTargetId(sourceId); 
        setSourceId(strId);    
      } else {
        setTargetId(strId);
      }
    } else if (!sourceId && targetId) {
      const evTgt = events.find(e => String(e.id) === targetId);
      const evNew = events.find(e => String(e.id) === strId);
      if (evTgt && evNew && new Date(evNew.data_start) > new Date(evTgt.data_start)) {
        setSourceId(targetId);
        setTargetId(strId);
      } else {
        setSourceId(strId);
      }
    } else {
      setSourceId(strId);
      setTargetId('');
    }
  };

  // Ładowanie stanu wydanego sprzętu przy zmianie eventu źródłowego
  useEffect(() => {
    if (!sourceId) {
      setSourceItems([]);
      setTransferList([]);
      setMoveQuantities({});
      return;
    }
    api.get(`/api/magazyn/wydarzenia/${sourceId}/sprzet`).then((res) => {
      const availableToTransfer = (res.data?.pozycje || [])
        .filter((p: any) => p.do_przyjecia > 0)
        .map((p: any) => ({ ...p, ilosc_transfer: p.do_przyjecia }));
      setSourceItems(availableToTransfer);
      
      const initialQty: Record<string, number> = {};
      availableToTransfer.forEach((p: any) => { initialQty[p.klucz_sprzetu] = p.do_przyjecia; });
      setMoveQuantities(initialQty);
      setTransferList([]);
    });
  }, [sourceId]);

  useEffect(() => {
    if (!targetId) { setTargetItems([]); return; }
    api.get(`/api/magazyn/wydarzenia/${targetId}/sprzet`).then((res) => {
      setTargetItems(res.data?.pozycje || []);
    });
  }, [targetId]);

  const handleDragStart = (e: React.DragEvent, item: any) => {
    // Przy drag&drop domyślnie przenosimy całą ilość wpisaną w inpucię
    const qty = moveQuantities[item.klucz_sprzetu] || item.do_przyjecia;
    e.dataTransfer.setData('application/json', JSON.stringify({...item, dragQty: qty}));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    try {
      const parsed = JSON.parse(e.dataTransfer.getData('application/json'));
      moveToTransfer(parsed, parsed.dragQty);
    } catch (err) { console.error("Błąd upuszczania", err); }
  };

  const moveToTransfer = (item: any, qtyToMove: number) => {
    if (qtyToMove <= 0) return;
    
    // Dodaj do prawego koszyka
    setTransferList(prev => {
      const existing = prev.find(t => t.klucz_sprzetu === item.klucz_sprzetu);
      if (existing) {
        return prev.map(t => t.klucz_sprzetu === item.klucz_sprzetu ? { ...t, ilosc_transfer: t.ilosc_transfer + qtyToMove } : t);
      }
      return [...prev, { ...item, ilosc_transfer: qtyToMove }];
    });

    // Zdejmij z lewego koszyka
    setSourceItems(prev => prev.map(s => {
      if (s.klucz_sprzetu === item.klucz_sprzetu) {
        const remaining = s.do_przyjecia - qtyToMove;
        // Aktualizuj lokalny stan inputa dla reszty
        setMoveQuantities(q => ({...q, [s.klucz_sprzetu]: remaining}));
        return { ...s, do_przyjecia: remaining };
      }
      return s;
    }).filter(s => s.do_przyjecia > 0));
  };

  const revertTransfer = (item: any, qtyToRevert: number) => {
    setSourceItems(prev => {
      const existing = prev.find(s => s.klucz_sprzetu === item.klucz_sprzetu);
      if (existing) {
        const newTotal = existing.do_przyjecia + qtyToRevert;
        setMoveQuantities(q => ({...q, [item.klucz_sprzetu]: newTotal}));
        return prev.map(s => s.klucz_sprzetu === item.klucz_sprzetu ? { ...s, do_przyjecia: newTotal } : s);
      }
      setMoveQuantities(q => ({...q, [item.klucz_sprzetu]: qtyToRevert}));
      return [...prev, { ...item, do_przyjecia: qtyToRevert }];
    });

    setTransferList(prev => prev.map(t => {
      if (t.klucz_sprzetu === item.klucz_sprzetu) {
        return { ...t, ilosc_transfer: t.ilosc_transfer - qtyToRevert };
      }
      return t;
    }).filter(t => t.ilosc_transfer > 0));
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

  // --- RENDEROWANIE KALENDARZA ---
  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const today = new Date();

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 animate-fade-in-up">
      <PageTitle 
        eyebrow="Magazyn" 
        title="Przeniesienia między eventowe" 
        description="Wybierz wydarzenie źródłowe i docelowe. Możesz podać konkretną liczbę sztuk i przelać część sprzętu. System zdejmie go z pierwszego eventu (PZ) i przydzieli do drugiego (WZ)." 
      />

      {/* KALENDARZ I SZYBKI WYBÓR (FLEX ROW) */}
      <Card className="p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col xl:flex-row">
        
        {/* LEWY PANEL - MINICALENDAR */}
        <div className="xl:w-[360px] shrink-0 border-b xl:border-b-0 xl:border-r border-slate-100 dark:border-white/5 p-6 bg-slate-50/50 dark:bg-black/10">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Wybór z grafiku
              </h2>
              <div className="flex gap-1">
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"><ChevronLeft size={16}/></button>
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"><ChevronRight size={16}/></button>
              </div>
           </div>
           <p className="text-center font-bold text-cyan-700 dark:text-cyan-400 mb-4 capitalize">
             {currentMonth.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
           </p>
           
           <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] font-black uppercase text-slate-400">
             <div>Pn</div><div>Wt</div><div>Śr</div><div>Cz</div><div>Pt</div><div>So</div><div>Nd</div>
           </div>
           <div className="grid grid-cols-7 gap-1 text-center">
             {blanks.map(b => <div key={`blank-${b}`} className="h-8"></div>)}
             {days.map(day => {
               const isToday = isSameDay(day, today);
               const isSelected = selectedDate && isSameDay(day, selectedDate);
               const dayEvents = events.filter(e => e.data_start && isSameDay(new Date(e.data_start), day));
               const hasEvents = dayEvents.length > 0;
               
               return (
                 <button
                   key={day.toISOString()}
                   onClick={() => setSelectedDate(isSelected ? null : day)}
                   className={`relative h-10 rounded-lg text-xs font-bold flex items-center justify-center transition-all duration-300
                     ${isSelected ? 'bg-cyan-600 text-white shadow-md scale-105 z-10' : 
                       isToday ? 'border-2 border-cyan-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-white' : 
                       'hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'}
                   `}
                 >
                   {day.getDate()}
                   {hasEvents && (
                     <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-cyan-500'}`}></span>
                   )}
                 </button>
               )
             })}
           </div>
           <div className="mt-5 text-[10px] font-bold text-slate-400 text-center">
             {selectedDate ? <button onClick={() => setSelectedDate(null)} className="text-red-500 hover:underline flex items-center justify-center w-full gap-1"><X size={12}/> Wyczyść datę i pokaż wszystkie</button> : 'Wybierz dzień z kropką, aby zawęzić listę projektów.'}
           </div>
        </div>

        {/* PRAWY PANEL - LISTA WYDARZEŃ */}
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
            Kliknij dwa wydarzenia z poziomej osi czasu. System automatycznie ułoży chronologię.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 custom-scrollbar flex-1 items-center">
            {sortedEvents.map(ev => {
              const isSource = String(ev.id) === sourceId;
              const isTarget = String(ev.id) === targetId;
              
              let stateClasses = "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 hover:border-cyan-300 dark:hover:border-cyan-700/50 hover:bg-white dark:hover:bg-white/5 opacity-80 hover:opacity-100";
              let badgeClasses = "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400";
              let badgeText = "Wybierz";

              if (isSource) {
                stateClasses = "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 ring-2 ring-cyan-200 dark:ring-cyan-500/30 opacity-100";
                badgeClasses = "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400";
                badgeText = "Źródło (Z)";
              } else if (isTarget) {
                stateClasses = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-200 dark:ring-emerald-500/30 opacity-100";
                badgeClasses = "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400";
                badgeText = "Cel (Na)";
              }

              return (
                <button
                  key={ev.id}
                  onClick={() => handleCalendarSelect(ev.id)}
                  className={`flex-shrink-0 w-56 p-5 rounded-2xl border text-left transition-all duration-300 shadow-sm flex flex-col h-full justify-center ${stateClasses}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${badgeClasses}`}>
                      {badgeText}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      {formatCalDate(ev.data_start)}
                    </span>
                  </div>
                  <p className="text-base font-black text-slate-800 dark:text-white line-clamp-2 leading-tight" title={ev.nazwa}>
                    {ev.nazwa}
                  </p>
                  {ev.miejsce?.nazwa || ev.miejsce_reczne ? (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 truncate flex items-center gap-1">
                      <MapPin size={12}/> {ev.miejsce?.nazwa || ev.miejsce_reczne}
                    </p>
                  ) : null}
                </button>
              )
            })}
            {sortedEvents.length === 0 && (
              <div className="w-full text-center py-10">
                <p className="text-sm font-bold text-slate-400">Brak wydarzeń w tym dniu.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* KOLUMNA LEWA: ŹRÓDŁO */}
        <Card className="flex flex-col h-[70vh]">
          <div className="mb-4 space-y-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-xs text-cyan-700 dark:text-cyan-400">A</span>
              Pobierz sprzęt z (Źródło)
            </h2>
            <Field label="Pełna lista z bazy (Alternatywa)">
              <SearchableSelect 
                value={sourceId} 
                onChange={(v) => setSourceId(v)} 
                options={events.filter(e => String(e.id) !== targetId).map(e => ({ value: String(e.id), label: e.nazwa }))}
                placeholder="Wyszukaj z bazy..."
              />
            </Field>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {!sourceId && <p className="text-center text-sm font-bold text-slate-400 mt-10">Wybierz wydarzenie A, aby załadować wydany sprzęt.</p>}
            {sourceId && sourceItems.length === 0 && <p className="text-center text-sm font-bold text-slate-400 mt-10">Brak sprzętu oczekującego na zwrot z tego wydarzenia.</p>}
            
            {sourceItems.map(item => (
              <div 
                key={item.klucz_sprzetu}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 cursor-grab hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-sm transition-all active:cursor-grabbing"
              >
                <div className="min-w-0 pr-2 flex-1">
                  <p className="font-black text-slate-900 dark:text-white truncate">{item.nazwa}</p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{item.kod ? `Kod: ${item.kod}` : item.kategoria}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Ilość do wysłania</p>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        min="1" 
                        max={item.do_przyjecia}
                        value={moveQuantities[item.klucz_sprzetu] || ''} 
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (val > item.do_przyjecia) val = item.do_przyjecia;
                          setMoveQuantities(prev => ({...prev, [item.klucz_sprzetu]: val}));
                        }}
                        className={`w-14 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 py-1 text-center text-sm font-black outline-none focus:border-cyan-500 ${moveQuantities[item.klucz_sprzetu] < item.do_przyjecia ? 'border-amber-400 text-amber-600' : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs font-bold text-slate-400">z {item.do_przyjecia}</span>
                    </div>
                  </div>
                  <button onClick={() => moveToTransfer(item, moveQuantities[item.klucz_sprzetu] || item.do_przyjecia)} className="rounded-xl bg-cyan-50 dark:bg-white/5 p-2 text-cyan-600 dark:text-cyan-400 transition-colors hover:bg-cyan-600 hover:text-white dark:hover:bg-[#04e0ff] dark:hover:text-slate-900">
                    <ArrowRight size={18} strokeWidth={2.5}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* KOLUMNA PRAWA: CEL */}
        <Card className="flex flex-col h-[70vh]">
          <div className="mb-4 space-y-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">B</span>
                Przekaż na (Cel)
              </span>
              <Button onClick={() => setShowModal(true)} disabled={transferList.length === 0 || !targetId}>
                <ArrowRightLeft size={16} className="inline mr-1" /> Zatwierdź transfer
              </Button>
            </h2>
            <Field label="Pełna lista z bazy (Alternatywa)">
              <SearchableSelect 
                value={targetId} 
                onChange={(v) => setTargetId(v)} 
                options={events.filter(e => String(e.id) !== sourceId).map(e => ({ value: String(e.id), label: e.nazwa }))}
                placeholder="Wyszukaj z bazy..."
              />
            </Field>
          </div>

          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            className={`flex-1 overflow-y-auto pr-2 space-y-2 rounded-2xl p-2 transition-colors duration-300 custom-scrollbar ${isDraggingOver ? 'bg-emerald-50/80 dark:bg-emerald-900/10 ring-2 ring-emerald-200 dark:ring-emerald-500/30 border-dashed' : ''} ${!targetId ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {targetId && transferList.length === 0 && targetItems.length === 0 && (
              <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-black/20">
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Przeciągnij tutaj sprzęt lub użyj strzałki obok produktu.</p>
              </div>
            )}

            {/* Sprzęt wyznaczony do transferu (podświetlony) */}
            {transferList.length > 0 && (
              <div className="mb-4 border-b border-slate-100 dark:border-white/5 pb-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">W koszyku transferowym</p>
                <div className="space-y-2">
                  {transferList.map(item => (
                    <div key={item.klucz_sprzetu} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/10 p-3 shadow-sm">
                      <div className="min-w-0 pr-2">
                        <p className="font-black text-emerald-900 dark:text-emerald-100 truncate">{item.nazwa}</p>
                        <p className="text-xs font-bold text-emerald-700/60 dark:text-emerald-400/60 truncate">{item.kod || item.kategoria}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-emerald-700/60 dark:text-emerald-400/60">Ilość</p>
                          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{item.ilosc_transfer}</p>
                        </div>
                        <button onClick={() => revertTransfer(item, item.ilosc_transfer)} className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30 shadow-sm">
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
                    <div key={item.klucz_sprzetu} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3 pointer-events-none">
                      <p className="font-bold text-slate-700 dark:text-slate-300 truncate">{item.nazwa}</p>
                      <p className="font-black text-slate-600 dark:text-slate-400 shrink-0">{item.wydana_ilosc - item.przyjeta_ilosc} {item.jednostka || 'szt.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {showModal && (
        <SimpleModal title="Zatwierdź transfer operacyjny" onClose={() => setShowModal(false)}>
          {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <form onSubmit={submitTransfer} className="space-y-5">
            <div className="rounded-2xl bg-cyan-50 dark:bg-cyan-900/10 p-4 border border-cyan-100 dark:border-cyan-500/20">
              <p className="text-sm font-bold text-cyan-800 dark:text-cyan-200">
                Wykonanie tej akcji wygeneruje <b>PZ</b> na zdanie sprzętu z pierwszego wydarzenia oraz <b>WZ</b> na wydanie go bezpośrednio na drugie wydarzenie docelowe. <br/><br/>
                System ułoży poprawnie historię logistyczną każdego urządzenia bez fizycznego wracania do magazynu centralnego.
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data i godzina wykonania transferu">
                <input type="datetime-local" className={inputClass} value={taskForm.data_start || ''} onChange={e => setTaskForm({...taskForm, data_start: e.target.value})} required/>
              </Field>
              <Field label="Pojazd dokonujący przewozu (Opcjonalnie)">
                <SearchableSelect 
                  value={taskForm.id_pojazdu || ''} 
                  onChange={v => setTaskForm({...taskForm, id_pojazdu: v})}
                  options={dict.pojazdy.map((p: any) => ({ value: String(p.id), label: `${p.nazwa} (${p.nr_rejestracyjny})` }))}
                  placeholder="Nie przypisuj pojazdu"
                />
              </Field>
            </div>

            <Field label="Kto odpowiada za transfer (Opcjonalnie)">
              <select multiple className={`${inputClass} min-h-[100px]`} value={taskForm.przypisani} onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setTaskForm({...taskForm, przypisani: values});
              }}>
                {dict.uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}
              </select>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Przytrzymaj CTRL/CMD aby zaznaczyć kierowcę i wsparcie z listy.</p>
            </Field>

            <Field label="Dodatkowe uwagi na dokument (Opcjonalnie)">
              <textarea className={inputClass} rows={2} value={taskForm.uwagi || ''} onChange={e => setTaskForm({...taskForm, uwagi: e.target.value})} />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-white/10 pt-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Anuluj</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Generowanie PZ / WZ...' : 'Zatwierdź i generuj transfer'}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}