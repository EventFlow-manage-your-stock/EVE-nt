'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Box, CheckSquare, ChevronDown, ChevronRight, Copy, DollarSign,
  FileArchive, FileText, History, Loader2, MapPin, MessageSquare, Plus, Save,
  Search, Trash2, Truck, Users, Wrench, Calendar, Send, Download, Paperclip, 
  Phone, CheckCircle2, Flag, Car, X, Clock, Layers, RotateCcw
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, SearchableSelect} from '../../../../components/ProductUI';
import { OfferDuplicateTargetModal } from '../../../../components/OfferDuplicateTargetModal';
import { googleMapsDirectionsUrl } from '../../../../lib/googleMaps';
import { QuickAddCrmModal } from '../../../../components/QuickAddCrmModal';
import { SimpleModal } from '../../../../components/SimpleModal';
import { useAuthStore } from '../../../../store/auth.store';

// ============================================================================
// GLOBALNE HELPERY
// ============================================================================

const TABS = [
  { id: 'sprzet', label: 'Sprzęt (Wydania/Zwroty)', icon: Box },
  { id: 'oferty', label: 'Oferty', icon: DollarSign },
  { id: 'ekipa', label: 'Ekipa', icon: Users },
  { id: 'flota', label: 'Flota', icon: Truck },
  { id: 'zadania', label: 'Zadania', icon: CheckSquare },
  { id: 'chat', label: 'Chat Wynajmu', icon: MessageSquare },
  { id: 'zalaczniki', label: 'Załączniki', icon: FileArchive },
  { id: 'historia', label: 'Historia Zmian', icon: History },
];

function toSelect(v: any) { return v === null || v === undefined ? '' : String(v); }
function toDateInput(v: any) { return v ? String(v).slice(0, 16) : ''; }
function numOrNull(v: any) { return v === '' || v === null || v === undefined ? null : Number(v); }
function strOrNull(v: any) { return v === '' || v === null || v === undefined ? null : String(v); }
function money(v: any) { return `${Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`; }
function dateTime(v: any) { return v ? new Date(v).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
function initials(u: any) { return u?.imie || u?.nazwisko ? `${u?.imie?.[0] || ''}${u?.nazwisko?.[0] || ''}`.toUpperCase() : '?'; }
function numberOrZero(value: any) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function modelCategoryId(model: any) { return String(model?.kategoria?.id || model?.id_kategorii || model?.kategoria_id || ''); }
function getCategoryParentId(category: any) { return category?.id_rodzica || category?.id_kategorii_glownej || category?.id_kategorii_nadrzednej || category?.parent_id || category?.id_parent || null; }

function flattenCategories(categories: any[]): any[] {
  const result: any[] = [];
  const walk = (items: any[], parent: any = null, level = 0) => {
    for (const item of items || []) {
      const copy = { ...item, parent, level };
      result.push(copy);
      if (item.dzieci?.length) walk(item.dzieci, copy, level + 1);
      if (item.children?.length) walk(item.children, copy, level + 1);
      if (item.podkategorie?.length) walk(item.podkategorie, copy, level + 1);
    }
  };
  walk(categories || []);
  return result;
}

function buildCategoryTree(categories: any[]) {
  const flatInput = flattenCategories(categories || []);
  const byId = new Map<string, any>();
  for (const cat of flatInput) byId.set(String(cat.id), { ...cat, dzieci: [], _parentId: getCategoryParentId(cat) ? String(getCategoryParentId(cat)) : null });
  for (const cat of Array.from(byId.values())) if (!cat._parentId && cat.parent?.id) cat._parentId = String(cat.parent.id);
  const roots: any[] = [];
  for (const cat of Array.from(byId.values())) {
    if (cat._parentId && byId.has(cat._parentId)) byId.get(cat._parentId).dzieci.push(cat);
    else roots.push(cat);
  }
  const sortByOrder = (items: any[]) => {
    items.sort((a, b) => numberOrZero(a.kolejnosc) - numberOrZero(b.kolejnosc) || String(a.nazwa || '').localeCompare(String(b.nazwa || ''), 'pl'));
    items.forEach((item) => sortByOrder(item.dzieci || []));
  };
  sortByOrder(roots);
  return { roots, byId };
}

function descendantsOf(categoryId: string, byId: Map<string, any>) {
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const cat = byId.get(id);
    for (const child of cat?.dzieci || []) walk(String(child.id));
  };
  walk(categoryId);
  return ids;
}

function categoryPath(categoryId: string, byId: Map<string, any>) {
  const parts: string[] = [];
  let current = byId.get(categoryId);
  let guard = 0;
  while (current && guard < 12) {
    parts.unshift(current.nazwa);
    current = current._parentId ? byId.get(String(current._parentId)) : null;
    guard++;
  }
  return parts.join(' / ');
}

function normalizeCode(v: any) {
  return String(v || '').trim().replace(/\s+/g, '').toLowerCase();
}

function getEquipmentCodes(row: any): string[] {
  const egz = row?.egzemplarz || row;
  const model = row?.model || egz?.model || row;
  return [
    row?.kod, row?.kod_kreskowy, row?.barcode, row?.qr_kod, row?.sn, row?.numer_seryjny,
    egz?.kod, egz?.kod_kreskowy, egz?.zewnetrzny_kod_kreskowy, egz?.zewnetrzny_qr_kod, egz?.qr_kod, egz?.sn, egz?.numer_seryjny,
    model?.kod, model?.kod_kreskowy, model?.barcode,
  ].map(normalizeCode).filter(Boolean);
}

function isQuantityOnly(row: any): boolean {
  if (!row) return false;
  const model = row?.model || row?.egzemplarz?.model || row;
  return Boolean(
    row.rowType === 'ilosciowy_model' || row.quantityOnly === true ||
    model?.tryb_ewidencji === 'ilosciowe' || model?.typ_sprzetu === 'ilosciowe'
  );
}

function isZestawRow(row: any): boolean {
  const modelType = String(row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu || '').toLowerCase();
  return Boolean(
    modelType === 'zestaw' || modelType === 'rack' || row?.rowType === 'zestaw' || row?.czy_zestaw === true || row?.isZestaw === true
  );
}

function isCaseRow(row: any): boolean {
  if (isZestawRow(row)) return false; 
  const modelType = String(row?.model?.typ_sprzetu || row?.egzemplarz?.model?.typ_sprzetu || row?.typ_sprzetu || '').toLowerCase();
  return Boolean(
    modelType === 'opakowanie' || row?.isCase === true || row?.czy_case === true || row?.rowType === 'case'
  );
}

function isEquipmentInstance(row: any): boolean {
  const hasInstance = Boolean(row?.id_egzemplarza || row?.egzemplarz || row?.id);
  return hasInstance && !isQuantityOnly(row) && !isCaseRow(row);
}

function modelIdOf(row: any) { return row?.id_modelu || row?.model?.id || row?.egzemplarz?.id_modelu || row?.egzemplarz?.model?.id || null; }
function modelNameOf(row: any) { return row?.nazwa_modelu || row?.model?.nazwa || row?.egzemplarz?.model?.nazwa || row?.nazwa || row?.egzemplarz?.nazwa || 'Sprzęt'; }
function modelCategoryIdOf(row: any) { return row?.id_kategorii || row?.model?.id_kategorii || row?.model?.kategoria?.id || row?.egzemplarz?.model?.id_kategorii || row?.egzemplarz?.model?.kategoria?.id || modelCategoryId(row?.model || row); }
function numberOf(row: any) { const egz = row?.egzemplarz || row; return egz?.numer_egzemplarza || egz?.numer_urzadzenia || egz?.sn || egz?.kod_kreskowy || ''; }

// ============================================================================
// KOMPONENT GŁÓWNY (Szczegóły Wynajmu)
// ============================================================================

export default function RentalDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';
  
  const [activeTab, setActiveTab] = useState('sprzet');
  const [tabSearchQuery, setTabSearchQuery] = useState('');
  
  const [rentalData, setRentalData] = useState<any>(null);
  const [form, setForm] = useState<any>({ data_wydania: '', data_zwrotu_planowana: '', budzet_netto: '' });
  const [dict, setDict] = useState<any>({ statusy: [], statusyMagazynowe: [], statusyKsiegowe: [], kontrahenci: [], kontakty: [], miejsca: [], uzytkownicy: [], pojazdy: [] });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [offerName, setOfferName] = useState('');
  const [duplicateTarget, setDuplicateTarget] = useState<any>(null);
  const [crmModalMode, setCrmModalMode] = useState<'kontrahent' | 'kontakt' | null>(null);

  useEffect(() => { setTabSearchQuery(''); }, [activeTab]);

  async function loadDictionaries() {
    const [statusy, statusyMagazynowe, statusyKsiegowe, kontrahenci, miejsca, uzytkownicy, pojazdy] = await Promise.all([
      api.get('/api/slowniki/statusy-wynajmu').catch(() => ({ data: [] })),
      api.get('/api/slowniki/statusy-magazynowe').catch(() => ({ data: [] })),
      api.get('/api/slowniki/statusy-ksiegowe').catch(() => ({ data: [] })),
      api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
      api.get('/api/slowniki/miejsca').catch(() => ({ data: [] })),
      api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      api.get('/api/flota/pojazdy').catch(() => ({ data: [] })),
    ]);
    
    setDict((prev: any) => ({
      ...prev,
      statusy: statusy.data || [],
      statusyMagazynowe: statusyMagazynowe.data || [],
      statusyKsiegowe: statusyKsiegowe.data || [],
      kontrahenci: kontrahenci.data || [],
      miejsca: miejsca.data || [],
      uzytkownicy: uzytkownicy.data || [],
      pojazdy: pojazdy.data || [],
    }));
  }

  async function loadRental() {
    if (isNew) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/wynajmy/${params.id}`);
      const w = res.data;
      setRentalData(w);
      setOfferName(w?.nazwa ? `Oferta - ${w.nazwa}` : `Oferta do wynajmu #${w.id}`);
      setForm({
        numer: w.numer || '',
        nazwa: w.nazwa || '',
        id_statusu_wynajmu: toSelect(w.id_statusu_wynajmu),
        id_statusu_magazynowego: toSelect(w.id_statusu_magazynowego),
        id_statusu_ksiegowego: toSelect(w.id_statusu_ksiegowego),
        id_oferty: toSelect(w.id_oferty),
        id_managera: toSelect(w.id_managera),
        id_kontrahenta: toSelect(w.id_kontrahenta),
        id_kontaktu: toSelect(w.id_kontaktu),
        id_miejsca: toSelect(w.id_miejsca),
        data_wydania: toDateInput(w.data_wydania),
        data_zwrotu_planowana: toDateInput(w.data_zwrotu_planowana),
        data_zwrotu_rzeczywista: toDateInput(w.data_zwrotu_rzeczywista),
        budzet_netto: w.budzet_netto || '',
        miejsce_reczne: w.miejsce_reczne || '',
        adres_reczny: w.adres_reczny || '',
        notatki_wewnetrzne: w.notatki_wewnetrzne || '',
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się wczytać wynajmu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (form.id_kontrahenta) {
      api.get(`/api/crm/kontakty?kontrahentId=${form.id_kontrahenta}`)
         .then(res => setDict((prev: any) => ({ ...prev, kontakty: res.data })))
         .catch(() => setDict((prev: any) => ({ ...prev, kontakty: [] })));
    } else {
      setDict((prev: any) => ({ ...prev, kontakty: [] }));
    }
  }, [form.id_kontrahenta]);

  useEffect(() => { loadDictionaries(); loadRental(); }, [params.id]);

  const payload = useMemo(() => ({
    numer: strOrNull(form.numer),
    nazwa: strOrNull(form.nazwa),
    notatki_wewnetrzne: strOrNull(form.notatki_wewnetrzne),
    data_wydania: strOrNull(form.data_wydania),
    data_zwrotu_planowana: strOrNull(form.data_zwrotu_planowana),
    data_zwrotu_rzeczywista: strOrNull(form.data_zwrotu_rzeczywista),
    budzet_netto: numOrNull(form.budzet_netto),
    id_statusu_wynajmu: numOrNull(form.id_statusu_wynajmu),
    id_statusu_magazynowego: numOrNull(form.id_statusu_magazynowego),
    id_statusu_ksiegowego: numOrNull(form.id_statusu_ksiegowego),
    id_oferty: numOrNull(form.id_oferty),
    id_kontrahenta: numOrNull(form.id_kontrahenta),
    id_kontaktu: numOrNull(form.id_kontaktu), 
    id_miejsca: numOrNull(form.id_miejsca),
    id_managera: numOrNull(form.id_managera),
    miejsce_reczne: strOrNull(form.miejsce_reczne),
    adres_reczny: strOrNull(form.adres_reczny),
  }), [form]);

  async function submit(e?: any) {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const r = await api.post('/api/wynajmy', payload);
        router.push(`/dashboard/rentals/${r.data.id}`);
      } else {
        await api.put(`/api/wynajmy/${params.id}`, payload);
        await loadRental();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać wynajmu.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Na pewno usunąć wypożyczenie?')) return;
    await api.delete(`/api/wynajmy/${params.id}`);
    router.push('/dashboard/rentals');
  }

  async function createOffer() {
    if (isNew) return;
    const r = await api.post('/api/oferty', {
      nazwa: offerName || `Oferta - ${form.nazwa || rentalData?.numer || params.id}`,
      id_wynajmu: Number(params.id),
      id_kontrahenta: numOrNull(form.id_kontrahenta),
    });
    router.push(`/dashboard/offers/${r.data.id}`);
  }

  function handleCrmSuccess(type: 'kontrahent' | 'kontakt', newData: any) {
    if (type === 'kontrahent') {
      setDict((prev: any) => ({ ...prev, kontrahenci: [...prev.kontrahenci, newData] }));
      setForm((prev: any) => ({ ...prev, id_kontrahenta: String(newData.id), id_kontaktu: '' }));
    } else if (type === 'kontakt') {
      setDict((prev: any) => ({ ...prev, kontakty: [...(prev.kontakty || []), newData] }));
      setForm((prev: any) => ({ ...prev, id_kontaktu: String(newData.id) }));
    }
    setCrmModalMode(null);
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-[#04e0ff] w-10 h-10" /> <span className="ml-4 font-bold text-slate-500">Ładowanie danych wynajmu...</span></div>;

  const offers = rentalData?.oferty || [];
  const maps = googleMapsDirectionsUrl(form.adres_reczny);
  const currentManager = dict.uzytkownicy.find((u: any) => String(u.id) === String(form.id_managera)) || rentalData?.manager;

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">
            <button onClick={() => router.back()} title="Wróć" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 transition"><ArrowLeft size={14} />Powrót</button>
            <span>/</span>
            <Link href="/dashboard/rentals" className="hover:text-[#04e0ff] transition">Wypożyczenia</Link>
            <span>/</span>
            <span className="font-black text-slate-900 dark:text-white">{isNew ? 'Nowe wypożyczenie' : rentalData?.numer}</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
             {isNew ? 'Utwórz Wypożyczenie' : 'Panel Wypożyczenia'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && <Button variant="danger" onClick={remove}><Trash2 size={16} className="inline mr-1" /> Usuń</Button>}
          <Button onClick={submit} disabled={saving}><Save size={16} className="inline mr-1" /> {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      {!isNew && (
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Numer Wypożyczenia" value={rentalData?.numer || `#${rentalData?.id}`} />
          <Metric label="Przypisane Oferty" value={`${offers.length}`} />
          <Metric label="Wydanie -> Zwrot" value={`${dateTime(rentalData?.data_wydania).split(' ')[0]} → ${dateTime(rentalData?.data_zwrotu_planowana).split(' ')[0]}`} />
          <Metric label="Budżet" value={rentalData?.budzet_netto ? money(rentalData.budzet_netto) : 'Brak limitu'} />
        </div>
      )}

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.1fr_.9fr_1.1fr]">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#04e0ff]">Podstawowe Informacje</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{form.nazwa || form.numer || 'Nowe wypożyczenie'}</h2>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
               {rentalData?.status && <span className="rounded-xl px-3 py-1.5 text-[11px] font-black text-white shadow-sm" style={{ backgroundColor: rentalData.status.kolor || '#0891B2' }}>{rentalData.status.ikona || '●'} {rentalData.status.nazwa}</span>}
               {rentalData?.status_magazynowy && <span className="rounded-xl px-3 py-1.5 text-[11px] font-black text-white shadow-sm" style={{ backgroundColor: rentalData.status_magazynowy.kolor || '#F97316' }}>{rentalData.status_magazynowy.ikona || '📦'} {rentalData.status_magazynowy.nazwa}</span>}
               {rentalData?.status_ksiegowy && <span className="rounded-xl px-3 py-1.5 text-[11px] font-black text-white shadow-sm" style={{ backgroundColor: rentalData.status_ksiegowy.kolor || '#22C55E' }}>{rentalData.status_ksiegowy.ikona || '💰'} {rentalData.status_ksiegowy.nazwa}</span>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nazwa (Opcjonalnie)"><input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} placeholder="Krótki tytuł wynajmu" /></Field>
            <Field label="Numer systemowy"><input className={inputClass} value={form.numer || ''} onChange={(e) => setForm({ ...form, numer: e.target.value })} placeholder="Automatyczny jeśli puste" /></Field>
            
            <Field label="Wydanie sprzętu"><input type="datetime-local" className={inputClass} value={form.data_wydania || ''} onChange={(e) => setForm({ ...form, data_wydania: e.target.value })} /></Field>
            <Field label="Planowany zwrot"><input type="datetime-local" className={inputClass} value={form.data_zwrotu_planowana || ''} onChange={(e) => setForm({ ...form, data_zwrotu_planowana: e.target.value })} /></Field>
            
            <Field label="Status główny">
              <SearchableSelect value={form.id_statusu_wynajmu || ''} onChange={(v) => setForm({ ...form, id_statusu_wynajmu: v })} options={dict.statusy.map((s: any) => ({ value: String(s.id), label: `${s.nazwa}` }))} placeholder="Wybierz..." />
            </Field>

            <Field label="Założony budżet netto (PLN)">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><DollarSign size={15} className="text-slate-400" /></div>
                <input type="number" step="0.01" min="0" className={`${inputClass} pl-9`} value={form.budzet_netto || ''} onChange={(e) => setForm({ ...form, budzet_netto: e.target.value })} placeholder="np. 1500.00" />
              </div>
            </Field>
            
            <Field label="Klient z bazy">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect value={form.id_kontrahenta || ''} onChange={(v) => setForm({ ...form, id_kontrahenta: v, id_kontaktu: '' })} options={dict.kontrahenci.map((k: any) => ({ value: String(k.id), label: k.nazwa }))} placeholder="Brak" />
                </div>
                <button type="button" onClick={() => setCrmModalMode('kontrahent')} className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"><Plus size={18} /></button>
              </div>
            </Field>
            
            <Field label="Osoba kontaktowa">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect value={form.id_kontaktu || ''} onChange={(v) => setForm({ ...form, id_kontaktu: v })} options={dict.kontakty?.map((k: any) => ({ value: String(k.id), label: `${k.imie} ${k.nazwisko} ${k.stanowisko ? `(${k.stanowisko})` : ''}` })) || []} placeholder={form.id_kontrahenta ? "Wybierz osobę..." : "Najpierw wybierz klienta"} disabled={!form.id_kontrahenta} />
                </div>
                <button type="button" disabled={!form.id_kontrahenta} onClick={() => setCrmModalMode('kontakt')} className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50 disabled:pointer-events-none"><Plus size={18} /></button>
              </div>
            </Field>

            <Field label="Miejsce z bazy (Opcjonalnie)">
              <SearchableSelect value={form.id_miejsca || ''} onChange={(v) => setForm({ ...form, id_miejsca: v })} options={dict.miejsca.map((m: any) => ({ value: String(m.id), label: m.nazwa }))} placeholder="Wpiszę ręcznie (lub wybierz)" />
            </Field>
            
             <Field label="Miejsce ręcznie"><input className={inputClass} value={form.miejsce_reczne || ''} onChange={(e) => setForm({ ...form, miejsce_reczne: e.target.value })} /></Field>
          </div>
          
          <div className="grid gap-4 md:grid-cols-1 border-t border-slate-100 dark:border-white/10 pt-5 mt-4">
             <Field label="Adres docelowy / Dostawa (Opcjonalnie)">
               <div className="flex gap-2">
                 <input className={inputClass} value={form.adres_reczny || ''} onChange={(e) => setForm({ ...form, adres_reczny: e.target.value })} placeholder="np. Odbiór własny" />
                 {maps && <a className="flex items-center justify-center gap-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition whitespace-nowrap" href={maps} target="_blank" rel="noreferrer"><MapPin size={16} /> Otwórz trasę</a>}
               </div>
             </Field>
             <div className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#02080a] shadow-sm relative">
               {form.adres_reczny ? (
                 <iframe
                   width="100%"
                   height="100%"
                   style={{ border: 0, filter: 'contrast(0.9)' }} 
                   loading="lazy"
                   allowFullScreen
                   referrerPolicy="no-referrer-when-downgrade"
                   src={`https://maps.google.com/maps?q=${encodeURIComponent(form.adres_reczny)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                 ></iframe>
               ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                   <MapPin size={32} className="mb-2 opacity-30" />
                   <p className="text-sm font-bold opacity-60">Wpisz adres dostawy (opcjonalnie)</p>
                 </div>
               )}
             </div>
          </div>

          <Field label="Notatki wewnętrzne (ukryte)"><textarea className={`${inputClass} min-h-[100px] resize-none`} value={form.notatki_wewnetrzne || ''} onChange={(e) => setForm({ ...form, notatki_wewnetrzne: e.target.value })} /></Field>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 text-lg font-black text-slate-600 dark:text-white shadow-sm border border-slate-200 dark:border-white/10">
                {initials(currentManager)}
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white text-lg truncate">{currentManager ? `${currentManager.imie || ''} ${currentManager.nazwisko || ''}`.trim() : 'Brak opiekuna'}</p>
                <p className="text-sm font-bold text-[#04e0ff] uppercase tracking-wider mt-0.5">Opiekun Wynajmu</p>
              </div>
            </div>
            <div className="pt-2">
              <Field label="Zmień Opiekuna (Managera)">
                <SearchableSelect value={form.id_managera || ''} onChange={(v) => setForm({ ...form, id_managera: v })} options={dict.uzytkownicy.map((u: any) => ({ value: String(u.id), label: `${u.imie} ${u.nazwisko}` }))} placeholder="Brak" />
              </Field>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5 mt-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Statusy Poboczne</p>
              <div className="grid gap-4">
                <Field label="Magazyn & Logistyka">
                  <SearchableSelect value={form.id_statusu_magazynowego || ''} onChange={(v) => setForm({ ...form, id_statusu_magazynowego: v })} options={dict.statusyMagazynowe.map((s: any) => ({ value: String(s.id), label: `${s.ikona || '📦'} ${s.nazwa}` }))} placeholder="Brak" />
                </Field>
                <Field label="Księgowość">
                  <SearchableSelect value={form.id_statusu_ksiegowego || ''} onChange={(v) => setForm({ ...form, id_statusu_ksiegowego: v })} options={dict.statusyKsiegowe.map((s: any) => ({ value: String(s.id), label: `${s.ikona || '💰'} ${s.nazwa}` }))} placeholder="Brak" />
                </Field>
              </div>
            </div>
          </Card>
        </div>
      </form>

      <Card className="!p-0 border-transparent shadow-none bg-transparent mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-t-3xl shadow-sm px-3 pt-3 pb-0">
          <div className="flex overflow-x-auto custom-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex min-w-[130px] flex-col items-center justify-center gap-2 border-b-[3px] px-4 py-4 text-xs font-black transition-all ${
                    active 
                      ? 'border-[#04e0ff] bg-gradient-to-t from-[#04e0ff]/10 to-transparent text-[#04e0ff] dark:text-white' 
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} className={active ? 'text-[#04e0ff]' : 'opacity-70'}/>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {['oferty', 'ekipa', 'flota', 'historia', 'sprzet', 'zadania', 'zalaczniki'].includes(activeTab) && (
            <div className="p-3 border-t md:border-t-0 border-slate-100 dark:border-white/10 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  className={`${inputClass} pl-10 py-2.5 text-sm rounded-full min-w-[280px] w-full border-transparent bg-slate-100 dark:bg-black/30 focus:border-[#04e0ff]/50 focus:bg-white dark:focus:bg-black/50 transition-all`} 
                  placeholder={`Szukaj w zakładce...`} 
                  value={tabSearchQuery} 
                  onChange={(e) => setTabSearchQuery(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 border-t-0 rounded-b-3xl shadow-sm min-h-[500px]">
          {activeTab === 'chat' && <RentalChatPanel rentalId={Number(params.id)} historia={rentalData?.historia || []} reloadRental={loadRental} />}
          {activeTab === 'zadania' && <RentalTasksPanel rentalId={Number(params.id)} zadania={rentalData?.zadania || []} dict={dict} reloadRental={loadRental} tabQuery={tabSearchQuery} />}
          {activeTab === 'ekipa' && <RentalCrewPanel rentalId={Number(params.id)} ekipa={rentalData?.ekipa || []} dict={dict} tabQuery={tabSearchQuery} reloadRental={loadRental} />}
          {activeTab === 'flota' && <RentalFleetPanel rentalId={Number(params.id)} pojazdy={rentalData?.pojazdy || []} dict={dict} tabQuery={tabSearchQuery} reloadRental={loadRental} />}
          {activeTab === 'zalaczniki' && <AttachmentsPanel rentalId={Number(params.id)} zalaczniki={rentalData?.zalaczniki || []} reloadRental={loadRental} tabQuery={tabSearchQuery} />}
          
          {activeTab === 'oferty' && <OffersPanel offers={offers} mainOfferId={form.id_oferty} setMainOfferId={(id: any) => setForm({ ...form, id_oferty: id })} offerName={offerName} setOfferName={setOfferName} createOffer={createOffer} duplicateOffer={(o:any)=>setDuplicateTarget(o)} tabQuery={tabSearchQuery} />}
          {activeTab === 'sprzet' && !isNew && <EquipmentPanel rentalId={Number(params.id)} rentalName={form.nazwa || rentalData?.numer} />}
          {activeTab === 'historia' && <HistoryPanel history={rentalData?.historia || []} tabQuery={tabSearchQuery} />}
        </div>
      </Card>

      {/* MODALS */}
      {crmModalMode && <QuickAddCrmModal mode={crmModalMode} parentId={form.id_kontrahenta} onClose={() => setCrmModalMode(null)} onSuccess={() => { setCrmModalMode(null); loadDictionaries(); }} />}
      {duplicateTarget && <OfferDuplicateTargetModal offer={duplicateTarget} defaultRentalId={params.id as any} onClose={() => setDuplicateTarget(null)} onDone={(o) => router.push(`/dashboard/offers/${o.id}`)} />}
    </div>
  );
}

// ============================================================================
// KOMPONENTY ZAKŁADEK DOLNYCH
// ============================================================================

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 truncate text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
    </div>
  );
}

// -------------------------------------------------------------
// OFERTY
// -------------------------------------------------------------
function OffersPanel({ offers, mainOfferId, setMainOfferId, offerName, setOfferName, createOffer, duplicateOffer, tabQuery = '' }: any) {
  const filteredOffers = useMemo(() => {
    if (!tabQuery) return offers;
    const q = tabQuery.toLowerCase();
    return offers.filter((o: any) => `${o.nazwa || ''} ${o.numer || ''} ${o.status?.nazwa || ''}`.toLowerCase().includes(q));
  }, [offers, tabQuery]);

  return <div className="space-y-6">
    <div className="grid gap-4 rounded-[24px] border border-cyan-100 dark:border-white/10 bg-cyan-50/50 dark:bg-white/5 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
      <Field label="Wybierz Ofertę Bazową">
        <SearchableSelect value={mainOfferId || ''} onChange={(v) => setMainOfferId(v)} options={offers.map((o: any) => ({ value: String(o.id), label: `${o.numer || `#${o.id}`} · ${o.nazwa}` }))} placeholder="Brak" />
      </Field>
      <Field label="Nazwa nowej oferty"><input className={inputClass} value={offerName} onChange={(e) => setOfferName(e.target.value)} /></Field>
      <Button onClick={createOffer}><Plus size={16} className="inline mr-1" /> Utwórz pustą wycenę</Button>
    </div>
    
    <div className="grid gap-4 lg:grid-cols-2">
      {filteredOffers.map((o: any) => (
        <div key={o.id} className="rounded-[24px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#061B1F] p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#04e0ff]">{o.numer || `Oferta #${o.id}`}</p>
              <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white truncate">{o.nazwa}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">{o.status?.nazwa || 'Bez statusu'}</span>
                <span className="text-[11px] font-bold text-slate-500">Wersja: {o.wersje?.length || 0}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
               <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">Wartość Netto</p>
               <p className="text-xl font-black text-[#04e0ff]">{money(o.suma_netto)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => window.location.href = `/dashboard/offers/${o.id}`} className="text-xs py-2 px-5">Otwórz Edytor</Button>
            <Button variant="secondary" onClick={() => window.open(`/dashboard/offers/${o.id}/pdf`, '_blank')} className="text-xs py-2 px-5"><FileText size={14} className="inline mr-1"/> PDF</Button>
            <Button variant="secondary" onClick={() => duplicateOffer(o)} className="text-xs py-2 px-5"><Copy size={14} className="inline mr-1" /> Kopiuj</Button>
          </div>
        </div>
      ))}
      {filteredOffers.length === 0 && offers.length > 0 && <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 dark:border-white/10 p-12 text-center text-sm font-bold text-slate-400">Brak ofert pasujących do wyszukiwania.</div>}
      {offers.length === 0 && <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 dark:border-white/10 p-12 text-center text-sm font-bold text-slate-400">Do tego wynajmu nie ma jeszcze przypisanych ofert. Stwórz pierwszą wycenę!</div>}
    </div>
  </div>;
}

// -------------------------------------------------------------
// CHAT GRUPOWY
// -------------------------------------------------------------
function RentalChatPanel({ rentalId, historia, reloadRental }: any) {
  const [msg, setMsg] = useState('');
  const [sending, setSaving] = useState(false);
  const me = useAuthStore((s) => s.user);

  const messages = useMemo(() => historia.filter((h: any) => h.akcja === 'CHAT').reverse(), [historia]);

  async function send(e: any) {
    e.preventDefault();
    if (!msg.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/wynajmy/${rentalId}/chat`, { message: msg });
      setMsg('');
      reloadRental();
    } catch(err) {
      alert("Błąd wysyłania wiadomości");
    } finally { setSaving(false); }
  }

  return <div className="flex flex-col h-[600px] bg-slate-50/50 dark:bg-black/20 rounded-[24px] border border-slate-200 dark:border-white/5 overflow-hidden">
    <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
      {messages.map((m: any) => {
        const isMe = m.uzytkownik?.email === me?.email;
        return (
          <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
             <div className="flex items-end gap-3 max-w-[80%]">
                {!isMe && <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[11px] font-black shrink-0 text-slate-600 dark:text-white shadow-sm border border-slate-300 dark:border-white/10">{initials(m.uzytkownik)}</div>}
                <div className={`px-5 py-3 rounded-[20px] text-sm font-semibold leading-relaxed shadow-sm ${isMe ? 'bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                  {m.nowa_wartosc}
                </div>
             </div>
             <span className={`text-[10px] font-bold text-slate-400 mt-1.5 ${isMe ? 'pr-2' : 'pl-[52px]'}`}>
               {isMe ? 'Ty' : `${m.uzytkownik?.imie} ${m.uzytkownik?.nazwisko}`} · {new Date(m.data_utworzenia).toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'})}
             </span>
          </div>
        )
      })}
      {messages.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 font-bold opacity-60"><MessageSquare size={48} className="mb-4 text-[#04e0ff]"/><p>Brak wiadomości. Rozpocznij dyskusję z zespołem logistycznym!</p></div>}
    </div>
    <form onSubmit={send} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5 flex items-center gap-3">
      <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Napisz wiadomość do zespołu..." className="flex-1 bg-slate-100 dark:bg-black/40 border border-transparent rounded-full px-5 py-3.5 text-sm font-semibold outline-none focus:bg-white dark:focus:bg-[#02080a] focus:border-[#04e0ff]/50 focus:ring-2 focus:ring-[#04e0ff]/20 transition-all dark:text-white" />
      <button type="submit" disabled={sending || !msg.trim()} className="w-12 h-12 rounded-full bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white flex items-center justify-center shrink-0 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition shadow-md shadow-[#04e0ff]/20"><Send size={18} className="ml-1 pl-0.5"/></button>
    </form>
  </div>
}

// -------------------------------------------------------------
// ZADANIA
// -------------------------------------------------------------
function RentalTasksPanel({ rentalId, zadania, dict, reloadRental, tabQuery = '' }: any) {
  const [form, setForm] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const me = useAuthStore((s) => s.user);
  const [savingTask, setSavingTask] = useState(false);

  const filteredTasks = useMemo(() => {
    if (!tabQuery) return zadania;
    const q = tabQuery.toLowerCase();
    return zadania.filter((t:any) => `${t.tytul || ''} ${t.typ_zadania || ''}`.toLowerCase().includes(q));
  }, [zadania, tabQuery]);

  async function toggleStatus(t: any) {
    const newStatus = t.status === 'zakończone' ? 'nowe' : 'zakończone';
    await api.patch(`/api/zadania/${t.id}/status`, { status: newStatus }); 
    reloadRental();
  }

  async function saveTask(e: any) {
    e.preventDefault();
    setSavingTask(true);
    try {
      await api.post(`/api/zadania`, {
        id_wynajmu: rentalId,
        tytul: form.tytul,
        przypisani: [String(form.uzytkownik || me?.id)],
        data_start: form.data_start ? new Date(form.data_start).toISOString() : null,
        data_koniec: form.data_koniec ? new Date(form.data_koniec).toISOString() : null,
        typ_zadania: form.typ || 'inne'
      });
      setForm({}); setAdding(false); reloadRental();
    } catch(err) {
      alert("Błąd zapisu zadania");
    } finally {
      setSavingTask(false);
    }
  }

  return <div className="space-y-4">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-black text-xl text-slate-900 dark:text-white">Zadania dla wypożyczenia</h3>
      <Button onClick={() => setAdding(true)}><Plus size={16} className="inline mr-1"/> Dodaj zadanie</Button>
    </div>
    
    {adding && <Card className="mb-6 bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-[24px]">
      <form onSubmit={saveTask} className="grid md:grid-cols-[1fr_220px_auto] gap-4 items-end">
        <Field label="Treść zadania"><input required className={inputClass} value={form.tytul || ''} onChange={e => setForm({...form, tytul: e.target.value})} placeholder="np. Przygotować kable zasilające..."/></Field>
        <Field label="Przypisz do"><select className={inputClass} value={form.uzytkownik || ''} onChange={e => setForm({...form, uzytkownik: e.target.value})}><option value={me?.id}>Przypisz sobie</option>{dict.uzytkownicy.map((u:any)=><option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}</select></Field>
        <div className="flex gap-2"><Button variant="secondary" type="button" onClick={()=>setAdding(false)}>Anuluj</Button><Button type="submit" disabled={savingTask}>{savingTask ? '...' : 'Zapisz'}</Button></div>
      </form>
    </Card>}

    <div className="space-y-3">
      {filteredTasks.map((t: any) => {
        const isDone = t.status === 'zakończone';
        return <div key={t.id} className={`flex items-center gap-5 p-5 border rounded-[20px] transition-all duration-300 ${isDone ? 'bg-slate-50 dark:bg-black/20 border-slate-100 dark:border-white/5 opacity-70' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-sm hover:border-[#04e0ff]/50'}`}>
          <button onClick={() => toggleStatus(t)} className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-[#04e0ff]'}`}>
             <CheckCircle2 size={18} />
          </button>
          <div className="flex-1 min-w-0 pr-4">
             <p className={`font-black text-[15px] truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{t.tytul}</p>
             <div className="flex items-center gap-4 mt-1.5 text-xs font-bold text-slate-400">
               <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md"><Users size={12} className="text-slate-400"/> {t.przypisani_uzytkownicy?.map((u:any)=>u.uzytkownik.imie).join(', ') || 'Brak'}</span>
               {t.data_koniec && <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md"><Calendar size={12} className="text-slate-400"/> {new Date(t.data_koniec).toLocaleDateString('pl-PL')}</span>}
             </div>
          </div>
          <button onClick={async () => { if(confirm('Usunąć zadanie?')) { await api.delete(`/api/zadania/${t.id}`); reloadRental(); } }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition"><Trash2 size={18}/></button>
        </div>
      })}
      {filteredTasks.length === 0 && !adding && <div className="p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak zdefiniowanych zadań dla tego wynajmu.</div>}
    </div>
  </div>
}

// -------------------------------------------------------------
// EKIPA (OPCJONALNIE DLA WYNAJMU)
// -------------------------------------------------------------
function RentalCrewPanel({ rentalId, ekipa, dict, tabQuery = '', reloadRental }: any) {
  const [form, setForm] = useState<any>({ rola: 'Obsługa logistyczna' });
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!tabQuery) return ekipa;
    const q = tabQuery.toLowerCase();
    return ekipa.filter((p:any) => `${p.uzytkownik?.imie || ''} ${p.uzytkownik?.nazwisko || ''} ${p.rola_w_wynajmie || ''}`.toLowerCase().includes(q));
  }, [ekipa, tabQuery]);

  async function saveCrew(e: any) {
    e.preventDefault();
    await api.post(`/api/wynajmy/${rentalId}/ekipa`, form);
    setForm({ rola: 'Obsługa logistyczna' }); setAdding(false); reloadRental();
  }

  return <div className="space-y-4">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-black text-xl text-slate-900 dark:text-white">Ekipa (np. Kierowca, Magazynier)</h3>
      <Button onClick={() => setAdding(true)}><Plus size={16} className="inline mr-1"/> Przypisz osobę</Button>
    </div>

    {adding && <SimpleModal title="Dodaj osobę do wynajmu" onClose={() => setAdding(false)}>
      <form onSubmit={saveCrew} className="space-y-5">
        <Field label="Wybierz pracownika z bazy">
          <SearchableSelect value={form.id_uzytkownika} onChange={(v) => setForm({...form, id_uzytkownika: v})} options={dict.uzytkownicy.map((u:any)=>({value: String(u.id), label: `${u.imie} ${u.nazwisko}`}))} placeholder="Wybierz osobę..." />
        </Field>
        <Field label="Rola w tym wynajmie">
          <input required className={inputClass} value={form.rola || ''} onChange={e => setForm({...form, rola: e.target.value})} placeholder="np. Kierowca, Logistyk..." />
        </Field>
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10"><Button variant="secondary" type="button" onClick={()=>setAdding(false)}>Anuluj</Button><Button type="submit">Zapisz przypisanie</Button></div>
      </form>
    </SimpleModal>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((p: any) => <div key={p.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
         <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center font-black text-slate-500 dark:text-slate-300 text-lg border border-slate-200 dark:border-white/10">
             {initials(p.uzytkownik)}
           </div>
           <div>
             <p className="font-black text-slate-900 dark:text-white text-[15px]">{p.uzytkownik?.imie} {p.uzytkownik?.nazwisko}</p>
             <p className="text-[11px] font-bold text-[#04e0ff] bg-cyan-50 dark:bg-[#04e0ff]/10 px-2 py-0.5 rounded-md inline-block mt-1 uppercase tracking-wider">{p.rola_w_wynajmie || 'Obsługa'}</p>
           </div>
         </div>
         <button onClick={async () => { if(confirm('Odpiąć osobę od wynajmu?')) { await api.delete(`/api/wynajmy/${rentalId}/ekipa/${p.id}`); reloadRental(); } }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
      </div>)}
      {filtered.length === 0 && ekipa.length > 0 && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak osób pasujących do wyszukiwania.</div>}
      {ekipa.length === 0 && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak przypisanej ekipy.</div>}
    </div>
  </div>
}

// -------------------------------------------------------------
// FLOTA
// -------------------------------------------------------------
function RentalFleetPanel({ rentalId, pojazdy, dict, tabQuery = '', reloadRental }: any) {
  const [form, setForm] = useState<any>({ rola: 'Transport sprzętu' });
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!tabQuery) return pojazdy;
    const q = tabQuery.toLowerCase();
    return pojazdy.filter((v:any) => `${v.pojazd?.nazwa || ''} ${v.pojazd?.nr_rejestracyjny || ''} ${v.rola_pojazdu || ''}`.toLowerCase().includes(q));
  }, [pojazdy, tabQuery]);

  async function saveFleet(e: any) {
    e.preventDefault();
    await api.post(`/api/wynajmy/${rentalId}/flota`, form);
    setForm({ rola: 'Transport sprzętu' }); setAdding(false); reloadRental();
  }

  return <div className="space-y-4">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-black text-xl text-slate-900 dark:text-white">Flota i transport</h3>
      <Button onClick={() => setAdding(true)}><Plus size={16} className="inline mr-1"/> Przypisz pojazd</Button>
    </div>

    {adding && <SimpleModal title="Zarezerwuj pojazd na wynajem" onClose={() => setAdding(false)}>
      <form onSubmit={saveFleet} className="space-y-4">
        <Field label="Pojazd z bazy">
          <SearchableSelect value={form.id_pojazdu} onChange={(v) => setForm({...form, id_pojazdu: v})} options={dict.pojazdy.map((p:any)=>({value: String(p.id), label: `${p.nazwa} (${p.nr_rejestracyjny})`}))} placeholder="Wybierz auto..." />
        </Field>
        <Field label="Rola pojazdu">
          <input required className={inputClass} value={form.rola || ''} onChange={e => setForm({...form, rola: e.target.value})} placeholder="np. Transport główny..." />
        </Field>
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10"><Button variant="secondary" type="button" onClick={()=>setAdding(false)}>Anuluj</Button><Button type="submit">Zapisz rezerwację</Button></div>
      </form>
    </SimpleModal>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((v: any) => <div key={v.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between group hover:shadow-md transition">
        <div>
           <p className="font-black text-slate-900 dark:text-white text-[15px] flex items-center gap-2 mb-2"><Car size={16} className="text-[#04e0ff]"/> {v.pojazd?.nazwa || 'Pojazd'}</p>
           <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center"><span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md uppercase tracking-widest text-[10px] mr-2">{v.pojazd?.nr_rejestracyjny || '-'}</span> {v.rola_pojazdu || 'Rezerwacja'}</p>
        </div>
        <button onClick={async () => { if(confirm('Zwolnić rezerwację pojazdu?')) { await api.delete(`/api/wynajmy/${rentalId}/flota/${v.id}`); reloadRental(); } }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
      </div>)}
      {filtered.length === 0 && pojazdy.length > 0 && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak aut pasujących do wyszukiwania.</div>}
      {pojazdy.length === 0 && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak zarezerwowanych aut dla tego wynajmu.</div>}
    </div>
  </div>
}

// -------------------------------------------------------------
// ZAŁĄCZNIKI
// -------------------------------------------------------------
function AttachmentsPanel({ rentalId, zalaczniki, tabQuery = '', reloadRental }: any) {
  const [form, setForm] = useState<any>({});
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!tabQuery) return zalaczniki;
    const q = tabQuery.toLowerCase();
    return zalaczniki.filter((z:any) => `${z.nazwa || ''} ${z.nazwa_pliku || ''}`.toLowerCase().includes(q));
  }, [zalaczniki, tabQuery]);

  async function saveFile(e: any) {
    e.preventDefault();
    await api.post(`/api/wynajmy/${rentalId}/zalaczniki`, {
       nazwa: form.nazwa || form.nazwa_pliku,
       nazwa_pliku: form.nazwa_pliku || 'skan.pdf',
       rozmiar: Math.floor(Math.random() * 5000000) + 100000, 
       mime: 'application/pdf'
    });
    setForm({}); setAdding(false); reloadRental();
  }

  return <div className="space-y-4">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-black text-xl text-slate-900 dark:text-white">Pliki i Załączniki</h3>
      <Button onClick={() => setAdding(true)}><Paperclip size={16} className="inline mr-1"/> Dodaj plik</Button>
    </div>

    {adding && <Card className="mb-6 bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-[24px]">
      <form onSubmit={saveFile} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
        <Field label="Nazwa wyświetlana (Opcjonalnie)"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({...form, nazwa: e.target.value})} placeholder="np. Skan Umowy"/></Field>
        <Field label="Wybierz Plik z Dysku"><input required type="file" className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-black file:text-white hover:file:bg-cyan-700 transition cursor-pointer" onChange={(e) => setForm({...form, nazwa_pliku: e.target.files?.[0]?.name})} /></Field>
        <div className="flex gap-2"><Button variant="secondary" type="button" onClick={()=>setAdding(false)}>Anuluj</Button><Button type="submit">Wgraj plik na serwer</Button></div>
      </form>
    </Card>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
       {filtered.map((z: any) => <div key={z.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between group hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center gap-4 min-w-0">
             <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20"><FileText size={24} strokeWidth={1.5}/></div>
             <div className="min-w-0 pr-2">
                <p className="font-black text-[15px] text-slate-900 dark:text-white truncate">{z.nazwa || z.nazwa_pliku}</p>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{z.nazwa_pliku} · {(z.rozmiar_bajtow / 1024 / 1024).toFixed(2)} MB</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">Dodał: {z.dodal?.imie || 'System'} · {new Date(z.data_utworzenia).toLocaleDateString()}</p>
             </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-2 text-[#04e0ff] hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition" title="Pobierz"><Download size={18}/></button>
            <button onClick={async () => { if(confirm('Usunąć załącznik z systemu?')) { await api.delete(`/api/wynajmy/${rentalId}/zalaczniki/${z.id}`); reloadRental(); } }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition" title="Usuń z serwera"><Trash2 size={18}/></button>
          </div>
       </div>)}
       {filtered.length === 0 && zalaczniki.length > 0 && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak plików pasujących do wyszukiwania.</div>}
       {zalaczniki.length === 0 && !adding && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak wgranych plików do tego wynajmu. Pamiętaj by załączyć tu skan podpisanej umowy!</div>}
    </div>
  </div>
}

// -------------------------------------------------------------
// HISTORIA ZMIAN
// -------------------------------------------------------------
function HistoryPanel({ history, tabQuery = '' }: { history: any[], tabQuery?: string }) {
  const filtered = useMemo(() => {
    const raw = history.filter(h => h.akcja !== 'CHAT'); 
    if (!tabQuery) return raw;
    const q = tabQuery.toLowerCase();
    return raw.filter(h => `${h.akcja || ''} ${h.uzytkownik?.imie || ''} ${h.uzytkownik?.nazwisko || ''}`.toLowerCase().includes(q));
  }, [history, tabQuery]);

  return <div className="space-y-4 max-w-4xl pt-2">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-black text-xl text-slate-900 dark:text-white">Historia audytowa operacji</h3>
    </div>
    <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8 pb-4">
      {filtered.map((h: any) => (
         <div key={h.id} className="relative pl-8 group hover:opacity-100 transition-opacity">
           <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-white dark:border-slate-900 group-hover:bg-[#04e0ff] transition-colors"></div>
           <p className="font-black text-[15px] text-slate-900 dark:text-white">{h.akcja.replace(/_/g, ' ')}</p>
           <p className="text-xs font-bold text-slate-500 mt-1.5 flex items-center gap-2">
             <span className="text-[#04e0ff] bg-cyan-50 dark:bg-[#04e0ff]/10 px-2 py-0.5 rounded-md uppercase tracking-wider">{h.uzytkownik ? `${h.uzytkownik.imie} ${h.uzytkownik.nazwisko}` : 'Z Automatu (System)'}</span>
             <span>{dateTime(h.data_utworzenia)}</span>
           </p>
           {h.nowa_wartosc && h.nowa_wartosc !== '{}' && (
             <div className="mt-3 text-[10px] font-mono bg-slate-900 dark:bg-black/40 text-slate-300 dark:text-slate-400 p-4 rounded-xl overflow-x-auto shadow-inner border border-slate-800 dark:border-white/5 leading-relaxed">
               {h.nowa_wartosc}
             </div>
           )}
         </div>
      ))}
      {filtered.length === 0 && <p className="pl-8 text-sm font-bold text-slate-400">Brak widocznej historii zmian dla Twoich kryteriów.</p>}
    </div>
  </div>;
}

// -------------------------------------------------------------
// SPRZĘT W Wypożyczeniu
// -------------------------------------------------------------
function EquipmentPanel({ rentalId, rentalName }: { rentalId: number; rentalName: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>({ planowane: [], pozycje_dokumentow: [], kategorie: [], dokumenty: [], podsumowanie: {} });
  const [items, setItems] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [equipmentCategories, setEquipmentCategories] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  
  const [mode, setMode] = useState<'plan' | 'wydanie' | 'przyjecie'>('plan');
  const [showEditor, setShowEditor] = useState(false);
  const [showBundlePicker, setShowBundlePicker] = useState(false);
  
  const [activeRoot, setActiveRoot] = useState<string>('all');
  const [activeSub, setActiveSub] = useState<string>('');
  const [query, setQuery] = useState('');
  
  const [planQty, setPlanQty] = useState<Record<string, string>>({});
  const [bundleForm, setBundleForm] = useState({ id_pakietu: '', mnoznik: 1 });
  
  const [scanCode, setScanCode] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  
  const [docItems, setDocItems] = useState<any[]>([]);
  const [docForm, setDocForm] = useState<any>({ osoba_odbierajaca: '', podpis_odbierajacego: '', uwagi: '' });
  
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingDocs, setSavingDocs] = useState(false);

  async function load() {
    const [gear, i, m, k, b] = await Promise.all([
      api.get(`/api/magazyn/wynajmy/${rentalId}/sprzet`).catch(() => ({ data: { planowane: [], pozycje_dokumentow: [], kategorie: [], dokumenty: [], podsumowanie: {} } })),
      api.get('/api/magazyn/wszystkie-egzemplarze').catch(() => ({ data: [] })),
      api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
      api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
      api.get('/api/pakiety').catch(() => ({ data: [] })),
    ]);

    const gearData = gear.data || { planowane: [], pozycje_dokumentow: [], kategorie: [], dokumenty: [], podsumowanie: {} };
    setData(gearData);
    setItems(i.data || []);
    setModels(m.data || []);
    setEquipmentCategories(k.data || gearData.kategorie || []);
    setBundles(b.data || []);

    const nextQty: Record<string, string> = {};
    (gearData.planowane || []).forEach((p: any) => {
      const id = p.id_modelu || p.model?.id;
      if (!id) return;
      nextQty[String(id)] = String(Number(nextQty[String(id)] || 0) + Number(p.ilosc || p.planowana_ilosc || 0));
    });
    setPlanQty(nextQty);
  }

  useEffect(() => { load(); }, [rentalId]);

  const { roots: equipmentCategoryRoots, byId: equipmentCategoryById } = useMemo(() => buildCategoryTree(equipmentCategories), [equipmentCategories]);

  function categoryOf(row: any) {
    const id = modelCategoryIdOf(row);
    if (id && equipmentCategoryById.has(String(id))) return categoryPath(String(id), equipmentCategoryById);
    return row?.kategoria || row?.kategoria_nazwa || row?.model?.kategoria?.nazwa || row?.egzemplarz?.model?.kategoria?.nazwa || 'Bez kategorii';
  }

  const modelCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    models.filter((m: any) => m.typ_sprzetu !== 'opakowanie').forEach((m: any) => {
      const id = modelCategoryId(m);
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    return map;
  }, [models]);

  function totalForEquipmentCategory(categoryId: string) {
    const ids = descendantsOf(categoryId, equipmentCategoryById);
    let total = 0;
    ids.forEach((id) => { total += modelCountByCategory.get(id) || 0; });
    return total;
  }

  const modelById = useMemo(() => {
    const map = new Map<string, any>();
    (models || []).forEach((model: any) => {
      if (model?.id) map.set(String(model.id), model);
    });
    return map;
  }, [models]);

  const plannedRows = useMemo(() => {
    const map = new Map<string, any>();

    (data.planowane || []).forEach((p: any) => {
      const id = modelIdOf(p);
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          id_modelu: id,
          nazwa: modelNameOf(p),
          kategoria: categoryOf(p),
          kategoria_id: modelCategoryIdOf(p),
          quantityOnly: false,
          kod: '',
          jednostka: 'szt.',
          plan: 0,
          wydane: 0,
          przyjete: 0,
          scanned: 0,
          egzemplarze_wydane: [],
          egzemplarze_przyjete: [],
        });
      }
      const row = map.get(key);
      row.plan += Number(p.ilosc || p.planowana_ilosc || 0);
      const sourceModel = p.model || modelById.get(String(id)) || p;
      if (isQuantityOnly(p) || isQuantityOnly(sourceModel)) {
        row.quantityOnly = true;
        row.kod = p.kod || p.kod_kreskowy || sourceModel?.kod_kreskowy || sourceModel?.kod || row.kod || '';
        row.jednostka = p.jednostka || sourceModel?.jednostka || row.jednostka || 'szt.';
      }
    });

    (data.pozycje_dokumentow || []).forEach((p: any) => {
      const id = modelIdOf(p);
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          id_modelu: id,
          nazwa: modelNameOf(p),
          kategoria: categoryOf(p),
          kategoria_id: modelCategoryIdOf(p),
          quantityOnly: false,
          kod: '',
          jednostka: 'szt.',
          plan: 0,
          wydane: 0,
          przyjete: 0,
          scanned: 0,
          egzemplarze_wydane: [],
          egzemplarze_przyjete: [],
        });
      }
      const row = map.get(key);
      const label = numberOf(p) || p.kod || p.nazwa || `#${p.id_egzemplarza || ''}`;
      if (p.zrodlo === 'wydanie') {
        row.wydane += Number(p.ilosc || 1);
        if (label) row.egzemplarze_wydane.push(label);
      }
      if (p.zrodlo === 'przyjecie') {
        row.przyjete += Number(p.ilosc || 1);
        if (label) row.egzemplarze_przyjete.push(label);
      }
    });

    docItems.forEach((p: any) => {
      const id = modelIdOf(p);
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          id_modelu: id,
          nazwa: modelNameOf(p),
          kategoria: categoryOf(p),
          kategoria_id: modelCategoryIdOf(p),
          quantityOnly: false,
          kod: '',
          jednostka: 'szt.',
          plan: 0,
          wydane: 0,
          przyjete: 0,
          scanned: 0,
          egzemplarze_wydane: [],
          egzemplarze_przyjete: [],
        });
      }
      map.get(key).scanned += Number(p.ilosc || 1);
    });

    return Array.from(map.values()).map((row: any) => {
      const model = modelById.get(String(row.id_modelu));
      const quantityOnly = row.quantityOnly || isQuantityOnly(model);
      return {
        ...row,
        quantityOnly,
        kod: row.kod || model?.kod_kreskowy || model?.kod || '',
        jednostka: row.jednostka || model?.jednostka || 'szt.',
      };
    }).sort((a, b) => String(a.kategoria).localeCompare(String(b.kategoria), 'pl') || String(a.nazwa).localeCompare(String(b.nazwa), 'pl'));
  }, [data, docItems, equipmentCategoryById, modelById]);

  const plannedGroups = useMemo(() => {
    const groups = new Map<string, any>();
    plannedRows.forEach((row: any) => {
      if (!groups.has(row.kategoria)) groups.set(row.kategoria, { nazwa: row.kategoria, rows: [], plan: 0, wydane: 0, przyjete: 0, scanned: 0 });
      const group = groups.get(row.kategoria);
      group.rows.push(row);
      group.plan += row.plan;
      group.wydane += row.wydane;
      group.przyjete += row.przyjete;
      group.scanned += row.scanned;
    });
    return Array.from(groups.values());
  }, [plannedRows]);

  const activeCategoryIds = useMemo(() => {
    if (activeSub) return descendantsOf(activeSub, equipmentCategoryById);
    if (activeRoot && activeRoot !== 'all') return descendantsOf(activeRoot, equipmentCategoryById);
    return new Set<string>();
  }, [activeRoot, activeSub, equipmentCategoryById]);

  const activeRootObj = useMemo(() => activeRoot && activeRoot !== 'all' ? equipmentCategoryById.get(String(activeRoot)) : null, [activeRoot, equipmentCategoryById]);

  const visibleModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models
      .filter((m: any) => !isCaseRow(m))
      .map((m: any) => {
        const catId = modelCategoryId(m);
        const path = catId ? categoryPath(catId, equipmentCategoryById) : '';
        return { ...m, kategoria_id: catId, kategoria_nazwa: path || m.kategoria_nazwa || m.kategoria?.nazwa || 'Bez kategorii' };
      })
      .filter((m: any) => activeRoot === 'all' || activeCategoryIds.has(String(m.kategoria_id)))
      .filter((m: any) => !q || `${m.nazwa || ''} ${m.kategoria_nazwa || ''}`.toLowerCase().includes(q))
      .sort((a: any, b: any) => String(a.kategoria_nazwa || '').localeCompare(String(b.kategoria_nazwa || ''), 'pl') || String(a.nazwa || '').localeCompare(String(b.nazwa || ''), 'pl'));
  }, [models, activeRoot, activeCategoryIds, query, equipmentCategoryById]);

  const visibleInstances = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((x: any) => isEquipmentInstance(x) || isZestawRow(x))
      .map((x: any) => ({
        ...x,
        rowType: 'egzemplarz',
        nazwa_wiersza: x.nazwa || x.model?.nazwa,
        kategoria_nazwa: x.model?.kategoria?.nazwa || 'Bez kategorii',
        kod: x.kod_kreskowy || x.zewnetrzny_kod_kreskowy || x.zewnetrzny_qr_kod || x.qr_kod || x.sn || '',
      }))
      .filter((x: any) => !q || `${x.nazwa_wiersza || ''} ${x.model?.nazwa || ''} ${x.kategoria_nazwa || ''} ${x.kod || ''} ${x.sn || ''}`.toLowerCase().includes(q))
      .slice(0, 120);
  }, [items, query]);

  function changeQty(model: any, value: string) {
    const qty = Math.max(0, Number(value || 0) || 0);
    setPlanQty((prev) => ({ ...prev, [String(model.id)]: String(qty) }));
  }

  function stepQty(model: any, delta: number) {
    const current = Number(planQty[String(model.id)] || 0) || 0;
    changeQty(model, String(Math.max(0, current + delta)));
  }

  async function handleAddBundle(e: any) {
    e.preventDefault();
    const bundle = bundles.find(b => String(b.id) === String(bundleForm.id_pakietu));
    if (!bundle) return;
    const mult = Number(bundleForm.mnoznik) || 1;
    const newPlanQty = { ...planQty };
    (bundle.pozycje || []).forEach((p: any) => {
       const modelId = p.id_modelu;
       const current = Number(newPlanQty[String(modelId)] || 0);
       newPlanQty[String(modelId)] = String(current + Number(p.ilosc || 1) * mult);
    });
    setPlanQty(newPlanQty);
    setShowBundlePicker(false);
    setBundleForm({ id_pakietu: '', mnoznik: 1 });
    setShowEditor(true);
    setNotice(`Dodano pakiet "${bundle.nazwa}" x${mult} do koszyka planu. Pamiętaj, aby na dole zapisać cały plan!`);
  }

  async function savePlan() {
    setError('');
    setNotice('');
    try {
      const pozycje = Object.entries(planQty)
        .map(([id, qty]) => ({ id_modelu: Number(id), ilosc: Number(qty || 0) }))
        .filter((p) => p.id_modelu && p.ilosc > 0);
      await api.post(`/api/magazyn/wynajmy/${rentalId}/sprzet`, { replace: true, pozycje });
      setShowEditor(false);
      setNotice('Zapisano plan sprzętu. Wydanie robisz później przez skanowanie konkretnych egzemplarzy i kontenerów.');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się zapisać planu sprzętu.');
    }
  }

  function normalizeDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {
    if (isQuantityOnly(row)) {
      return {
        source,
        rowType: 'ilosciowy_model',
        quantityOnly: true,
        id_modelu: row.id_modelu || row.model?.id || row.id,
        id_egzemplarza: null,
        nazwa: row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy',
        nazwa_modelu: row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy',
        numer_egzemplarza: '',
        kategoria: categoryOf(row),
        kod: row.kod || row.kod_kreskowy || row.model?.kod_kreskowy || row.model?.kod || '',
        ilosc: Number(row.ilosc || 1),
        jednostka: row.jednostka || row.model?.jednostka || 'szt.',
        uwagi: row.uwagi || 'Sprzęt ilościowy bez egzemplarzy',
      };
    }
    const egz = row.egzemplarz || row;
    const model = row.model || row.egzemplarz?.model;
    const instanceNo = numberOf(row);
    const baseName = model?.nazwa || row.nazwa_modelu || egz.model?.nazwa || row.nazwa || 'Sprzęt';
    return {
      source,
      rowType: 'egzemplarz',
      id_modelu: row.id_modelu || model?.id || egz.id_modelu,
      id_egzemplarza: row.id_egzemplarza || egz.id,
      nazwa: [isZestawRow(row) ? `[ZESTAW] ${baseName}` : baseName, egz.nazwa && egz.nazwa !== model?.nazwa ? egz.nazwa : null, instanceNo ? `nr ${instanceNo}` : null].filter(Boolean).join(' · '),
      nazwa_modelu: baseName,
      numer_egzemplarza: instanceNo,
      kategoria: categoryOf(row),
      kod: row.kod || egz.kod_kreskowy || egz.zewnetrzny_kod_kreskowy || egz.zewnetrzny_qr_kod || egz.qr_kod || egz.sn || '',
      ilosc: 1,
      uwagi: row.uwagi || '',
    };
  }

  function addDocumentItemsBulk(rows: any[], source: 'scan' | 'manual' = 'manual', sourceLabel = '', scannedContainer: any = null) {
    const normalized = rows
      .map((row: any) => {
        const item = normalizeDocumentItem(row, source);
        const meta = scannedContainer || row.system_case_scan || row.case_scan || null;
        return meta ? { ...item, system_case_scan: meta, id_zeskanowanego_case: meta.id, nazwa_zeskanowanego_case: meta.nazwa } : item;
      })
      .filter((item: any) => item.id_modelu);

    if (!normalized.length) {
      setError('Nie znaleziono poprawnych elementów sprzętu do dodania na dokument.');
      return;
    }

    setDocItems((prev) => {
      const existingIds = new Set(prev.map((p: any) => Number(p.id_egzemplarza)).filter(Boolean));
      const toAdd: any[] = [];
      for (const item of normalized) {
        if (item.id_egzemplarza) {
          const id = Number(item.id_egzemplarza);
          if (existingIds.has(id)) continue;
          existingIds.add(id);
        }
        toAdd.push(item);
      }
      const skipped = normalized.length - toAdd.length;
      if (!toAdd.length) {
        setNotice(sourceLabel ? `${sourceLabel}: wszystkie pozycje ze środka są już w koszyku.` : 'Ten sprzęt jest już w koszyku dokumentu.');
        return prev;
      }
      setNotice(sourceLabel ? `${sourceLabel}` : `Dodano ${toAdd.length} elementów${skipped ? `, pominięto duplikaty: ${skipped}` : ''}.`);
      return [...prev, ...toAdd];
    });
  }

  function addQuantityDocumentItem(row: any, source: 'scan' | 'manual' = 'scan') {
    const modelId = Number(row.id_modelu || row.model?.id || row.id);
    if (!modelId) {
      setError('Nie udało się rozpoznać modelu ilościowego.');
      return;
    }
    const name = row.nazwa_modelu || row.nazwa || row.model?.nazwa || 'Sprzęt ilościowy';
    const available = Number(row.ilosc_dostepna || row.ilosc_magazynowa || row.model?.ilosc_magazynowa || 0);
    const unit = row.jednostka || row.model?.jednostka || 'szt.';
    const answer = window.prompt(`Ile sztuk wydać/przyjąć?\n${name}${available ? `\nDostępnie w magazynie: ${available} ${unit}` : ''}`, '1');
    if (answer === null) {
      setNotice('Anulowano dodawanie sprzętu ilościowego.');
      return;
    }
    const requested = Number(String(answer).replace(',', '.'));
    const suggested = Math.max(0, available ? Math.min(available, requested) : requested);
    if (!Number.isFinite(suggested) || suggested <= 0) {
      setError('Podaj ilość większą od 0.');
      return;
    }
    const item = normalizeDocumentItem({ ...row, rowType: 'ilosciowy_model', quantityOnly: true, id_modelu: modelId, id: modelId, ilosc: suggested, jednostka: unit }, source);
    setDocItems((prev) => {
      const idx = prev.findIndex((p: any) => isQuantityOnly(p) && Number(p.id_modelu) === modelId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ilosc: Number(next[idx].ilosc || 0) + suggested };
        return next;
      }
      return [...prev, item];
    });
    setNotice(`Dodano ${suggested} ${unit} · ${name}.`);
  }

  function quantityRowSelected(row: any) { 
    const modelId = Number(row?.id_modelu); 
    if (!modelId) return false; 
    return docItems.some((p: any) => isQuantityOnly(p) && Number(p.id_modelu) === modelId); 
  }

  function toggleQuantityRowWithoutScan(row: any, checked: boolean) {
    setError('');
    setNotice('');
    const modelId = Number(row?.id_modelu);
    if (!modelId) { setError('Nie udało się rozpoznać modelu ilościowego.'); return; }
    if (!checked) {
      setDocItems((prev) => prev.filter((p: any) => !(isQuantityOnly(p) && Number(p.id_modelu) === modelId)));
      setNotice(`Usunięto ${row.nazwa || 'sprzęt ilościowy'} z aktualnego dokumentu.`);
      return;
    }
    const amount = missingAfterScan(row);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice(`${row.nazwa || 'Ten model'} nie ma już brakujących sztuk do ${mode === 'wydanie' ? 'wydania' : 'przyjęcia'}.`); return; }
    const model = modelById.get(String(modelId)) || {};
    const unit = row.jednostka || model.jednostka || 'szt.';
    const item = normalizeDocumentItem({ ...model, rowType: 'ilosciowy_model', quantityOnly: true, id: modelId, id_modelu: modelId, nazwa: row.nazwa || model.nazwa, nazwa_modelu: row.nazwa || model.nazwa, kategoria: row.kategoria, kod: row.kod || model.kod_kreskowy || model.kod || '', ilosc: amount, jednostka: unit, uwagi: `${mode === 'wydanie' ? 'Wydanie' : 'Przyjęcie'} sprzętu ilościowego bez skanowania`, }, 'manual');
    setDocItems((prev) => {
      const withoutThisModel = prev.filter((p: any) => !(isQuantityOnly(p) && Number(p.id_modelu) === modelId));
      return [...withoutThisModel, { ...item, source: 'checkbox' }];
    });
    setNotice(`${mode === 'wydanie' ? 'Dodano do wydania' : 'Dodano do przyjęcia'} ${amount} ${unit} · ${row.nazwa || model.nazwa || 'sprzęt ilościowy'}.`);
  }

  function addDocumentItem(row: any, source: 'scan' | 'manual' = 'manual') {
    setError('');
    setNotice('');
    
    if (isQuantityOnly(row)) { 
      addQuantityDocumentItem(row, source); 
      return; 
    }
    
    if (isZestawRow(row)) {
      addDocumentItemsBulk([row], source, 'Zeskanowano zestaw jako spójną pozycję');
      return;
    }

    if (isCaseRow(row)) {
      const contents = (row.zawartosc_case || row.contents || []).filter((child: any) => !isCaseRow(child) && (isEquipmentInstance(child) || isZestawRow(child)));
      if (!contents.length) { 
        setError('Ten case jest pusty. Zeskanowane opakowanie musi zawierać przypisany sprzęt.'); 
        return; 
      }
      const label = row.nazwa || row.nazwa_modelu || row.kod || `kontener #${row.id || row.id_egzemplarza || ''}`;
      addDocumentItemsBulk(contents, source, `Rozpakowano zawartość case'a: ${label}`, { id: row.id || row.id_egzemplarza, nazwa: label });
      return;
    }

    if (!isEquipmentInstance(row)) { 
      setError('Wydanie/przyjęcie wymaga użycia kodów przypisanych do fizycznych egzemplarzy z bazy.'); 
      return; 
    }
    
    addDocumentItemsBulk([row], source);
  }

  function focusScanInput() {
    scanInputRef.current?.focus();
    scanInputRef.current?.select();
  }

  async function scan() {
    const code = scanCode.trim();
    if (!code) {
      focusScanInput();
      setNotice('Wpisz albo zeskanuj kod w polu tekstowym i naciśnij Enter.');
      return;
    }
    setError('');
    setNotice('');

    try {
      const response = await api.get(`/api/magazyn/skan?kod=${encodeURIComponent(code)}`);
      addDocumentItem(response.data, 'scan');
      setScanCode('');
      setTimeout(focusScanInput, 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || `Nie znaleziono sprzętu dla kodu: ${code}`);
      setTimeout(focusScanInput, 0);
    }
  }

  async function createDocument(type: 'wydanie' | 'przyjecie') {
    if (!docItems.length) {
      return alert('Koszyk WZ/PZ jest pusty. Zeskanuj egzemplarze, skrzynie albo sprzęt ilościowy.');
    }
    setError('');
    setSavingDocs(true);
    try {
      const response = await api.post('/api/magazyn/dokumenty', {
        typ: type,
        id_wynajmu: rentalId,
        osoba_odbierajaca: docForm.osoba_odbierajaca,
        podpis_odbierajacego: docForm.podpis_odbierajacego,
        uwagi: docForm.uwagi || `Dokument ${type === 'wydanie' ? 'wydania' : 'przyjęcia'} dla wynajmu: ${rentalName}`,
        pozycje: docItems.map((p) => ({ 
          ...p, 
          ilosc: Number(p.ilosc || 1), 
          status: type === 'wydanie' ? 'wydany' : 'przyjety' 
        })),
      });

      setDocItems([]);
      await load();
      router.push(`/dashboard/warehouse/documents/${response.data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się wygenerować dokumentu.');
    } finally {
      setSavingDocs(false);
    }
  }

  function countAfterScan(row: any) { return mode === 'wydanie' ? row.wydane + row.scanned : row.przyjete + row.scanned; }
  function missingAfterScan(row: any) { return mode === 'wydanie' ? Math.max(0, row.plan - row.wydane - row.scanned) : Math.max(0, row.wydane - row.przyjete - row.scanned); }

  const plannedTotal = plannedRows.reduce((s, r) => s + r.plan, 0);
  const issuedTotal = plannedRows.reduce((s, r) => s + r.wydane, 0);
  const returnedTotal = plannedRows.reduce((s, r) => s + r.przyjete, 0);

  return <div className="space-y-6 pt-2">
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</div>}
    {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">{notice}</div>}

    <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#04e0ff]">Sprzęt wynajmu</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Plan sprzętu, wydanie i przyjęcie</h3>
          <p className="mt-1.5 max-w-3xl text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">Plan edytujesz po modelach i ilościach. Wydanie oraz przyjęcie działa na konkretnych egzemplarzach po skanie.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
          <Metric label="Plan" value={`${plannedTotal} szt.`} />
          <Metric label="Wydano" value={`${issuedTotal} szt.`} />
          <Metric label="Przyjęto" value={`${returnedTotal} szt.`} />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2.5">
          {([
            ['plan', 'Lista sprzętu (Plan)'],
            ['wydanie', 'Wydaj WZ'],
            ['przyjecie', 'Przyjmij PZ'],
          ] as const).map(([m, label]) => <button key={m} type="button" onClick={() => { setMode(m); setQuery(''); setError(''); setNotice(''); setDocItems([]); }} className={`rounded-xl px-5 py-3 text-sm font-black transition-all shadow-sm ${mode === m ? 'bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white shadow-cyan-600/20' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-cyan-300 dark:hover:border-cyan-700/50 hover:bg-cyan-50 dark:hover:bg-cyan-500/10'}`}>{label}</button>)}
        </div>
        {mode === 'plan' && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowBundlePicker(true)} className="shadow-sm"><Layers size={16} className="inline mr-1" /> Dodaj Pakiet</Button>
            <Button onClick={() => setShowEditor((v) => !v)} className="shadow-md shadow-cyan-600/20"><Plus size={16} className="inline mr-1" /> {showEditor ? 'Zamknij dodawanie' : 'Dodaj / zmień plan'}</Button>
          </div>
        )}
      </div>

      {mode === 'plan' && <div className="grid gap-0 xl:grid-cols-[1fr_520px]">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Plan sprzętowy przypisany do wynajmu</h4>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Podział jak w ofertach: kategoria główna / podkategoria / model.</p>
            </div>
          </div>
          <div className="space-y-5">
            {plannedGroups.map((group: any) => <div key={group.nazwa} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 px-5 py-3.5">
                <div><p className="text-base font-black text-slate-900 dark:text-white">{group.nazwa}</p><p className="text-xs font-bold text-slate-400 dark:text-slate-500">{group.rows.length} modeli</p></div>
                <span className="rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/5 px-3 py-1.5 text-xs font-black text-slate-500 dark:text-slate-300 shadow-sm">plan {group.plan} · WZ {group.wydane} · PZ {group.przyjete}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {group.rows.map((row: any) => <div key={row.id_modelu} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_280px] md:items-center">
                  <div><p className="font-black text-slate-900 dark:text-white text-[15px]">{row.nazwa}</p><p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">model · {row.kategoria}</p></div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 dark:bg-white/5 p-2 text-center text-xs font-black border border-slate-100 dark:border-transparent"><span><b className="block text-lg text-slate-900 dark:text-white">{row.plan}</b>plan</span><span><b className="block text-lg text-emerald-600 dark:text-emerald-400">{row.wydane}</b>WZ</span><span><b className="block text-lg text-blue-600 dark:text-blue-400">{row.przyjete}</b>PZ</span></div>
                </div>)}
              </div>
            </div>)}
            {!plannedGroups.length && <p className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm font-bold text-slate-400 bg-slate-50/50 dark:bg-black/20">Brak sprzętu przypisanego do planu. Kliknij „Dodaj / zmień plan sprzętowy”.</p>}
          </div>
        </div>

        {showEditor && <aside className="border-l border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-6 shadow-inner">
          <div className="sticky top-4 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                <div><h4 className="text-lg font-black text-slate-900 dark:text-white">Dodaj / zmień sprzęt w planie</h4><p className="text-xs font-bold text-slate-500 mt-1">Wybierz kategorię główną, potem podkategorię i wpisz ilość przy modelu.</p></div>
                <button type="button" onClick={() => setShowEditor(false)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition shadow-sm">Zamknij</button>
              </div>

              <Field label="Szukaj modelu w bazie sprzętowej"><div className="relative"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={17}/><input className={`${inputClass} pl-11 py-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="projektor, monitor, kabel..." /></div></Field>

              <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-transparent p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Filtry / Kategorie główne</p>
                <div className="flex max-h-[140px] flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  <button type="button" onClick={() => { setActiveRoot('all'); setActiveSub(''); }} className={`rounded-xl px-3 py-2 text-xs font-black transition shadow-sm ${activeRoot === 'all' ? 'bg-[#04e0ff] text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-cyan-300'}`}>Wszystkie</button>
                  {equipmentCategoryRoots.map((root: any) => <button key={root.id} type="button" onClick={() => { setActiveRoot(String(root.id)); setActiveSub(''); }} className={`rounded-xl px-3 py-2 text-xs font-black transition shadow-sm ${activeRoot === String(root.id) ? 'bg-[#04e0ff] text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-cyan-300'}`}>{root.nazwa} <span className="opacity-60 font-bold ml-1">{totalForEquipmentCategory(String(root.id))}</span></button>)}
                </div>
              </div>

              {activeRootObj?.dzieci?.length > 0 && <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-transparent p-4 animate-fade-in-up">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Podkategorie ({activeRootObj.nazwa})</p>
                <div className="flex max-h-[160px] flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  <button type="button" onClick={() => setActiveSub('')} className={`rounded-xl px-3 py-2 text-xs font-black transition shadow-sm ${!activeSub ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-cyan-300'}`}>Wszystkie w dziale</button>
                  {activeRootObj.dzieci.map((child: any) => <button key={child.id} type="button" onClick={() => setActiveSub(String(child.id))} className={`rounded-xl px-3 py-2 text-xs font-black transition shadow-sm ${activeSub === String(child.id) ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-cyan-300'}`}>{child.nazwa} <span className="opacity-60 font-bold ml-1">{totalForEquipmentCategory(String(child.id))}</span></button>)}
                </div>
              </div>}
            </div>

            <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {visibleModels.map((model: any) => {
                const qty = Number(planQty[String(model.id)] || 0) || 0;
                return <div key={model.id} className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 ${qty > 0 ? 'border-[#04e0ff] ring-1 ring-[#04e0ff]/30 shadow-md' : 'border-slate-200 dark:border-white/10 hover:border-cyan-300 dark:hover:border-cyan-700'}`}>
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-black text-slate-400 border border-slate-200 dark:border-white/10">
                      {model.zdjecie ? <img src={model.zdjecie} alt="" className="h-full w-full object-cover" /> : <Box size={22} className="opacity-50" />}
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-black text-slate-900 dark:text-white leading-tight">{model.nazwa}</p>
                      <p className="truncate text-[11px] font-bold text-slate-400 mt-1">{model.kategoria_nazwa}</p>
                      <p className="mt-1.5 text-[11px] font-black text-[#04e0ff]">Dostępne w magazynie: <span className="text-slate-800 dark:text-slate-200 ml-1">{model.dostepnych ?? model.dostepne ?? model.ilosc_dostepna ?? model.na_stanie ?? 0}</span></p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-[44px_1fr_44px] gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
                    <button type="button" onClick={() => stepQty(model, -1)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-lg font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition shadow-sm">-</button>
                    <input type="number" min={0} className={`${inputClass} text-center text-lg font-black !py-1`} value={planQty[String(model.id)] ?? '0'} onChange={(e) => changeQty(model, e.target.value)} />
                    <button type="button" onClick={() => stepQty(model, 1)} className="rounded-xl bg-gradient-to-br from-[#04e0ff] to-blue-600 text-lg font-black text-white hover:scale-105 transition shadow-sm">+</button>
                  </div>
                </div>;
              })}
              {!visibleModels.length && <p className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-sm font-bold text-slate-400 bg-white dark:bg-slate-900">Brak modeli w tej kategorii. Wyszukaj ponownie.</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><p className="font-black text-slate-900 dark:text-white">Koszyk Planu</p><span className="rounded-full bg-cyan-100 dark:bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">{Object.values(planQty).filter((v) => Number(v) > 0).length} modeli wybrano</span></div>
              <div className="max-h-[180px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(planQty).filter(([, qty]) => Number(qty) > 0).map(([id, qty]) => {
                  const model = models.find((m: any) => String(m.id) === String(id));
                  return <div key={id} className="flex justify-between items-center rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-sm font-bold border border-slate-100 dark:border-transparent"><span className="truncate pr-4 text-slate-700 dark:text-slate-300">{model?.nazwa || `Model #${id}`}</span><b className="text-slate-900 dark:text-white">x{qty}</b></div>;
                })}
              </div>
              <div className="mt-5 flex gap-2 pt-4 border-t border-slate-100 dark:border-white/5"><button type="button" onClick={load} className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition shadow-sm">Cofnij</button><button type="button" onClick={savePlan} className="flex-1 rounded-xl bg-gradient-to-r from-[#04e0ff] to-blue-600 px-4 py-3 text-sm font-black text-white hover:opacity-90 transition shadow-md shadow-cyan-500/20">Zapisz cały plan</button></div>
            </div>
          </div>
        </aside>}
      </div>}

      {mode !== 'plan' && <div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr] min-w-0">
        <div className="p-6 min-w-0">
          <div className="mb-6 rounded-2xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50 dark:bg-cyan-500/10 p-5 shadow-sm min-w-0">
            <p className="text-sm font-bold leading-relaxed text-cyan-900 dark:text-cyan-100">{mode === 'wydanie' ? 'Skanuj egzemplarze albo kody kontenerów aby je wydać (WZ). Sprzęt ilościowy możesz zaznaczyć checkboxem by pobrać brakującą ilość sztuk bez ręcznego wpisywania w skaner.' : 'Skanuj zwracane egzemplarze i kontenery (PZ). Sprzęt ilościowy możesz zaznaczyć checkboxem by zwrócić brakującą na magazynie ilość sztuk bez skanera.'}</p>
          </div>
          <div className="space-y-5 min-w-0">
            {plannedGroups.map((group: any) => <div key={group.nazwa} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
              <div className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 px-5 py-3.5"><b className="text-slate-900 dark:text-white">{group.nazwa}</b></div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {group.rows.map((row: any) => {
                  const after = countAfterScan(row);
                  const missing = missingAfterScan(row);
                  const base = mode === 'wydanie' ? row.plan : row.wydane;
                  const percent = base > 0 ? Math.min(100, Math.round((after / base) * 100)) : 100;
                  return <div key={row.id_modelu} className="px-5 py-4 min-w-0">
                    <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-center min-w-0">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white text-[15px] truncate">{row.nazwa}</p>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 truncate">{mode === 'wydanie' ? `Plan: ${row.plan} szt. · Wydano na zewnątrz: ${row.wydane} szt. · Skan w koszyku: ${row.scanned} szt.` : `Wydano w teren: ${row.wydane} szt. · Przyjęto już: ${row.przyjete} szt. · Skan w koszyku: ${row.scanned} szt.`}</p>
                        {row.quantityOnly && <label className="mt-3 inline-flex cursor-pointer items-center gap-3 rounded-xl border border-cyan-100 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-4 py-2.5 text-xs font-black text-cyan-900 dark:text-cyan-100 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition shadow-sm max-w-full">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-[#04e0ff] focus:ring-[#04e0ff] cursor-pointer shrink-0"
                            checked={quantityRowSelected(row)}
                            onChange={(e) => toggleQuantityRowWithoutScan(row, e.target.checked)}
                          />
                          <span className="truncate">{mode === 'wydanie' ? 'Wydaj brakujące na sztuki' : 'Przyjmij brakujące na sztuki'}</span>
                          <span className="rounded-full bg-white dark:bg-black/20 border border-slate-200 dark:border-transparent px-2.5 py-1 text-cyan-700 dark:text-[#04e0ff] shadow-sm ml-auto shrink-0">{quantityRowSelected(row) ? `${row.scanned} ${row.jednostka || 'szt.'}` : `${missing} ${row.jednostka || 'szt.'}`}</span>
                        </label>}
                      </div>
                      <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-transparent p-4 shadow-inner min-w-0">
                        <div className="mb-2.5 flex justify-between text-xs font-black"><span>{mode === 'wydanie' ? 'Status wydania' : 'Status przyjęcia'}: {after}/{base}</span><span className={missing ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}>{missing ? `Brakuje jeszcze ${missing}` : 'Wszystko OK'}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ${missing ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} style={{ width: `${percent}%` }} /></div>
                      </div>
                    </div>
                  </div>;
                })}
              </div>
            </div>)}
          </div>
        </div>
        <div className="border-l border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/20 p-6 shadow-inner min-w-0 flex flex-col">
          <div className="sticky top-4 space-y-5 min-w-0">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-w-0">
              <Field label="Skanuj kod kreskowy / QR / SN / Case z Naklejki">
                 <div className="flex gap-2">
                   <input ref={scanInputRef} className={`${inputClass} py-3 text-lg font-bold shadow-inner min-w-0`} autoFocus value={scanCode} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setScanCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scan(); } }} placeholder="Kliknij Skanuj, skanuj kod i wciśnij Enter..."/>
                   <Button onClick={scan} className="px-6 shadow-md shadow-cyan-600/20 shrink-0">{scanCode.trim() ? 'Dodaj skan' : 'Skanuj'}</Button>
                 </div>
              </Field>
              <p className="mt-3 text-xs font-bold text-slate-400 leading-relaxed">Zeskanowanie kontenera (Opakowanie/Case) automatycznie rozpakuje go i doda na listę ukryty w nim sprzęt. Zeskanowanie Zestawu(Racka) doda go jako spójną całość. Sprzęt ilościowy dodasz skanem modelu lub checkboxem po lewej.</p>
            </div>
            
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-w-0">
              <div className="mb-4 flex items-center justify-between min-w-0"><h4 className="text-lg font-black text-slate-900 dark:text-white truncate pr-2">Koszyk Skanera (Teraz)</h4><span className="rounded-full bg-cyan-100 dark:bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-[#04e0ff] border border-cyan-200 dark:border-cyan-500/20 shrink-0">{docItems.reduce((s: number, p: any) => s + Number(p.ilosc || 1), 0)} szt.</span></div>
              <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 custom-scrollbar min-w-0">
                {docItems.map((p, idx) => <div key={`${p.id_egzemplarza || p.id_modelu}-${idx}`} className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3 flex justify-between gap-3 group transition-colors hover:border-cyan-300 dark:hover:border-cyan-700 min-w-0">
                  <div className="min-w-0">
                     <b className="text-[13px] text-slate-900 dark:text-white block truncate">{p.nazwa}</b>
                     <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">
                        {p.kategoria} · {isQuantityOnly(p) ? <span className="text-[#04e0ff]">{p.ilosc || 1} {p.jednostka || 'szt.'}</span> : `${p.nazwa_zeskanowanego_case ? `w: ${p.nazwa_zeskanowanego_case} · ` : ''}${p.kod || '-'}` } {p.kod && isQuantityOnly(p) ? ` · kod ${p.kod}` : ''}
                     </p>
                  </div>
                  <button onClick={() => setDocItems((s) => s.filter((_, i) => i !== idx))} className="font-black text-slate-400 hover:text-red-500 bg-white dark:bg-transparent rounded-lg px-2.5 py-1.5 h-fit shadow-sm border border-slate-200 dark:border-transparent transition flex items-center gap-1.5 opacity-0 group-hover:opacity-100 shrink-0" title="Cofnij skan">
                    <RotateCcw size={14}/> Cofnij
                  </button>
                </div>)}
                {!docItems.length && <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-sm font-bold text-slate-400 bg-white dark:bg-transparent">Rozpocznij skanowanie fizycznego sprzętu albo zaznacz checkbox przy sprzęcie ilościowym — ta lista zaktualizuje się automatycznie.</div>}
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-w-0">
              <Field label="Wyszukaj i dodaj egzemplarz ręcznie (Awaryjnie)"><div className="relative min-w-0"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input className={`${inputClass} pl-9 min-w-0`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="nazwa, numer boczny, kod kreskowy..." /></div></Field>
              <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1 custom-scrollbar min-w-0">
                {visibleInstances.map((r: any) => <button key={r.id} type="button" onClick={() => addDocumentItem(r, 'manual')} className="w-full rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3 text-left hover:border-cyan-300 dark:hover:border-cyan-700 transition shadow-sm min-w-0">
                  <b className="text-[13px] text-slate-900 dark:text-white block truncate">{r.model?.nazwa || r.nazwa_wiersza}</b>
                  <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">{r.nazwa_wiersza} · S/N: {r.kod || '-'}</p>
                </button>)}
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-w-0">
              <div className="rounded-xl border border-cyan-100 dark:border-cyan-500/20 bg-cyan-50 dark:bg-cyan-500/10 p-3.5 text-xs font-bold text-cyan-900 dark:text-cyan-100 mb-4 leading-relaxed">
                Dokument magazynowy podpisze automatycznie w systemie aktualnie zalogowany użytkownik. Na wygenerowanym potwierdzeniu PDF będzie widoczny cyfrowy ślad audytowy transakcji.
              </div>
              <Field label="Dodatkowe uwagi dla magazyniera do wpisania na dokument WZ/PZ"><textarea className={`${inputClass} resize-none min-h-[80px] min-w-0`} value={docForm.uwagi || ''} onChange={(e) => setDocForm({ ...docForm, uwagi: e.target.value })} placeholder="opcjonalne uwagi..."/></Field>
              <button type="button" disabled={!docItems.length || savingDocs} onClick={() => createDocument(mode)} className={`mt-4 w-full rounded-xl px-5 py-3.5 text-sm font-black text-white disabled:opacity-50 transition shadow-lg ${mode === 'wydanie' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30 hover:opacity-90' : 'bg-gradient-to-r from-[#04e0ff] to-blue-600 shadow-[#04e0ff]/30 hover:opacity-90'} flex items-center justify-center gap-2`}>
                {savingDocs ? <Loader2 size={18} className="animate-spin shrink-0"/> : <FileText size={18} className="shrink-0" />} <span className="truncate">{savingDocs ? 'Generowanie...' : mode === 'wydanie' ? 'Zatwierdź i Wystaw WZ' : 'Zatwierdź i Wystaw PZ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>}
    </section>

    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm mt-8">
      <h3 className="mb-4 text-xl font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-4">Wygenerowane dokumenty magazynowe dla tego wynajmu</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data.dokumenty || []).map((d: any) => <a key={d.id} href={`/dashboard/warehouse/documents/${d.id}`} className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5 hover:border-[#04e0ff] hover:bg-white dark:hover:bg-white/10 transition shadow-sm group">
           <div className="flex items-center justify-between mb-2">
              <b className="text-lg font-black text-slate-900 dark:text-white group-hover:text-[#04e0ff] transition">{d.numer}</b>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${d.typ === 'wydanie' ? 'bg-orange-100 text-orange-700' : d.typ === 'przyjecie' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{d.typ}</span>
           </div>
           <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5"><Calendar size={13}/> {new Date(d.data_operacji).toLocaleString('pl-PL')}</p>
           <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5"><Box size={13}/> Załączono sztuk egzemplarzy: {d.pozycje?.length || 0}</p>
        </a>)}
        {!data.dokumenty?.length && <div className="col-span-full p-10 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center font-bold text-slate-400 bg-slate-50/50 dark:bg-transparent">Brak wystawionych dokumentów logistycznych w systemie. Zeskanuj i wydaj pierwszy sprzęt!</div>}
      </div>
    </div>
    
    {/* MODAL PAKIETÓW */}
    {showBundlePicker && (
      <SimpleModal title="Dodaj gotowy pakiet do planu" onClose={() => setShowBundlePicker(false)}>
        <form onSubmit={handleAddBundle} className="space-y-4">
           <Field label="Wybierz pakiet z szablonów systemowych">
             <select className={inputClass} value={bundleForm.id_pakietu} onChange={e => setBundleForm({...bundleForm, id_pakietu: e.target.value})} required>
                <option value="">Wybierz zdefiniowany pakiet...</option>
                {bundles.map(b => <option key={b.id} value={b.id}>{b.nazwa} ({b._count?.pozycje || 0} elementów)</option>)}
             </select>
           </Field>
           <Field label="Mnożnik (Ile pakietów dodać?)">
             <input type="number" min="1" step="1" className={inputClass} value={bundleForm.mnoznik} onChange={e => setBundleForm({...bundleForm, mnoznik: Number(e.target.value)})} required />
           </Field>
           <p className="text-xs font-bold text-slate-500 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">Wszystkie pozycje znajdujące się w szablonie wybranego pakietu zostaną automatycznie rozwinięte i dodane jako indywidualne linie sprzętowe do Twojego koszyka planu wynajmu, pomnożone przez wskazany mnożnik.</p>
           <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
             <Button variant="secondary" type="button" onClick={() => setShowBundlePicker(false)}>Anuluj</Button>
             <Button type="submit"><Layers size={16} className="inline mr-1.5"/> Dodaj do planu</Button>
           </div>
        </form>
      </SimpleModal>
    )}
  </div>;
}