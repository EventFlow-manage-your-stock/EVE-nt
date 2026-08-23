'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Search, Info } from 'lucide-react';
import Link from 'next/link';
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
  serwis: 'Serwis',
  flota: 'Flota',
};

const typeFallbackColor: Record<string, string> = {
  wydarzenie: '#0891B2',
  wypozyczenie: '#F97316',
  urlop: '#22C55E',
  serwis: '#DC2626',
  flota: '#2563EB',
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
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function normalizeType(t: string) { return t === 'wynajem' ? 'wypozyczenie' : t; }
function itemUrl(item: CalendarItem) {
  const typ = normalizeType(item.typ);
  if (typ === 'wydarzenie') return `/dashboard/events/${item.sourceId}`;
  if (typ === 'wypozyczenie') return `/dashboard/rentals/${item.sourceId}`;
  if (typ === 'urlop') return `/dashboard/leaves/${item.sourceId}`;
  if (typ === 'serwis') return `/dashboard/service`;
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

export default function CalendarPage() {
  const [view, setView] = useState<View>('miesiąc');
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<string[]>(['wydarzenie', 'wypozyczenie', 'urlop', 'flota']);
  const [dict, setDict] = useState<any>({ typy: [], statusy: [], kontrahenci: [], miejsca: [], uzytkownicy: [] });

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
      setItems((cal.data.items || cal.data || []).map((i: any) => ({ ...i, typ: normalizeType(i.typ) })));
      setDict({ typy: typy.data || [], statusy: statusy.data || [], kontrahenci: kontrahenci.data || [], miejsca: miejsca.data || [], uzytkownicy: uzytkownicy.data || [] });
    } catch (e: any) {
      setItems([]);
      setError(e?.response?.data?.message || e?.message || 'Nie udało się pobrać kalendarza. Sprawdź API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [view, cursor.getFullYear(), cursor.getMonth(), cursor.getDate()]);

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
    // Usprawnienie zmiany dat: uwzględnia również poprawny skok dla "lista"
    if (view === 'miesiąc' || view === 'lista') d.setMonth(d.getMonth() + mult);
    else d.setDate(d.getDate() + (view === 'tydzień' ? 7 * mult : mult));
    setCursor(d);
  }

  function toggleType(type: string) {
    setActiveTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }

  const title = cursor.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', day: view === 'dzień' ? 'numeric' : undefined });

  return (
    <div className="mx-auto max-w-[1800px] space-y-4">
      <PageTitle
        eyebrow="Kalendarz"
        title="Kalendarz operacyjny"
        description="Wydarzenia wielodniowe łączą się w paski tygodniowe. Kolor wydarzenia pochodzi z typu wydarzenia. Status jest tylko ikoną przed nazwą."
        action={<Button onClick={() => setShowAdd(true)}><CalendarPlus size={16} className="inline mr-1" /> Dodaj</Button>}
      />

      <Card className="!p-4 border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="rounded-xl border p-2 hover:bg-slate-50 transition-colors"><ChevronLeft size={18} /></button>
            <p className="min-w-[240px] text-center text-2xl font-medium uppercase tracking-tight text-slate-800">{title}</p>
            <button onClick={() => move(1)} className="rounded-xl border p-2 hover:bg-slate-50 transition-colors"><ChevronRight size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {views.map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${view === v ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{v}</button>)}
            <Button variant="secondary" onClick={() => setCursor(new Date())}>Dzisiaj</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Object.entries(typeLabels).map(([type, label]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all shadow-sm ${activeTypes.includes(type) ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              style={activeTypes.includes(type) ? { backgroundColor: typeFallbackColor[type] } : undefined}
            >
              {label}
            </button>
          ))}
          <button onClick={() => setActiveTypes(Object.keys(typeLabels))} className="rounded-xl bg-slate-800 hover:bg-slate-900 transition-colors px-4 py-2 text-sm font-medium text-white shadow-sm">Wszystkie</button>
          <div className="ml-auto flex min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj..." className="w-full bg-transparent text-sm font-medium outline-none text-slate-700" />
          </div>
        </div>
      </Card>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      
      {loading ? (
        <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8" /></div>
      ) : view === 'lista' ? (
        <List items={filteredItems} />
      ) : (
        <div className="animate-fade-in-up">
          {view !== 'dzień' && <div className="mb-2 grid grid-cols-7 gap-2 px-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">{['PON','WT','ŚR','CZW','PT','SOB','NDZ'].map((d) => <span key={d}>{d}</span>)}</div>}
          <div className="space-y-2">
            {weeks.map((week) => (
              <WeekStrip
                key={week[0].toISOString()}
                week={week}
                cursor={cursor}
                view={view}
                items={filteredItems.filter((i) => itemActiveOnRange(i, startOfDay(week[0] as Date), endOfDay(week[week.length - 1] as Date)))}
              />
            ))}
          </div>
        </div>
      )}

      {/* LEGENDA POD KALENDARZEM */}
      <div className="grid gap-6 md:grid-cols-2 mt-6 animate-fade-in-up delay-75">
        <Card className="shadow-sm border-slate-200 bg-white">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Info size={15} /> Typy wydarzeń (Kolory Pasków)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {dict.typy?.length > 0 ? dict.typy.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-white">
                <span className="h-3 w-3 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: t.kolor || typeFallbackColor[t.nazwa] || '#0891B2' }} />
                {t.nazwa}
              </div>
            )) : <p className="text-xs text-slate-400 font-medium">Brak zdefiniowanych typów w ustawieniach.</p>}
          </div>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-white">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Info size={15} /> Statusy operacyjne (Ikony na paskach)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {dict.statusy?.length > 0 ? dict.statusy.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-white">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white shadow-sm text-sm" style={{ color: s.kolor || '#64748B' }}>
                  {s.ikona || '•'}
                </span>
                {s.nazwa}
              </div>
            )) : <p className="text-xs text-slate-400 font-medium">Brak zdefiniowanych statusów w ustawieniach.</p>}
          </div>
        </Card>
      </div>

      {showAdd && <QuickAddCalendarModal dict={dict} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function WeekStrip({ week, cursor, view, items }: { week: Date[]; cursor: Date; view: View; items: CalendarItem[] }) {
  if (!week || week.length === 0) return null; // Zabezpieczenie typu przed błędem TS(2345)
  const isDay = view === 'dzień';
  const weekStart = startOfDay(week[0] as Date); 
  const weekEnd = endOfDay(week[week.length - 1] as Date);
  const bars = buildBars(items, weekStart, weekEnd, isDay ? 1 : 7);
  const maxRow = Math.max(2, ...bars.map((b) => b.row + 1));
  const weekMinHeight = Math.max(CALENDAR_WEEK_MIN_HEIGHT, CALENDAR_BAR_TOP + maxRow * (CALENDAR_BAR_ROW_HEIGHT + CALENDAR_BAR_ROW_GAP) + 16);

  return (
    <div
      className={`relative grid ${isDay ? 'grid-cols-1' : 'grid-cols-7'} gap-x-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300`}
      style={{ minHeight: `${weekMinHeight}px` }}
    >
      {week.map((day) => {
        const today = sameDay(new Date(), day);
        const outsideMonth = view === 'miesiąc' && day.getMonth() !== cursor.getMonth();
        return (
          <div
            key={day.toISOString()}
            className={`relative min-h-[172px] border-r border-slate-100 p-2 transition-colors ${today ? 'bg-cyan-50/40 ring-1 ring-inset ring-cyan-200' : outsideMonth ? 'bg-slate-50/80' : 'bg-white'}`}
            style={{ minHeight: `${weekMinHeight}px`, paddingTop: `${CALENDAR_BAR_TOP + maxRow * (CALENDAR_BAR_ROW_HEIGHT + CALENDAR_BAR_ROW_GAP)}px` }}
          >
            <div className="absolute left-3 top-3">
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${today ? 'text-cyan-700' : 'text-slate-400'}`}>{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</p>
              <p className={`leading-none mt-1 transition-all ${today ? 'inline-flex items-center justify-center min-w-[32px] h-8 rounded-xl bg-cyan-600 text-xl font-medium text-white shadow-md px-2' : 'text-3xl font-medium text-slate-400'}`}>{day.getDate()}</p>
            </div>
          </div>
        );
      })}

      <div
        className={`pointer-events-none absolute left-0 right-0 grid ${isDay ? 'grid-cols-1' : 'grid-cols-7'} px-2`}
        style={{ top: `${CALENDAR_BAR_TOP}px`, gridTemplateRows: `repeat(${maxRow}, ${CALENDAR_BAR_ROW_HEIGHT}px)`, rowGap: `${CALENDAR_BAR_ROW_GAP}px` }}
      >
        {bars.map((bar) => (
          <CalendarBar key={bar.key} bar={bar} />
        ))}
      </div>
    </div>
  );
}

function buildBars(items: CalendarItem[], weekStart: Date, weekEnd: Date, columns: number) {
  const today = startOfDay(new Date());
  const rows: number[] = [];
  const out: any[] = [];

  const segments = items.flatMap((item) => {
    const start = startOfDay(new Date(item.start));
    const end = startOfDay(new Date(item.koniec || item.start));
    const clippedStart = start < weekStart ? weekStart : start;
    const clippedEnd = end > startOfDay(weekEnd) ? startOfDay(weekEnd) : end;
    if (clippedEnd < weekStart || clippedStart > weekEnd) return [];

    const baseColor = item.kolor || typeFallbackColor[item.typ] || '#0891B2';
    const containsToday = start <= today && end >= today;
    const parts: any[] = [];

    if (containsToday && clippedStart < today) {
      const pastEnd = addDays(today, -1);
      if (pastEnd >= clippedStart) parts.push({ item, start: clippedStart, end: pastEnd, color: pastelColor(baseColor), past: true });
      if (clippedEnd >= today) parts.push({ item, start: today > clippedStart ? today : clippedStart, end: clippedEnd, color: baseColor, past: false });
    } else {
      parts.push({ item, start: clippedStart, end: clippedEnd, color: baseColor, past: false });
    }
    return parts;
  }).sort((a, b) => {
    const d = dayDiff(a.start, weekStart) - dayDiff(b.start, weekStart);
    if (d !== 0) return d;
    return dayDiff(b.end, b.start) - dayDiff(a.end, a.start);
  });

  for (const seg of segments) {
    const startCol = Math.max(0, Math.min(columns - 1, dayDiff(seg.start, weekStart)));
    const endCol = Math.max(startCol, Math.min(columns - 1, dayDiff(seg.end, weekStart)));
    let row = rows.findIndex((lastEnd) => lastEnd < startCol);
    if (row === -1) { row = rows.length; rows.push(endCol); }
    else rows[row] = endCol;
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

function CalendarBar({ bar }: { bar: any }) {
  const radius = bar.isWeekStart && bar.isWeekEnd ? 'rounded-md' : bar.isWeekStart ? 'rounded-l-md rounded-r-none' : bar.isWeekEnd ? 'rounded-r-md rounded-l-none' : 'rounded-sm';
  return (
    <Link
      href={itemUrl(bar.item)}
      title={`${bar.item.status || ''} | ${bar.item.tytul || ''}`}
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
  return <Card className="border-slate-200 shadow-sm"><div className="space-y-3">{items.map((i) => <Link href={itemUrl(i)} key={`${i.typ}-${i.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 transition-all hover:border-cyan-200 hover:bg-cyan-50/50 hover:shadow-sm"><div><p className="font-semibold text-slate-800"><span className="mr-2 opacity-80">{i.ikona || '•'}</span>{i.tytul}</p><p className="mt-1 text-sm font-medium text-slate-500">{typeLabels[i.typ] || i.typ} • {i.status}{i.statusMagazynowy ? ` • ${i.ikonaMagazynowa || '📦'} ${i.statusMagazynowy}` : ''}{i.statusKsiegowy ? ` • ${i.ikonaKsiegowa || '💰'} ${i.statusKsiegowy}` : ''}</p></div><p className="text-sm font-medium text-slate-500">{i.start ? new Date(i.start).toLocaleString('pl-PL') : '-'}</p></Link>)}{items.length === 0 && <p className="p-8 text-center font-medium text-slate-400">Brak wpisów w wybranym zakresie.</p>}</div></Card>;
}