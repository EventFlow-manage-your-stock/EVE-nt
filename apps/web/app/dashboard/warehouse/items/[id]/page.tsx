'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  PackagePlus,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle, SearchableSelect } from '../../../../../components/ProductUI';
import { DataTable } from '../../../../../components/DataTable';
import { PrintLabelsModal } from '../../../../../components/PrintLabelsModal';
import { SimpleModal } from '../../../../../components/SimpleModal';

// ============================================================================
// KOMPONENT: MINI KALENDARZ ZAJĘTOŚCI EGZEMPLARZA
// ============================================================================
function MiniCalendar({ events }: { events: { start: string | Date; end: string | Date; type: string; label: string }[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    d.setHours(12, 0, 0, 0);
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
        <button type="button" onClick={prevMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-black capitalize text-slate-800 dark:text-slate-200">{monthName}</span>
        <button type="button" onClick={nextMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
          <ChevronRight size={18} />
        </button>
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
          let bgClass = 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100';
          let title = '';
          if (isService) {
            bgClass = 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/30 dark:text-red-400';
            title = d.events.filter((e) => e.type === 'serwis').map((e) => e.label).join(', ');
          } else if (isRental) {
            bgClass = 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-900/30 dark:text-orange-400';
            title = d.events.filter((e) => e.type === 'wynajem').map((e) => e.label).join(', ');
          } else if (isToday) {
            bgClass = 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400';
          }
          return (
            <div key={d.day} className={`cursor-default rounded-lg p-2 transition-colors ${bgClass}`} title={title || undefined}>
              {d.day}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 dark:border-white/10 pt-3 text-[11px] font-bold text-slate-500">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-900/40"></span> Zajęty (Wydarzenie / Wynajem)</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-red-100 ring-1 ring-red-200 dark:bg-red-900/40"></span> W serwisie</div>
      </div>
    </div>
  );
}

// ============================================================================
// GŁÓWNY KOMPONENT KARTY EGZEMPLARZA
// ============================================================================
export default function ItemEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<'szczegoly' | 'zawartosc' | 'historia_wydarzen' | 'historia_serwisowa'>('szczegoly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [record, setRecord] = useState<any>(null);
  const [model, setModel] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [dict, setDict] = useState<any>({ magazyny: [], cases: [] });
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [quantityModels, setQuantityModels] = useState<any[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);
  const [searchAvailable, setSearchAvailable] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Obsługa modala dodawania sprzętu ilościowego
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyForm, setQtyForm] = useState<{ id_modelu: string; ilosc: number }>({ id_modelu: '', ilosc: 1 });

  const isCase = useMemo(() => {
    return record?.model?.typ_sprzetu === 'opakowanie';
  }, [record]);

  const isCaseOrZestaw = useMemo(() => {
    return (
      record?.model?.typ_sprzetu === 'opakowanie' ||
      record?.model?.typ_sprzetu === 'zestaw' ||
      record?.model?.typ_sprzetu === 'rack' ||
      (record?.zawartosc_case && record.zawartosc_case.length > 0) ||
      (record?.zawartosc_ilosciowa_case && record.zawartosc_ilosciowa_case.length > 0)
    );
  }, [record]);

  const contents = record?.zawartosc_case || [];
  const quantityContents = record?.zawartosc_ilosciowa_case || [];

  // Automatyczne liczenie wartości dla opakowań na podstawie zawartości fizycznej i ilościowej
  const calculatedCaseValue = useMemo(() => {
    if (!isCase) return null;
    const physicalSum = contents.reduce((acc: number, curr: any) => {
      const val = Number(curr.wartosc ?? curr.model?.wartosc_domyslna_egzemplarza ?? curr.model?.wartosc ?? 0);
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);

    const qtySum = quantityContents.reduce((acc: number, curr: any) => {
      const unitVal = Number(curr.model?.wartosc_domyslna_egzemplarza ?? curr.model?.wartosc ?? 0);
      const amount = Number(curr.ilosc || 0);
      return acc + (unitVal * amount);
    }, 0);

    return physicalSum + qtySum;
  }, [isCase, contents, quantityContents]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get(`/api/magazyn/egzemplarze/${id}`);
      const rec = res.data;
      setRecord(rec);

      const [mRes, magRes, casesRes, availRes, zajRes, allModelsRes] = await Promise.all([
        api.get(`/api/magazyn/modele/${rec.id_modelu}`).catch(() => ({ data: null })),
        api.get('/api/magazyn/slowniki/magazyny').catch(() => ({ data: [] })),
        api.get('/api/magazyn/slowniki/cases').catch(() => ({ data: [] })),
        api.get(`/api/magazyn/slowniki/dostepne-do-case/${id}`).catch(() => ({ data: [] })),
        api.get(`/api/magazyn/modele/${rec.id_modelu}/zajetosc`).catch(() => ({ data: [] })),
        api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
      ]);

      const fetchedModel = mRes.data;
      setModel(fetchedModel);
      setDict({ magazyny: magRes.data || [], cases: casesRes.data || [] });
      setAvailableItems(availRes.data || []);
      setQuantityModels((allModelsRes.data || []).filter((mod: any) => mod.tryb_ewidencji === 'ilosciowe' || mod.sprzet_ilosciowy));

      const isPkg = rec.model?.typ_sprzetu === 'opakowanie';
      const initialContents = rec.zawartosc_case || [];
      const initialQtyContents = rec.zawartosc_ilosciowa_case || [];
      
      let initialValue = rec.wartosc;
      if (isPkg) {
        const pSum = initialContents.reduce(
          (acc: number, curr: any) => acc + Number(curr.wartosc ?? curr.model?.wartosc_domyslna_egzemplarza ?? curr.model?.wartosc ?? 0),
          0
        );
        const qSum = initialQtyContents.reduce(
          (acc: number, curr: any) => acc + (Number(curr.model?.wartosc_domyslna_egzemplarza ?? curr.model?.wartosc ?? 0) * Number(curr.ilosc || 0)),
          0
        );
        initialValue = pSum + qSum;
      } else if (initialValue === null || initialValue === undefined || initialValue === '') {
        initialValue = fetchedModel?.wartosc_domyslna_egzemplarza ?? fetchedModel?.wartosc ?? '';
      }

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
        status_serwisowy: rec.status_serwisowy || 'Działa',
        id_magazynu: rec.id_magazynu ? String(rec.id_magazynu) : '',
        id_case: rec.id_case ? String(rec.id_case) : '',
        miejsce_w_mag: rec.miejsce_w_mag || '',
        wartosc: initialValue != null ? String(initialValue) : '',
        cena_zakupu: rec.cena_zakupu || '',
        opis: rec.opis || '',
        szerokosc: rec.szerokosc || '',
        wysokosc: rec.wysokosc || '',
        glebokosc: rec.glebokosc || '',
        waga: rec.waga || '',
        objetosc: rec.objetosc || '',
      });

      const allReservations = zajRes.data || [];
      const itemReservations = allReservations.filter((z: any) =>
        z.egzemplarz === rec.nazwa || z.egzemplarz === rec.sn || z.egzemplarz === rec.numer_urzadzenia
      );
      const mappedEvents = [
        ...itemReservations.map((r: any) => ({
          start: r.start,
          end: r.koniec,
          type: 'wynajem',
          label: r.tytul,
        })),
        ...(rec.serwisy || []).map((s: any) => ({
          start: s.data_zgloszenia,
          end: s.data_rozwiazania || new Date(),
          type: 'serwis',
          label: s.tytul,
        })),
      ];
      setCalendarEvents(mappedEvents);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się wczytać danych egzemplarza.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (isCase && calculatedCaseValue !== null) {
      setForm((prev: any) => ({ ...prev, wartosc: String(calculatedCaseValue) }));
    }
  }, [isCase, calculatedCaseValue]);

  function pullPriceFromModel() {
    const defaultModelVal = model?.wartosc_domyslna_egzemplarza ?? model?.wartosc ?? '';
    if (defaultModelVal === '' || defaultModelVal === null) {
      alert('Model bazowy nie ma zdefiniowanej wartości domyślnej.');
      return;
    }
    setForm((prev: any) => ({ ...prev, wartosc: String(defaultModelVal) }));
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setError('');

    const finalWartosc = isCase && calculatedCaseValue !== null ? calculatedCaseValue : (form.wartosc ? Number(form.wartosc) : null);

    const payload = {
      ...form,
      id_magazynu: form.id_magazynu ? Number(form.id_magazynu) : null,
      id_case: form.id_case ? Number(form.id_case) : null,
      wartosc: finalWartosc,
      cena_zakupu: form.cena_zakupu ? Number(form.cena_zakupu) : null,
      szerokosc: form.szerokosc ? Number(form.szerokosc) : null,
      wysokosc: form.wysokosc ? Number(form.wysokosc) : null,
      glebokosc: form.glebokosc ? Number(form.glebokosc) : null,
      waga: form.waga ? Number(form.waga) : null,
      objetosc: form.objetosc ? Number(form.objetosc) : null,
      rozroznij_kod_qr: !!form.rozroznij_kod_qr,
    };

    try {
      await api.put(`/api/magazyn/egzemplarze/${id}`, payload);
      await loadData();
      alert('Zapisano zmiany w egzemplarzu.');
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
      setError(err?.response?.data?.message || 'Błąd podczas usuwania.');
    }
  }

  async function removeFromCase(itemId: number) {
    try {
      await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc`, { itemIds: [itemId], action: 'remove' });
      await loadData();
    } catch (err: any) {
      alert('Nie udało się wyjąć elementu ze skrzyni/zestawu.');
    }
  }

  async function addToCase() {
    if (!selectedToAdd.length) return;
    try {
      await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc`, { itemIds: selectedToAdd, action: 'add' });
      setSelectedToAdd([]);
      await loadData();
    } catch (err: any) {
      alert('Nie udało się dodać elementów do skrzyni/zestawu.');
    }
  }

  async function saveQuantityItem(e: React.FormEvent) {
    e.preventDefault();
    if (!qtyForm.id_modelu || Number(qtyForm.ilosc) <= 0) return;
    try {
      await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc-ilosciowa`, {
        id_modelu: Number(qtyForm.id_modelu),
        ilosc: Number(qtyForm.ilosc),
        action: 'set',
      });
      setShowQtyModal(false);
      setQtyForm({ id_modelu: '', ilosc: 1 });
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Błąd dodawania pozycji ilościowej.');
    }
  }

  async function removeQuantityItem(id_modelu: number) {
    if (!confirm('Usunąć tę pozycję ilościową ze skrzyni/zestawu?')) return;
    try {
      await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc-ilosciowa`, {
        id_modelu,
        ilosc: 0,
        action: 'remove',
      });
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Błąd usuwania pozycji ilościowej.');
    }
  }

  const filteredAvailable = useMemo(() => {
    const q = searchAvailable.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter((i: any) =>
      `${i.nazwa || ''} ${i.model?.nazwa || ''} ${i.sn || ''} ${i.kod_kreskowy || ''}`.toLowerCase().includes(q)
    );
  }, [availableItems, searchAvailable]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-cyan-600 w-8 h-8" />
        <span className="ml-3 font-bold text-slate-500">Ładowanie egzemplarza...</span>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <PageTitle
          eyebrow="Magazyn"
          title="Nie znaleziono egzemplarza"
          description="Egzemplarz nie istnieje lub został usunięty."
          action={
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft size={16} className="inline mr-1" /> Powrót
            </Button>
          }
        />
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  const displayName = record?.nazwa || record?.model?.nazwa || `Egzemplarz #${record?.id}`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle
        eyebrow={isCaseOrZestaw ? "Skrzynia / Zestaw sprzętowy" : "Fizyczny egzemplarz sprzętu"}
        title={displayName}
        description={`S/N: ${record?.sn || 'Brak'} · Kod: ${record?.kod_kreskowy || record?.zewnetrzny_kod_kreskowy || 'Brak'} · Typ: ${record?.model?.typ_sprzetu || 'Sprzęt'}`}
        action={
          <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* LEWA KOLUMNA: DANE I ZAWARTOSC */}
        <div className="space-y-6">
          <Card className="!p-0 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
              <button
                onClick={() => setActiveTab('szczegoly')}
                className={`flex min-w-[160px] items-center justify-center gap-2 border-b-2 px-5 py-4 text-sm font-black transition ${
                  activeTab === 'szczegoly' ? 'border-cyan-600 bg-white text-cyan-700 dark:bg-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <FileText size={16} /> Dane egzemplarza
              </button>

              {isCaseOrZestaw && (
                <button
                  onClick={() => setActiveTab('zawartosc')}
                  className={`flex min-w-[180px] items-center justify-center gap-2 border-b-2 px-5 py-4 text-sm font-black transition ${
                    activeTab === 'zawartosc' ? 'border-cyan-600 bg-white text-cyan-700 dark:bg-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Box size={16} /> Zawartość ({contents.length} egz. + {quantityContents.length} ilościowych)
                </button>
              )}
            </div>

            <div className="p-6">
              {/* TAB 1: FORMULARZ DANYCH EGZEMPLARZA */}
              {activeTab === 'szczegoly' && (
                <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                  <Field label="Nazwa własna egzemplarza">
                    <input className={inputClass} value={form.nazwa} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} />
                  </Field>
                  <Field label="Numer boczny / urządzeniowy">
                    <input className={inputClass} value={form.numer_egzemplarza} onChange={(e) => setForm({ ...form, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })} />
                  </Field>
                  <Field label="Numer seryjny (SN)">
                    <input className={inputClass} value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value })} />
                  </Field>
                  <Field label="Data produkcji">
                    <input type="date" className={inputClass} value={form.data_produkcji} onChange={(e) => setForm({ ...form, data_produkcji: e.target.value })} />
                  </Field>
                  <Field label="Kod kreskowy">
                    <input className={inputClass} value={form.kod_kreskowy} onChange={(e) => setForm({ ...form, kod_kreskowy: e.target.value, zewnetrzny_kod_kreskowy: e.target.value })} />
                  </Field>
                  <Field label="Zewnętrzny kod kreskowy (opcjonalny)">
                    <input className={inputClass} value={form.zewnetrzny_kod_kreskowy} onChange={(e) => setForm({ ...form, zewnetrzny_kod_kreskowy: e.target.value })} />
                  </Field>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={form.rozroznij_kod_qr} onChange={(e) => setForm({ ...form, rozroznij_kod_qr: e.target.checked })} />
                      Rozróżnij zewnętrzny kod kreskowy i zewnętrzny kod QR
                    </label>
                  </div>

                  {form.rozroznij_kod_qr && (
                    <div className="md:col-span-2">
                      <Field label="Zewnętrzny kod QR">
                        <input className={inputClass} value={form.zewnetrzny_qr_kod} onChange={(e) => setForm({ ...form, zewnetrzny_qr_kod: e.target.value, qr_kod: e.target.value })} />
                      </Field>
                    </div>
                  )}

                  <Field label="Kondycja / Status">
                    <select className={inputClass} value={form.status_serwisowy} onChange={(e) => setForm({ ...form, status_serwisowy: e.target.value })}>
                      <option value="Działa">Działa</option>
                      <option value="Wydany">Wydany (W terenie)</option>
                      <option value="Wymaga serwisu (działa)">Wymaga serwisu (działa)</option>
                      <option value="Wymaga serwisu (nie działa)">Wymaga serwisu (nie działa)</option>
                      <option value="W serwisie">W serwisie</option>
                      <option value="Naprawiony">Naprawiony</option>
                    </select>
                  </Field>

                  <Field label="Magazyn">
                    <select className={inputClass} value={form.id_magazynu} onChange={(e) => setForm({ ...form, id_magazynu: e.target.value })}>
                      <option value="">Brak magazynu</option>
                      {dict.magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                    </select>
                  </Field>

                  <Field label="Miejsce w magazynie / na regale">
                    <input className={inputClass} value={form.miejsce_w_mag} onChange={(e) => setForm({ ...form, miejsce_w_mag: e.target.value })} />
                  </Field>

                  {!isCaseOrZestaw && (
                    <Field label="Przypisana skrzynia (Case / Zestaw)">
                      <select className={inputClass} value={form.id_case} onChange={(e) => setForm({ ...form, id_case: e.target.value })}>
                        <option value="">Luzem (Brak skrzyni)</option>
                        {dict.cases.filter((c: any) => c.id !== record.id).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.model?.nazwa || ''} {c.nazwa || `#${c.id}`}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                        {isCase ? "Wartość (Suma zawartości) [PLN]" : "Wartość odtworzeniowa [PLN]"}
                      </span>
                      {!isCase && (
                        <button
                          type="button"
                          onClick={pullPriceFromModel}
                          className="inline-flex items-center gap-1 text-xs font-black text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 hover:underline"
                          title="Ustawia wartość zdefiniowaną na modelu bazowym"
                        >
                          <RotateCcw size={12} /> Zaciągnij z modelu
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isCase}
                      className={`${inputClass} ${isCase ? 'bg-slate-100 dark:bg-black/40 font-black text-slate-600 dark:text-slate-400 cursor-not-allowed' : ''}`}
                      value={form.wartosc}
                      onChange={(e) => setForm({ ...form, wartosc: e.target.value })}
                    />
                  </div>

                  <Field label="Cena zakupu [PLN]"><input type="number" step="0.01" className={inputClass} value={form.cena_zakupu} onChange={(e) => setForm({ ...form, cena_zakupu: e.target.value })} /></Field>
                  <Field label="Szerokość [cm]"><input type="number" step="0.01" className={inputClass} value={form.szerokosc} onChange={(e) => setForm({ ...form, szerokosc: e.target.value })} /></Field>
                  <Field label="Wysokość [cm]"><input type="number" step="0.01" className={inputClass} value={form.wysokosc} onChange={(e) => setForm({ ...form, wysokosc: e.target.value })} /></Field>
                  <Field label="Głębokość [cm]"><input type="number" step="0.01" className={inputClass} value={form.glebokosc} onChange={(e) => setForm({ ...form, glebokosc: e.target.value })} /></Field>
                  <Field label="Waga własna [kg]"><input type="number" step="0.01" className={inputClass} value={form.waga} onChange={(e) => setForm({ ...form, waga: e.target.value })} /></Field>

                  <div className="md:col-span-2">
                    <Field label="Uwagi i notatki">
                      <textarea className={`${inputClass} min-h-24 resize-none`} value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
                    </Field>
                  </div>
                </form>
              )}

              {/* TAB 2: ZARZĄDZANIE ZAWARTOŚCIĄ CASE / RACK */}
              {activeTab === 'zawartosc' && isCaseOrZestaw && (
                <div className="space-y-8">
                  {/* SEKCJA: SPRZĘT ILOŚCIOWY W TYM CASE */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Layers size={18} className="text-amber-500" /> Sprzęt ilościowy w tej skrzyni
                        </h3>
                        <p className="text-xs font-bold text-slate-400"></p>
                      </div>
                      <Button onClick={() => setShowQtyModal(true)}>
                        <Plus size={16} className="inline mr-1" /> Dodaj pozycję ilościową
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {quantityContents.map((qc: any) => (
                        <div key={qc.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-amber-50/20 dark:bg-amber-500/5 hover:border-amber-300 transition">
                          <div>
                            <b className="text-slate-900 dark:text-white text-sm">{qc.model?.nazwa}</b>
                            <p className="text-xs font-bold text-slate-500 mt-0.5">
                              Kategoria: {qc.model?.kategoria?.nazwa || 'Brak'} {qc.model?.kod_kreskowy ? `· Kod SKU: ${qc.model.kod_kreskowy}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-lg">
                              {Number(qc.ilosc)} {qc.model?.jednostka || 'szt.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeQuantityItem(qc.id_modelu)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                              title="Usuń z tej skrzyni"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {quantityContents.length === 0 && (
                        <p className="p-6 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                          Brak przypisanego sprzętu ilościowego w tej skrzyni.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SEKCJA: FIZYCZNE EGZEMPLARZE W CASE */}
                  <div className="pt-6 border-t border-slate-200 dark:border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Box size={18} className="text-cyan-600" /> Fizyczne egzemplarze wewnątrz
                        </h3>
                        <p className="text-xs font-bold text-slate-400">Podczas skanowania kodu skrzyni na WZ/PZ, wszystkie poniższe egzemplarze zostaną automatycznie rozpakowane.</p>
                      </div>
                      <span className="rounded-xl bg-cyan-100 dark:bg-cyan-900/30 px-3 py-1 text-xs font-black text-cyan-700 dark:text-[#04e0ff]">
                        Łącznie: {contents.length} szt.
                      </span>
                    </div>

                    <DataTable
                      rows={contents}
                      onRowClick={(r: any) => router.push(`/dashboard/warehouse/items/${r.id}`)}
                      empty="Brak fizycznych egzemplarzy w skrzyni."
                      columns={[
                        { key: 'nazwa', label: 'Nazwa sprzętu', value: (r: any) => <b className="hover:underline text-cyan-600 dark:text-cyan-400">{r.nazwa || r.model?.nazwa}</b> },
                        { key: 'model', label: 'Model', value: (r: any) => r.model?.nazwa || '-' },
                        { key: 'numer', label: 'Nr boczny', value: (r: any) => r.numer_egzemplarza || r.numer_urzadzenia || '-' },
                        { key: 'sn', label: 'S/N' },
                        { key: 'wartosc', label: 'Wartość', value: (r: any) => `${Number(r.wartosc ?? r.model?.wartosc_domyslna_egzemplarza ?? r.model?.wartosc ?? 0).toFixed(2)} PLN` },
                        { key: 'kod', label: 'Kod kreskowy', value: (r: any) => r.kod_kreskowy || r.zewnetrzny_kod_kreskowy || '-' },
                        { key: 'action', label: 'Wyjmij', value: (r: any) => (
                          <button onClick={(e) => { e.stopPropagation(); removeFromCase(r.id); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition" title="Wyjmij ze skrzyni">
                            <Trash2 size={16} />
                          </button>
                        )}
                      ]}
                    />
                  </div>

                  {/* DODAWANIE WOLNYCH EGZEMPLARZY DO SKRZYNI */}
                  <div className="pt-6 border-t border-slate-200 dark:border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white">Spakuj wolny sprzęt egzemplarzowy</h4>
                        <p className="text-xs font-bold text-slate-400">Wybierz wolne egzemplarze z magazynu i przypisz je do tej skrzyni.</p>
                      </div>
                      <Button onClick={addToCase} disabled={!selectedToAdd.length}>
                        <PackagePlus size={16} className="inline mr-1" /> Przypisz zaznaczone ({selectedToAdd.length})
                      </Button>
                    </div>

                    <div className="relative max-w-md">
                      <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input className={`${inputClass} pl-9`} placeholder="Filtruj wolny sprzęt..." value={searchAvailable} onChange={e => setSearchAvailable(e.target.value)} />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredAvailable.map((item: any) => {
                        const isSelected = selectedToAdd.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedToAdd(prev => isSelected ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                              isSelected ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <p className="font-black text-sm text-slate-900 dark:text-white">{item.nazwa || item.model?.nazwa} nr {item.numer_egzemplarza || '-'}</p>
                              <p className="text-xs font-bold text-slate-400">Model: {item.model?.nazwa} · S/N: {item.sn || '-'} · Wartość: {Number(item.wartosc || item.model?.wartosc || 0).toFixed(2)} PLN</p>
                            </div>
                            <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4 rounded border-slate-300 text-cyan-600 pointer-events-none" />
                          </div>
                        );
                      })}
                      {filteredAvailable.length === 0 && (
                        <p className="text-center py-6 text-sm font-bold text-slate-400">Brak wolnego sprzętu do spakowania.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* PRAWA KOLUMNA (SIDEBAR) */}
        <div className="space-y-6">
          <Card className="!p-0 overflow-hidden">
            {model?.zdjecie ? (
              <img src={model.zdjecie} alt={model.nazwa} className="w-full aspect-video object-cover bg-slate-100" />
            ) : (
              <div className="w-full aspect-video bg-slate-50 dark:bg-black/20 flex items-center justify-center text-slate-300 border-b border-slate-100 dark:border-white/5">
                <ImageIcon size={48} />
              </div>
            )}
            <div className="p-5 space-y-3">
              <Link 
                href={`/dashboard/warehouse/models/${record.id_modelu || record.model?.id}`} 
                className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition group"
              >
                <div className="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 p-2.5 rounded-xl">
                  <Box size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-400">Model bazowy</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-cyan-600 transition">
                    {model?.nazwa || 'Model'}
                  </p>
                </div>
                <ExternalLink size={14} className="text-slate-300 shrink-0" />
              </Link>

              {model?.kategoria && (
                <Link href={`/dashboard/warehouse/categories/${model.kategoria.id}`} className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition group">
                  <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 p-2.5 rounded-xl"><Tag size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-400">Kategoria</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition">{model.kategoria.nazwa}</p>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 shrink-0" />
                </Link>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <CalendarDays size={18} className="text-cyan-600" /> Dostępność w kalendarzu
            </h3>
            <MiniCalendar events={calendarEvents} />
          </Card>
        </div>
      </div>

      {/* MODAL DODAWANIA POZYCJI ILOŚCIOWEJ */}
      {showQtyModal && (
        <SimpleModal title="Dodaj sprzęt ilościowy do skrzyni / zestawu" onClose={() => setShowQtyModal(false)}>
          <form onSubmit={saveQuantityItem} className="space-y-4">
            <Field label="Wybierz model ilościowy">
              <SearchableSelect
                value={qtyForm.id_modelu}
                onChange={(val) => setQtyForm({ ...qtyForm, id_modelu: val })}
                options={quantityModels.map((qm: any) => ({
                  value: String(qm.id),
                  label: `${qm.nazwa} (Dostępne w magazynie: ${qm.ilosc_magazynowa || 0} ${qm.jednostka || 'szt.'})`,
                }))}
                placeholder="Wybierz model ilościowy..."
              />
            </Field>

            <Field label="Liczba sztuk spakowanych w skrzyni">
              <input
                type="number"
                min="0.01"
                step="any"
                required
                className={inputClass}
                value={qtyForm.ilosc}
                onChange={(e) => setQtyForm({ ...qtyForm, ilosc: Number(e.target.value) })}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button variant="secondary" type="button" onClick={() => setShowQtyModal(false)}>Anuluj</Button>
              <Button type="submit">Przypisz do skrzyni</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      <PrintLabelsModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        ids={[Number(id)]}
      />
    </div>
  );
}