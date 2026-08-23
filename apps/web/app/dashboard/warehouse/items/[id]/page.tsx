'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Save,
  Tag,
  Trash2,
  User,
  Wrench,
  QrCode // 1. DODANY IMPORT
} from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../../components/ProductUI';
import { PrintLabelsModal } from '../../../../../components/PrintLabelsModal'; // 2. DODANY IMPORT MODALA

// ============================================================================
// KOMPONENT: MINI KALENDARZ ZAJĘTOŚCI
// ============================================================================

function MiniCalendar({ events }: { events: { start: string | Date; end: string | Date; type: string; label: string }[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 0 = Niedziela, u nas 0 = Poniedziałek

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    d.setHours(12, 0, 0, 0); // Bezpieczeństwo stref czasowych

    const dayEvents = events.filter((e) => {
      if (!e.start) return false;
      const s = new Date(e.start);
      s.setHours(0, 0, 0, 0);
      const en = e.end ? new Date(e.end) : new Date(s);
      en.setHours(23, 59, 59, 999);
      return d >= s && d <= en;
    });

    return { day: i + 1, events: dayEvents, date: d };
  });

  const monthName = currentDate.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <span className="text-sm font-black capitalize text-slate-800">{monthName}</span>
        <button type="button" onClick={nextMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
        <div>Pn</div><div>Wt</div><div>Śr</div><div>Cz</div><div>Pt</div><div>Sb</div><div>Nd</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} className="p-2" />)}
        {days.map((d) => {
          const isToday = new Date().toDateString() === d.date.toDateString();
          const isService = d.events.some((e) => e.type === 'serwis');
          const isRental = d.events.some((e) => e.type === 'wynajem');

          let bgClass = 'bg-slate-50 text-slate-600 hover:bg-slate-100';
          let title = '';

          if (isService) {
            bgClass = 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200';
            title = d.events.filter((e) => e.type === 'serwis').map((e) => e.label).join(', ');
          } else if (isRental) {
            bgClass = 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200';
            title = d.events.filter((e) => e.type === 'wynajem').map((e) => e.label).join(', ');
          } else if (isToday) {
            bgClass = 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200';
          }

          return (
            <div key={d.day} className={`cursor-default rounded-lg p-2 transition-colors ${bgClass}`} title={title || undefined}>
              {d.day}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-orange-100 ring-1 ring-orange-200"></span> Zajęty (Wydarzenie / Wynajem)</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-red-100 ring-1 ring-red-200"></span> W serwisie</div>
      </div>
    </div>
  );
}

// ============================================================================
// WIDOKI ZAKŁADEK (Apple-style / SmartFlow)
// ============================================================================

const renderEventHistory = (record: any) => {
  const eventMap = new Map();
  (record?.pozycje_wydan || []).forEach((p: any) => {
    const ev = p.wydanie?.wydarzenie;
    if (ev && !eventMap.has(ev.id)) {
      eventMap.set(ev.id, ev);
    }
  });
  
  const events = Array.from(eventMap.values()).sort((a: any, b: any) => 
    new Date(b.data_start).getTime() - new Date(a.data_start).getTime()
  );

  if (events.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
          <CalendarDays size={28} />
        </div>
        <p className="text-sm font-black text-slate-500">Ten egzemplarz nie brał jeszcze udziału w żadnym wydarzeniu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((e: any) => (
        <Link key={e.id} href={`/dashboard/events/${e.id}`} className="group block">
          <div className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:border-cyan-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] md:flex-row md:items-center">
            <div className="flex-shrink-0 rounded-2xl bg-slate-50 p-3 text-center transition-colors group-hover:bg-cyan-50 md:w-28">
              <p className="text-[10px] font-black uppercase text-slate-400">Data Startu</p>
              <p className="text-lg font-black text-slate-800">{new Date(e.data_start).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-black text-slate-900 transition-colors group-hover:text-cyan-700">
                {e.nazwa}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: e.typ?.kolor || '#06B6D4' }} />
                  {e.typ?.nazwa || 'Wydarzenie'}
                </span>
                <span className=" border-l border-slate-200 pl-3 text-xs font-bold text-slate-400">
                  Klient: <span className="text-slate-700">{e.kontrahent?.nazwa || 'Brak'}</span>
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
               <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                 {e.status?.ikona || '●'} {e.status?.nazwa || 'Status'}
               </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

const renderServiceHistory = (record: any) => {
  const services = record?.serwisy || [];

  if (services.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-400">
          <CheckCircle2 size={28} />
        </div>
        <p className="text-sm font-black text-slate-500">Bezawaryjny sprzęt! Brak zgłoszeń serwisowych w historii.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-slate-200 before:to-transparent md:before:mx-auto md:before:translate-x-0">
      {services.map((s: any) => {
        const isResolved = !!s.data_rozwiazania;
        
        return (
          <div key={s.id} className="is-active group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
            {/* Timeline dot */}
            <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow-sm md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2" style={{ backgroundColor: s.status?.kolor ? `${s.status.kolor}20` : '#f1f5f9', color: s.status?.kolor || '#64748b' }}>
              {isResolved ? <Wrench size={16} /> : <AlertTriangle size={16} />}
            </div>
            
            <div className="w-[calc(100%-4rem)] rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] md:w-[calc(50%-2.5rem)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: s.status?.kolor || '#cbd5e1', color: '#fff' }}>
                  {s.status?.nazwa || 'Serwis'}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                  <Clock size={12}/> {new Date(s.data_zgloszenia).toLocaleDateString('pl-PL')}
                </span>
              </div>
              
              <h4 className="mb-2 text-base font-black text-slate-900">{s.tytul}</h4>
              
              {s.opis && (
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-600">
                  <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Opis usterki</span>
                  {s.opis}
                </div>
              )}
              
              {s.rozwiazanie && (
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                  <span className="mb-1 block text-[10px] font-black uppercase text-emerald-600">Rozwiązanie / Naprawa</span>
                  {s.rozwiazanie}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <User size={14} className="text-slate-300"/> Zgłosił: {s.zglosil?.imie} {s.zglosil?.nazwisko}
                </span>
                {isResolved && (
                  <span className="text-emerald-600">
                    Rozw. {new Date(s.data_rozwiazania).toLocaleDateString('pl-PL')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// GŁÓWNY KOMPONENT KARTY EGZEMPLARZA
// ============================================================================

export default function ItemEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<'szczegoly' | 'historia_wydarzen' | 'historia_serwisowa'>('szczegoly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // 3. NOWY STAN DO OBSŁUGI WYŚWIETLANIA MODALA Z ETYKIETAMI
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [record, setRecord] = useState<any>(null);
  const [model, setModel] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  
  const [dict, setDict] = useState<any>({ magazyny: [], cases: [] });
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Pobierz rekord egzemplarza
      const res = await api.get(`/api/magazyn/egzemplarze/${id}`);
      const rec = res.data;
      setRecord(rec);

      // Zasilamy formularz domyślnymi wartościami (uwzględniając ewentualne null na pusty string)
      setForm({
        nazwa: rec.nazwa || '',
        numer_egzemplarza: rec.numer_egzemplarza || '',
        numer_urzadzenia: rec.numer_urzadzenia || '',
        sn: rec.sn || '',
        data_produkcji: rec.data_produkcji ? String(rec.data_produkcji).slice(0, 10) : '',
        kod_kreskowy: rec.kod_kreskowy || '',
        zewnetrzny_kod_kreskowy: rec.zewnetrzny_kod_kreskowy || '',
        zewnetrzny_qr_kod: rec.zewnetrzny_qr_kod || '',
        rozroznij_kod_qr: !!rec.rozroznij_kod_qr,
        status_serwisowy: rec.status_serwisowy || '',
        id_magazynu: rec.id_magazynu ? String(rec.id_magazynu) : '',
        id_case: rec.id_case ? String(rec.id_case) : '',
        miejsce_w_mag: rec.miejsce_w_mag || '',
        wartosc: rec.wartosc || '',
        cena_zakupu: rec.cena_zakupu || '',
        opis: rec.opis || '',
      });

      // 2. Równoległe pobranie słowników, modelu (dla zdjęcia i linków) oraz zajętości w kalendarzu
      const [mRes, magRes, casesRes, zajRes] = await Promise.all([
        api.get(`/api/magazyn/modele/${rec.id_modelu}`).catch(() => ({ data: null })),
        api.get('/api/magazyn/slowniki/magazyny').catch(() => ({ data: [] })),
        api.get('/api/magazyn/slowniki/cases').catch(() => ({ data: [] })),
        api.get(`/api/magazyn/modele/${rec.id_modelu}/zajetosc`).catch(() => ({ data: [] })),
      ]);

      setModel(mRes.data);
      setDict({ magazyny: magRes.data, cases: casesRes.data });

      // Budowanie wydarzeń kalendarza na podstawie wynajmów/wydarzeń (zajetosc modelu filtrowana po tym konkretnym egzemplarzu) i serwisów
      const allReservations = zajRes.data || [];
      const itemReservations = allReservations.filter((z: any) => 
        z.egzemplarz === rec.nazwa || z.egzemplarz === rec.sn || z.egzemplarz === rec.numer_urzadzenia
      );

      const mappedEvents = [
        ...itemReservations.map((r: any) => ({
          start: r.start,
          end: r.koniec,
          type: 'wynajem',
          label: r.tytul
        })),
        ...(rec.serwisy || []).map((s: any) => ({
          start: s.data_zgloszenia,
          end: s.data_rozwiazania || new Date(),
          type: 'serwis',
          label: s.tytul
        }))
      ];
      setCalendarEvents(mappedEvents);

    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się wczytać danych egzemplarza.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    
    const payload = {
      ...form,
      id_magazynu: form.id_magazynu ? Number(form.id_magazynu) : null,
      id_case: form.id_case ? Number(form.id_case) : null,
      wartosc: form.wartosc ? Number(form.wartosc) : null,
      cena_zakupu: form.cena_zakupu ? Number(form.cena_zakupu) : null,
      rozroznij_kod_qr: !!form.rozroznij_kod_qr
    };

    try {
      await api.put(`/api/magazyn/egzemplarze/${id}`, payload);
      await loadData(); // Przeładuj zaktualizowane dane
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Na pewno usunąć ten egzemplarz?')) return;
    try {
      await api.delete(`/api/magazyn/egzemplarze/${id}`);
      router.push('/dashboard/warehouse/items');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Wystąpił błąd podczas usuwania.');
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-cyan-600" /> 
        <span className="ml-3 font-bold text-slate-500">Ładowanie danych egzemplarza...</span>
      </div>
    );
  }

  const displayName = record?.nazwa || record?.model?.nazwa || `Egzemplarz #${record?.id}`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle 
        eyebrow="Egzemplarz sprzętu" 
        title={displayName} 
        description={`S/N: ${record?.sn || 'Brak'} | KOD: ${record?.kod_kreskowy || 'Brak'}`}
        action={
          <div className="flex gap-2">
            {/* 4. DODANY PRZYCISK ETYKIETY */}
            <Button variant="secondary" onClick={() => setShowPrintModal(true)}>
              <QrCode size={16} className="inline mr-1" /> Etykieta
            </Button>
            
            <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button>
            <Button variant="danger" onClick={remove}><Trash2 size={16} className="inline" /> Usuń</Button>
            <Button onClick={save} disabled={saving}><Save size={16} className="inline" /> {saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
          </div>
        }
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        {/* LEWA KOLUMNA - DANE GŁÓWNE */}
        <div className="space-y-6">
          <Card className="!p-0">
            <div className="flex overflow-x-auto border-b border-slate-100">
              <button onClick={() => setActiveTab('szczegoly')} className={`flex min-w-[150px] items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-black transition ${activeTab === 'szczegoly' ? 'border-cyan-600 bg-cyan-50/70 text-cyan-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><FileText size={16}/> Dane sprzętu</button>
              <button onClick={() => setActiveTab('historia_wydarzen')} className={`flex min-w-[180px] items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-black transition ${activeTab === 'historia_wydarzen' ? 'border-cyan-600 bg-cyan-50/70 text-cyan-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><CalendarDays size={16}/> Historia wydarzeń</button>
              <button onClick={() => setActiveTab('historia_serwisowa')} className={`flex min-w-[180px] items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-black transition ${activeTab === 'historia_serwisowa' ? 'border-cyan-600 bg-cyan-50/70 text-cyan-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><Wrench size={16}/> Historia serwisowa</button>
            </div>
            
            <div className="p-6">
              {activeTab === 'szczegoly' && (
                <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                  <Field label="Nazwa egzemplarza"><input className={inputClass} value={form.nazwa} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} /></Field>
                  <Field label="Numer egzemplarza"><input className={inputClass} value={form.numer_egzemplarza} onChange={(e) => setForm({ ...form, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })} /></Field>
                  <Field label="S/N"><input className={inputClass} value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value })} /></Field>
                  <Field label="Data produkcji"><input type="date" className={inputClass} value={form.data_produkcji} onChange={(e) => setForm({ ...form, data_produkcji: e.target.value })} /></Field>
                  <Field label="Kod kreskowy"><input className={inputClass} value={form.kod_kreskowy} onChange={(e) => setForm({ ...form, kod_kreskowy: e.target.value, zewnetrzny_kod_kreskowy: e.target.value, zewnetrzny_qr_kod: form.rozroznij_kod_qr ? form.zewnetrzny_qr_kod : e.target.value })} /></Field>
                  <Field label="Zewn. kod kreskowy (opcjonalny)"><input className={inputClass} value={form.zewnetrzny_kod_kreskowy} onChange={(e) => setForm({ ...form, zewnetrzny_kod_kreskowy: e.target.value })} /></Field>
                  
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={form.rozroznij_kod_qr} onChange={(e) => setForm({ ...form, rozroznij_kod_qr: e.target.checked })} />
                      Rozróżnij zewnętrzny kod kreskowy i QR
                    </label>
                  </div>
                  
                  {form.rozroznij_kod_qr && (
                    <div className="md:col-span-2">
                      <Field label="Zewn. QR kod"><input className={inputClass} value={form.zewnetrzny_qr_kod} onChange={(e) => setForm({ ...form, zewnetrzny_qr_kod: e.target.value })} /></Field>
                    </div>
                  )}

                  <Field label="Status serwisowy">
                    <select className={inputClass} value={form.status_serwisowy} onChange={(e) => setForm({ ...form, status_serwisowy: e.target.value })}>
                      <option value="Działa">Działa</option>
                      <option value="Wymaga serwisu (działa)">Wymaga serwisu (działa)</option>
                      <option value="Wymaga serwisu (nie działa)">Wymaga serwisu (nie działa)</option>
                      <option value="W serwisie">W serwisie</option>
                      <option value="Naprawiony">Naprawiony</option>
                    </select>
                  </Field>
                  <Field label="Wartość"><input type="number" step="0.01" className={inputClass} value={form.wartosc} onChange={(e) => setForm({ ...form, wartosc: e.target.value })} /></Field>
                  <Field label="Magazyn">
                    <select className={inputClass} value={form.id_magazynu} onChange={(e) => setForm({ ...form, id_magazynu: e.target.value })}>
                      <option value="">Brak / Wybierz</option>
                      {dict.magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                    </select>
                  </Field>
                  <Field label="Miejsce w magazynie"><input className={inputClass} value={form.miejsce_w_mag} onChange={(e) => setForm({ ...form, miejsce_w_mag: e.target.value })} /></Field>
                  
                  <div className="md:col-span-2">
                    <Field label="Case / Opakowanie (Zestaw)">
                      <select className={inputClass} value={form.id_case} onChange={(e) => setForm({ ...form, id_case: e.target.value })}>
                        <option value="">Brak (Luzem)</option>
                        {dict.cases.map((c: any) => <option key={c.id} value={c.id}>{c.model?.nazwa || ''} {c.nazwa || c.numer_urzadzenia || `#${c.id}`}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Cena zakupu"><input type="number" step="0.01" className={inputClass} value={form.cena_zakupu} onChange={(e) => setForm({ ...form, cena_zakupu: e.target.value })} /></Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Uwagi / Notatki"><textarea className={`${inputClass} min-h-24`} value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} /></Field>
                  </div>
                </form>
              )}
              {activeTab === 'historia_wydarzen' && renderEventHistory(record)}
              {activeTab === 'historia_serwisowa' && renderServiceHistory(record)}
            </div>
          </Card>
        </div>

        {/* PRAWA KOLUMNA - SIDEBAR */}
        <div className="space-y-6">
          <Card className="!p-0 overflow-hidden">
            {model?.zdjecie ? (
               <img src={model.zdjecie} alt={model.nazwa} className="w-full aspect-video object-cover bg-slate-100" />
            ) : (
               <div className="w-full aspect-video bg-slate-50 flex items-center justify-center text-slate-300 border-b border-slate-100">
                 <ImageIcon size={48} />
               </div>
            )}
            <div className="p-5 space-y-3">
               <Link href={`/dashboard/warehouse/models/${record.id_modelu}`} className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition group">
                  <div className="bg-cyan-50 text-cyan-600 p-2.5 rounded-xl group-hover:bg-cyan-100 transition"><Box size={18} /></div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-black uppercase text-slate-400">Model główny</p>
                     <p className="text-sm font-black text-slate-900 truncate group-hover:text-cyan-700 transition">{model?.nazwa || 'Model'}</p>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 shrink-0" />
               </Link>
               {model?.kategoria && (
                 <Link href={`/dashboard/warehouse/categories/${model.kategoria.id}`} className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition group">
                    <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl group-hover:bg-emerald-100 transition"><Tag size={18} /></div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-black uppercase text-slate-400">Kategoria</p>
                       <p className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-700 transition">{model.kategoria.nazwa}</p>
                    </div>
                    <ExternalLink size={14} className="text-slate-300 shrink-0" />
                 </Link>
               )}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-black mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-cyan-600"/> Dostępność</h3>
            <MiniCalendar events={calendarEvents} />
          </Card>
        </div>
      </div>

      {/* 5. DODANE RENDEROWANIE MODALA */}
      <PrintLabelsModal 
        isOpen={showPrintModal} 
        onClose={() => setShowPrintModal(false)} 
        ids={[Number(id)]} 
      />
    </div>
  );
}