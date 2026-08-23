'use client';

import { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { Calendar, CalendarPlus, ChevronLeft, ChevronRight, Loader2, Search, Info, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { Button, Card, PageTitle } from '../../../components/ProductUI';
import { QuickAddCalendarModal } from '../../../components/QuickAddCalendarModal';

const views = ['miesiąc', 'tydzień', 'dzień', 'lista'] as const;
type View = typeof views[number];

type CalendarItem = {
  id: string;
  sourceId: number | string;
  typ: string;
  tytul: string;
  start: string;
  koniec?: string | null;
  kolor?: string | null;
  ikona?: string | null;
  status?: string | null;
  statusMagazynowy?: string | null;
  statusKsiegowy?: string | null;
  ikonaMagazynowa?: string | null;
  ikonaKsiegowa?: string | null;
  miejsce?: string | null;
};

const typeLabels: Record<string, string> = {
  wydarzenie: 'Wydarzenia',
  wypozyczenie: 'Wynajmy',
  urlop: 'Nieobecności',
  flota: 'Flota',
};

const typeFallbackColor: Record<string, string> = {
  wydarzenie: '#0891B2',
  wypozyczenie: '#F97316',
  urlop: '#020617',
  flota: '#22C55E',
};

const CALENDAR_BAR_TOP = 92;
const CALENDAR_BAR_ROW_HEIGHT = 22;
const CALENDAR_BAR_ROW_GAP = 4;
const CALENDAR_WEEK_MIN_HEIGHT = 172;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeek(date: Date) { const d = startOfWeek(date); d.setDate(d.getDate() + 7); return d; }
function endOfDay(date: Date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function startOfDay(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function iso(d: Date) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function normalizeType(t: string) { return t === 'wynajem' ? 'wypozyczenie' : t; }
function itemUrl(item: CalendarItem) {
  const typ = normalizeType(item.typ);
  if (typ === 'wydarzenie') return `/dashboard/events/${item.sourceId}`;
  if (typ === 'wypozyczenie') return `/dashboard/rentals/${item.sourceId}`;
  if (typ === 'urlop') return `/dashboard/leaves/${item.sourceId}`;
  if (typ === 'flota') return `/dashboard/fleet`;
  return '/dashboard/calendar';
}
function pastelColor(hex?: string | null) {
  const value = (hex || '#0891B2').replace('#', '');
  if (value.length !== 6) return 'rgba(148,163,184,.78)';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * 0.48 + 255 * 0.52);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
function itemActiveOnRange(item: CalendarItem, from: Date, to: Date) {
  const start = item.start ? new Date(item.start) : null;
  if (!start) return false;
  const end = item.koniec ? new Date(item.koniec) : start;
  return start <= to && end >= from;
}
function itemActiveOnDay(item: CalendarItem, day: Date) {
  return itemActiveOnRange(item, startOfDay(day), endOfDay(day));
}
function itemSort(a: CalendarItem, b: CalendarItem) {
  const as = new Date(a.start || 0).getTime();
  const bs = new Date(b.start || 0).getTime();
  if (as !== bs) return as - bs;
  const ae = new Date(a.koniec || a.start || 0).getTime();
  const be = new Date(b.koniec || b.start || 0).getTime();
  if (ae !== be) return be - ae;
  return String(a.tytul || '').localeCompare(String(b.tytul || ''), 'pl');
}
function dayDiff(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

function formatTooltipDate(dStr: string) {
  const d = new Date(dStr);
  return d.toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ==========================================
// Główny komponent z logiką
// ==========================================
function CalendarContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get('date');

  const [view, setView] = useState<View>('miesiąc');
  const [cursor, setCursor] = useState(new Date());
  const [isInitialized, setIsInitialized] = useState(false);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<string[]>(['wydarzenie', 'wypozyczenie', 'urlop', 'flota']);
  const [dict, setDict] = useState<any>({ typy: [], statusy: [], kontrahenci: [], miejsca: [], uzytkownicy: [] });

  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Pobierz zalogowanego usera, aby ukryć obce "prywatne" wydarzenia
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user') || JSON.parse(localStorage.getItem('wms-auth-storage') || '{}')?.state?.user;
      if (stored) {
        try {
          const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
          setCurrentUserId(parsed.id);
        } catch (e) {}
      }
    }
  }, []);

  // Stan i logika tooltipa
  const [tooltip, setTooltip] = useState<{ show: boolean; item: CalendarItem | null; x: number; y: number }>({ show: false, item: null, x: 0, y: 0 });
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  const handleBarEnter = (e: React.MouseEvent, item: CalendarItem) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    hoverTimer.current = setTimeout(() => {
      let x = rect.left + rect.width / 2;
      const y = rect.top - 8;
      
      // Zabezpieczenie przed obcięciem z lewej/prawej strony okna
      if (typeof window !== 'undefined') {
        if (x < 150) x = 150;
        if (x > window.innerWidth - 150) x = window.innerWidth - 150;
      }
      
      setTooltip({ show: true, item, x, y });
    }, 400); // 400ms opóźnienia na pojawienie się dymka
  };

  const handleBarLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setTooltip(prev => ({ ...prev, show: false }));
  };

  useEffect(() => {
    let targetDate = new Date();
    let targetView: View = 'miesiąc';

    if (typeof window !== 'undefined') {
      const savedView = sessionStorage.getItem('ef_cal_view') as View;
      if (savedView && views.includes(savedView)) targetView = savedView;

      const savedCursor = sessionStorage.getItem('ef_cal_cursor');
      if (savedCursor) {
        const d = new Date(savedCursor);
        if (!isNaN(d.getTime())) targetDate = d;
      }
    }

    if (dateParam) {
      const d = new Date(dateParam);
      if (!isNaN(d.getTime())) targetDate = d;
    }

    setView(targetView);
    setCursor(targetDate);
    setIsInitialized(true);
  }, [dateParam]);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      sessionStorage.setItem('ef_cal_view', view);
      sessionStorage.setItem('ef_cal_cursor', cursor.toISOString());
    }
  }, [view, cursor, isInitialized]);

  const range = useMemo(() => {
    if (view === 'dzień') {
      const od = startOfDay(cursor);
      const to = new Date(od); to.setDate(to.getDate() + 1);
      return { od, to };
    }
    if (view === 'tydzień') return { od: startOfWeek(cursor), to: endOfWeek(cursor) };
    const od = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 7);
    return { od, to };
  }, [cursor, view]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [cal, typy, statusy, kontrahenci, miejsca, uzytkownicy] = await Promise.all([
        api.get(`/api/kalendarz?od=${iso(range.od)}&do=${iso(range.to)}`),
        api.get('/api/slowniki/typy-wydarzen').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-wydarzenia').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
        api.get('/api/slowniki/miejsca').catch(() => ({ data: [] })),
        api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      ]);
      const fetchedItems = (cal.data.items || cal.data || []).map((i: any) => ({ ...i, typ: normalizeType(i.typ) }));
      
      // Ukryj wydarzenia prywatne, jeśli użytkownik nie jest ich twórcą
      setItems(fetchedItems.filter((item: any) => {
         if (item.typ === 'Wydarzenie prywatne' || item.typ?.toLowerCase() === 'wydarzenie prywatne') {
            return item.sourceId_creator === currentUserId; // wymaga aby backend API przesyłał id twórcy, w przeciwnym razie odrzuć
         }
         return true;
      }));
      setDict({ typy: typy.data || [], statusy: statusy.data || [], kontrahenci: kontrahenci.data || [], miejsca: miejsca.data || [], uzytkownicy: uzytkownicy.data || [] });
    } catch (e: any) {
      setItems([]);
      setError(e?.response?.data?.message || e?.message || 'Nie udało się pobrać kalendarza. Sprawdź API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isInitialized) return;
    load();
  }, [view, cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), isInitialized]);

  const days = useMemo(() => {
    const count = view === 'dzień' ? 1 : view === 'tydzień' ? 7 : 42;
    const start = view === 'miesiąc' ? startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : range.od;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [view, cursor, range.od]);

  const weeks = useMemo(() => {
    if (view === 'dzień') return [days];
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days, view]);

  const filteredItems = useMemo(() => {
    const phrase = search.trim().toLowerCase();
    return items
      .filter((i) => activeTypes.includes(normalizeType(i.typ)))
      .filter((i) => !phrase || `${i.tytul || ''} ${i.status || ''} ${i.statusMagazynowy || ''} ${i.statusKsiegowy || ''} ${i.miejsce || ''}`.toLowerCase().includes(phrase))
      .sort(itemSort);
  }, [items, activeTypes, search]);

  function move(mult: number) {
    const d = new Date(cursor);
    if (view === 'miesiąc' || view === 'lista') d.setMonth(d.getMonth() + mult);
    else d.setDate(d.getDate() + (view === 'tydzień' ? 7 * mult : mult));
    setCursor(d);
  }

  function toggleType(type: string) {
    setActiveTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }
  
  function handleDayClick(day: Date) {
    setSelectedDate(day);
    setShowAdd(true);
  }

  const title = cursor.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', day: view === 'dzień' ? 'numeric' : undefined });

  if (!isInitialized) return <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-[#04e0ff] w-8 h-8" /></div>;

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 relative animate-fade-in-up">
      <PageTitle
        eyebrow="Kalendarz"
        title=""
        description=""
        action={
          <Button onClick={() => { setSelectedDate(undefined); setShowAdd(true); }}>
            <CalendarPlus size={16} className="inline mr-1" /> Dodaj
          </Button>
        }
      />

      <Card className="!p-4 border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="rounded-xl border border-slate-200 dark:border-white/10 p-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-300"><ChevronLeft size={18} /></button>
            
            <div 
              className="relative flex items-center justify-center min-w-[240px] group cursor-pointer"
              onClick={() => {
                if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker();
                  } catch (e) {
                    console.error("Browser doesn't support showPicker", e);
                  }
                }
              }}
            >
              <p className="text-center text-2xl font-medium uppercase tracking-tight text-slate-800 dark:text-white group-hover:text-[#04e0ff] transition-colors flex items-center gap-2">
                {title} <Calendar size={20} className="text-slate-400 group-hover:text-[#04e0ff] transition-colors" />
              </p>
              <input
                ref={dateInputRef}
                type="date"
                title="Wybierz datę"
                className="absolute w-px h-px opacity-0 pointer-events-none -z-10"
                value={iso(cursor)}
                onChange={(e) => {
                  if (e.target.value) {
                    setCursor(new Date(e.target.value));
                  }
                }}
              />
            </div>

            <button onClick={() => move(1)} className="rounded-xl border border-slate-200 dark:border-white/10 p-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-300"><ChevronRight size={18} /></button>
            <Button variant="secondary" onClick={() => setCursor(new Date())}>Dzisiaj</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {views.map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${view === v ? 'bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}>{v}</button>)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Object.entries(typeLabels).map(([type, label]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all shadow-sm ${activeTypes.includes(type) ? 'text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}
              style={activeTypes.includes(type) ? { backgroundColor: typeFallbackColor[type] } : undefined}
            >
              {label}
            </button>
          ))}
          <button onClick={() => setActiveTypes(Object.keys(typeLabels))} className="rounded-xl bg-slate-800 dark:bg-slate-200 hover:bg-slate-900 dark:hover:bg-white transition-colors px-4 py-2 text-sm font-medium text-white dark:text-slate-900 shadow-sm">Wszystkie</button>
          <div className="ml-auto flex min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#02080a] px-3 py-2 shadow-sm focus-within:border-[#04e0ff] focus-within:ring-1 focus-within:ring-[#04e0ff] transition-all">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj..." className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-200" />
          </div>
        </div>
      </Card>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 p-4 text-sm font-medium text-red-700 dark:text-red-400">{error}</div>}
      
      {loading ? (
        <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-[#04e0ff] w-8 h-8" /></div>
      ) : view === 'lista' ? (
        <List items={filteredItems} />
      ) : (
        <div className="animate-fade-in-up">
          {view !== 'dzień' && <div className="mb-2 grid grid-cols-7 gap-2 px-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{['PON','WT','ŚR','CZW','PT','SOB','NDZ'].map((d) => <span key={d}>{d}</span>)}</div>}
          <div className="space-y-2">
            {weeks.map((week) => (
              <WeekStrip
                key={week[0].toISOString()}
                week={week}
                cursor={cursor}
                view={view}
                items={filteredItems.filter((i) => itemActiveOnRange(i, startOfDay(week[0] as Date), endOfDay(week[week.length - 1] as Date)))}
                onDayClick={handleDayClick}
                onBarEnter={handleBarEnter}
                onBarLeave={handleBarLeave}
              />
            ))}
          </div>
        </div>
      )}

      {/* LEGENDA POD KALENDARZEM */}
      <div className="grid gap-6 md:grid-cols-2 mt-6 animate-fade-in-up delay-75">
        <Card className="shadow-sm border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Info size={15} /> Typy wydarzeń (Kolory Pasków)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {dict.typy?.length > 0 ? dict.typy.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 rounded-full border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:bg-white dark:hover:bg-white/10">
                <span className="h-3 w-3 rounded-full shadow-sm border border-black/5 dark:border-black/20" style={{ backgroundColor: t.kolor || typeFallbackColor[t.nazwa] || '#0891B2' }} />
                {t.nazwa}
              </div>
            )) : <p className="text-xs text-slate-400 font-medium">Brak zdefiniowanych typów w ustawieniach.</p>}
          </div>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Info size={15} /> Statusy operacyjne (Ikony na paskach)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {dict.statusy?.length > 0 ? dict.statusy.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 rounded-full border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:bg-white dark:hover:bg-white/10">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-slate-800 shadow-sm text-sm" style={{ color: s.kolor || '#64748B' }}>
                  {s.ikona || '•'}
                </span>
                {s.nazwa}
              </div>
            )) : <p className="text-xs text-slate-400 font-medium">Brak zdefiniowanych statusów w ustawieniach.</p>}
          </div>
        </Card>
      </div>

      {showAdd && <QuickAddCalendarModal dict={dict} initialDate={selectedDate} onClose={() => { setShowAdd(false); setSelectedDate(undefined); }} onSaved={() => { setShowAdd(false); setSelectedDate(undefined); load(); }} />}

      {/* TOOLTIP WYDARZENIA */}
      {tooltip.show && tooltip.item && (
        <div
          className="fixed z-[100] w-[320px] -translate-x-1/2 -translate-y-full pb-3 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl">
            
            {/* Header: Ikona + Tytuł */}
            <div className="mb-3 border-b border-slate-100 dark:border-white/10 pb-3 flex items-start gap-2.5">
              <span 
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-white shadow-sm" 
                style={{ backgroundColor: tooltip.item.kolor || '#0891B2' }}
              >
                {tooltip.item.ikona || '•'}
              </span>
              <p className="min-w-0 flex-1 font-black text-slate-900 dark:text-white leading-tight">
                {tooltip.item.tytul}
              </p>
            </div>

            {/* Informacje czas/miejsce */}
            <div className="space-y-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
              <div className="flex items-start gap-2">
                <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <span>
                  {formatTooltipDate(tooltip.item.start)} 
                  {tooltip.item.koniec && tooltip.item.koniec !== tooltip.item.start && (
                    <> → <br className="block sm:hidden" />{formatTooltipDate(tooltip.item.koniec)}</>
                  )}
                </span>
              </div>

              {tooltip.item.miejsce && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{tooltip.item.miejsce}</span>
                </div>
              )}
            </div>

            {/* Statusy poboczne */}
            <div className="flex flex-wrap gap-1.5">
              {tooltip.item.status && (
                <span className="rounded-md bg-slate-100 dark:bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {tooltip.item.status}
                </span>
              )}
              {tooltip.item.statusMagazynowy && (
                <span className="rounded-md bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  {tooltip.item.ikonaMagazynowa || '📦'} {tooltip.item.statusMagazynowy}
                </span>
              )}
              {tooltip.item.statusKsiegowy && (
                <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {tooltip.item.ikonaKsiegowa || '💰'} {tooltip.item.statusKsiegowy}
                </span>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function WeekStrip({ week, cursor, view, items, onDayClick, onBarEnter, onBarLeave }: { week: Date[]; cursor: Date; view: View; items: CalendarItem[], onDayClick: (d: Date) => void, onBarEnter: (e: React.MouseEvent, item: CalendarItem) => void, onBarLeave: () => void }) {
  if (!week || week.length === 0) return null;
  const isDay = view === 'dzień';
  const weekStart = startOfDay(week[0] as Date); 
  const weekEnd = endOfDay(week[week.length - 1] as Date);
  const bars = buildBars(items, weekStart, weekEnd, isDay ? 1 : 7);
  const maxRow = Math.max(2, ...bars.map((b) => b.row + 1));
  const weekMinHeight = Math.max(CALENDAR_WEEK_MIN_HEIGHT, CALENDAR_BAR_TOP + maxRow * (CALENDAR_BAR_ROW_HEIGHT + CALENDAR_BAR_ROW_GAP) + 16);

  return (
    <div
      className={`relative grid ${isDay ? 'grid-cols-1' : 'grid-cols-7'} gap-x-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20`}
      style={{ minHeight: `${weekMinHeight}px` }}
    >
      {week.map((day) => {
        const today = sameDay(new Date(), day);
        const outsideMonth = view === 'miesiąc' && day.getMonth() !== cursor.getMonth();
        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={`group relative min-h-[172px] border-r border-slate-100 dark:border-white/5 p-2 transition-colors cursor-pointer ${
              today 
                ? 'bg-cyan-50/30 dark:bg-[#0891b2]/10' // Subtelne podświetlenie całego dzisiejszego dnia
                : outsideMonth 
                ? 'bg-slate-50/80 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/5' 
                : 'bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
            style={{ minHeight: `${weekMinHeight}px`, paddingTop: `${CALENDAR_BAR_TOP + maxRow * (CALENDAR_BAR_ROW_HEIGHT + CALENDAR_BAR_ROW_GAP)}px` }}
          >
            {/* --- RENDEROWANIE GÓRNEJ BELKI DLA AKTUALNEGO DNIA --- */}
            {today ? (
              <>
                {/* Niebieski pasek na górze */}
                <div className="absolute top-0 left-0 right-0 h-[48px] bg-gradient-to-r from-[#04e0ff] to-blue-600 z-0" style={{borderRadius: '8px 8px 0 0'}}/>
                
                {/* Skrócona nazwa dnia tygodnia (np. CZW.) */}
                <p className="absolute left-3 top-2.5 z-10 text-[12px] font-black uppercase tracking-widest text-white drop-shadow-sm">
                  {day.toLocaleDateString('pl-PL', { weekday: 'short' })}
                </p>
                
                {/* Wystające kółko z numerem dnia */}
                <div className="absolute left-1/2 top-[24px] z-10 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border-[2px] border-white bg-gradient-to-r from-[#04e0ff] to-blue-600 text-[24px] font-semibold text-white shadow-[0_5px_15px_rgba(8,145,178,0.4)] dark:border-[#08151a]">
                  {day.getDate()}
                </div>
              </>
            ) : (
              /* --- STANDARDOWY WYGLĄD DLA POZOSTAŁYCH DNI --- */
              <div className="absolute left-3 top-3 pointer-events-none">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {day.toLocaleDateString('pl-PL', { weekday: 'short' })}
                </p>
                <p className="leading-none mt-1 text-3xl font-medium text-slate-400 group-hover:text-[#04e0ff] transition-all">
                  {day.getDate()}
                </p>
              </div>
            )}

            {/* Ikona dodawania (+), przesunięta niżej dla dzisiejszego dnia, aby nie nakładać się na niebieski pasek */}
            <div className={`absolute right-2 ${today ? 'top-14' : 'top-2'} z-10 opacity-0 transition-all duration-300 group-hover:opacity-100 text-[#04e0ff] bg-cyan-50 dark:bg-cyan-500/10 rounded-md p-1 shadow-sm`}>
              <CalendarPlus size={14} />
            </div>
          </div>
        );
      })}

      <div
        className={`pointer-events-none absolute left-0 right-0 grid ${isDay ? 'grid-cols-1' : 'grid-cols-7'} px-2`}
        style={{ top: `${CALENDAR_BAR_TOP}px`, gridTemplateRows: `repeat(${maxRow}, ${CALENDAR_BAR_ROW_HEIGHT}px)`, rowGap: `${CALENDAR_BAR_ROW_GAP}px` }}
      >
        {bars.map((bar) => (
          <CalendarBar key={bar.key} bar={bar} onMouseEnter={onBarEnter} onMouseLeave={onBarLeave} />
        ))}
      </div>
    </div>
  );
}

function buildBars(items: CalendarItem[], weekStart: Date, weekEnd: Date, columns: number) {
  const today = startOfDay(new Date());
  
  // Rzędy są śledzone jako lista zarezerwowanych "endCol" w danym rzędzie.
  // By zapobiec skakaniu pasków 1 eventu w różne wiersze na 1 widoku, musimy śledzić je po "item.id".
  const rows: number[] = []; 
  const out: any[] = [];
  
  // Mapa przydziałów wiersza dla danego ID eventu w tym renderingu widoku
  const itemRowAssignments = new Map<string, number>();

  const segments = items.flatMap((item) => {
    const start = startOfDay(new Date(item.start));
    const end = startOfDay(new Date(item.koniec || item.start));
    const clippedStart = start < weekStart ? weekStart : start;
    const clippedEnd = end > startOfDay(weekEnd) ? startOfDay(weekEnd) : end;
    if (clippedEnd < weekStart || clippedStart > weekEnd) return [];

    const baseColor = item.kolor || typeFallbackColor[item.typ] || '#0891B2';
    const parts: any[] = [];

    if (end < today) {
      parts.push({
        item,
        start: clippedStart,
        end: clippedEnd,
        color: pastelColor(baseColor),
        past: true,
      });
    }
    else if (start < today && end >= today) {
      const pastEnd = addDays(today, -1);

      if (pastEnd >= clippedStart) {
        parts.push({
          item,
          start: clippedStart,
          end: pastEnd < clippedEnd ? pastEnd : clippedEnd,
          color: pastelColor(baseColor),
          past: true,
        });
      }

      if (clippedEnd >= today) {
        parts.push({
          item,
          start: today > clippedStart ? today : clippedStart,
          end: clippedEnd,
          color: baseColor,
          past: false,
        });
      }
    }
    else {
      parts.push({
        item,
        start: clippedStart,
        end: clippedEnd,
        color: baseColor,
        past: false,
      });
    }
    return parts;
  }).sort((a, b) => {
    // Główne sortowanie, które upewnia się, że te najwcześniejsze lub najdłuższe paski alokują wiersze pierwsze.
    const d = dayDiff(a.item.start ? new Date(a.item.start) : a.start, weekStart) - dayDiff(b.item.start ? new Date(b.item.start) : b.start, weekStart);
    if (d !== 0) return d;
    return dayDiff(b.item.koniec ? new Date(b.item.koniec) : b.end, b.item.start ? new Date(b.item.start) : b.start) - dayDiff(a.item.koniec ? new Date(a.item.koniec) : a.end, a.item.start ? new Date(a.item.start) : a.start);
  });

  for (const seg of segments) {
    const startCol = Math.max(0, Math.min(columns - 1, dayDiff(seg.start, weekStart)));
    const endCol = Math.max(startCol, Math.min(columns - 1, dayDiff(seg.end, weekStart)));
    
    // Używamy globalnego ID eventu, aby jeśli segment jest częścią tego samego wydarzenia (np. pół przeszłe/pół dzisiejsze), trzymał wiersz.
    let row = itemRowAssignments.get(seg.item.id);
    
    if (row === undefined) {
       row = rows.findIndex((lastEndCol) => lastEndCol < startCol);
       if (row === -1) { 
          row = rows.length; 
       }
       itemRowAssignments.set(seg.item.id, row);
    }
    
    rows[row] = Math.max(rows[row] || 0, endCol);

    out.push({
      key: `${seg.item.id}-${iso(seg.start)}-${iso(seg.end)}-${seg.past ? 'past' : 'now'}`,
      item: seg.item,
      startCol,
      endCol,
      row,
      color: seg.color,
      isWeekStart: sameDay(seg.start, weekStart) || sameDay(seg.start, startOfDay(new Date(seg.item.start))),
      isWeekEnd: sameDay(seg.end, startOfDay(weekEnd)) || sameDay(seg.end, startOfDay(new Date(seg.item.koniec || seg.item.start))),
    });
  }
  return out;
}

function CalendarBar({ bar, onMouseEnter, onMouseLeave }: { bar: any, onMouseEnter: (e: React.MouseEvent, item: CalendarItem) => void, onMouseLeave: () => void }) {
  const radius = bar.isWeekStart && bar.isWeekEnd ? 'rounded-md' : bar.isWeekStart ? 'rounded-l-md rounded-r-none' : bar.isWeekEnd ? 'rounded-r-md rounded-l-none' : 'rounded-sm';
  return (
    <Link
      href={itemUrl(bar.item)}
      onMouseEnter={(e) => onMouseEnter(e, bar.item)}
      onMouseLeave={onMouseLeave}
      className={`pointer-events-auto block truncate px-2.5 py-[2px] text-[13px] font-medium leading-[20px] text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md ${radius}`}
      style={{
        gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
        gridRow: `${bar.row + 1}`,
        backgroundColor: bar.color,
        textShadow: '0 1px 2px rgba(15,23,42,.35)',
      }}
    >
      <span className="mr-1.5 align-middle text-[12px] opacity-90 drop-shadow-sm">{bar.item.ikona || '•'}</span>
      {bar.item.ikonaMagazynowa && <span className="mr-1.5 align-middle text-[12px] opacity-90 drop-shadow-sm">{bar.item.ikonaMagazynowa}</span>}
      {bar.item.ikonaKsiegowa && <span className="mr-1.5 align-middle text-[12px] opacity-90 drop-shadow-sm">{bar.item.ikonaKsiegowa}</span>}
      <span className="drop-shadow-sm">{bar.item.tytul}</span>
    </Link>
  );
}

function List({ items }: { items: CalendarItem[] }) {
  return <Card className="border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-slate-900"><div className="space-y-3">{items.map((i) => <Link href={itemUrl(i)} key={`${i.typ}-${i.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-white/5 p-4 transition-all hover:border-cyan-200 dark:hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:hover:bg-white/5 hover:shadow-sm"><div><p className="font-semibold text-slate-800 dark:text-white"><span className="mr-2 opacity-80">{i.ikona || '•'}</span>{i.tytul}</p><p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{typeLabels[i.typ] || i.typ} • {i.status}{i.statusMagazynowy ? ` • ${i.ikonaMagazynowa || '📦'} ${i.statusMagazynowy}` : ''}{i.statusKsiegowy ? ` • ${i.ikonaKsiegowa || '💰'} ${i.statusKsiegowy}` : ''}</p></div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{i.start ? new Date(i.start).toLocaleString('pl-PL') : '-'}</p></Link>)}{items.length === 0 && <p className="p-8 text-center font-medium text-slate-400">Brak wpisów w wybranym zakresie.</p>}</div></Card>;
}

// ==========================================
// Bezpieczny Wrapper (Wymagany przez Next.js)
// ==========================================
export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#04e0ff]" /></div>}>
      <CalendarContent />
    </Suspense>
  );
}