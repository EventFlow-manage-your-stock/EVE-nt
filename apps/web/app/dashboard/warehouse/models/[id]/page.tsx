'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Check, ImageIcon, Pencil, Plus, QrCode, Trash2, X, Download, FileText, Paperclip, Box, AlertTriangle, ShieldAlert } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../../components/ProductUI';
import { DataTable } from '../../../../../components/DataTable';
import { SimpleModal } from '../../../../../components/SimpleModal';
import { openLabelsPage } from '../../../../../lib/labels';

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isQuantityModel(formOrModel: any) {
  return formOrModel?.sprzet_ilosciowy === true || formOrModel?.tryb_ewidencji === 'ilosciowe' || formOrModel?.typ_sprzetu === 'ilosciowe';
}

function normalizeModelPayload(form: any) {
  const quantity = isQuantityModel(form);
  return {
    ...form,
    sprzet_ilosciowy: quantity,
    tryb_ewidencji: quantity ? 'ilosciowe' : 'egzemplarze',
    ilosc_magazynowa: quantity ? Number(form.ilosc_magazynowa || 0) : 0,
    jednostka: form.jednostka || 'szt.',
    kod_kreskowy: quantity ? (form.kod_kreskowy || '') : '',
  };
}

function applyQuantityMode(current: any, checked: boolean) {
  return {
    ...current,
    sprzet_ilosciowy: checked,
    tryb_ewidencji: checked ? 'ilosciowe' : 'egzemplarze',
    typ_sprzetu: current?.typ_sprzetu === 'opakowanie' ? 'opakowanie' : 'sprzet',
    ilosc_magazynowa: checked ? (current?.ilosc_magazynowa || 0) : 0,
    jednostka: current?.jednostka || 'szt.',
    kod_kreskowy: checked ? (current?.kod_kreskowy || '') : '',
  };
}

function normalizeForm(model: any) {
  return {
    nazwa: model?.nazwa || '',
    id_kategorii: model?.id_kategorii || model?.kategoria?.id || '',
    producent: model?.producent || '',
    typ_sprzetu: model?.typ_sprzetu || 'sprzet',
    wartosc_domyslna_egzemplarza: model?.wartosc_domyslna_egzemplarza || model?.wartosc || '',
    wartosc: model?.wartosc_domyslna_egzemplarza || model?.wartosc || '',
    miejsce_w_mag: model?.miejsce_w_mag || '',
    opis: model?.opis || '',
    notatki_wewnetrzne: model?.notatki_wewnetrzne || '',
    szerokosc: model?.szerokosc || '',
    wysokosc: model?.wysokosc || '',
    glebokosc: model?.glebokosc || '',
    objetosc: model?.objetosc || '',
    waga: model?.waga || '',
    pobor_pradu: model?.pobor_pradu || '',
    zdjecie: model?.zdjecie || '',
    tryb_ewidencji: model?.tryb_ewidencji || 'egzemplarze',
    sprzet_ilosciowy: model?.tryb_ewidencji === 'ilosciowe' || model?.typ_sprzetu === 'ilosciowe',
    ilosc_magazynowa: model?.ilosc_magazynowa ?? 0,
    jednostka: model?.jednostka || 'szt.',
    kod_kreskowy: model?.kod_kreskowy || '',
  };
}

export default function ModelDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [model, setModel] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [busy, setBusy] = useState<any[]>([]);
  const [magazyny, setMagazyny] = useState<any[]>([]);
  const [itemForm, setItemForm] = useState<any>({});
  const [edit, setEdit] = useState(searchParams?.get('edit') === '1');
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'egzemplarze' | 'zalaczniki'>('egzemplarze');

  async function load() {
    const [m, mag, cats] = await Promise.all([
      api.get(`/api/magazyn/modele/${id}`),
      api.get('/api/magazyn/slowniki/magazyny').catch(() => ({ data: [] })),
      api.get('/api/magazyn/kategorie/plasko').catch(() => api.get('/api/magazyn/kategorie').catch(() => ({ data: [] }))),
    ]);
    setModel(m.data);
    setForm(normalizeForm(m.data));
    setMagazyny(mag.data || []);
    setCategories(cats.data || []);
  }

  useEffect(() => { load(); }, [id]);

  async function loadCalendar() {
    const r = await api.get(`/api/magazyn/modele/${id}/zajetosc`).catch(() => ({ data: [] }));
    setBusy(r.data || []);
    setShowCalendar(true);
  }

  const egzemplarze = model?.egzemplarze || [];
  
  // Statystyki magazynowe
  const stockStats = useMemo(() => {
    if (!model) return { total: 0, available: 0, issued: 0, service: 0 };
    const quantity = isQuantityModel(model);
    if (quantity) {
      const total = Number(model.ilosc_magazynowa || 0);
      return { total, available: total, issued: 0, service: 0 };
    }
    const total = egzemplarze.length;
    const service = egzemplarze.filter((e: any) => e.status_serwisowy && e.status_serwisowy !== 'Działa' && e.status_serwisowy !== 'Naprawiony' && e.status_serwisowy !== 'Wydany').length;
    const issued = egzemplarze.filter((e: any) => e.status_serwisowy === 'Wydany').length;
    const available = Math.max(0, total - service - issued);
    return { total, available, issued, service };
  }, [model, egzemplarze]);

  const nextNumber = useMemo(() => {
    const nums = egzemplarze.map((e: any) => Number(e.numer_egzemplarza || e.numer_urzadzenia)).filter((n: number) => !Number.isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 1;
  }, [egzemplarze]);

  function openAdd() {
    setItemForm(defaultItemForm(model, nextNumber));
    setShowAdd(true);
  }

  async function saveItem(e: any) {
    e.preventDefault();
    await api.post(`/api/magazyn/modele/${id}/egzemplarze`, itemForm);
    setShowAdd(false);
    await load();
  }

  async function saveModel(e?: any) {
    e?.preventDefault?.();
    if (isQuantityModel(form) && !String(form.kod_kreskowy || '').trim()) {
      alert('Sprzęt ilościowy musi posiadać kod kreskowy modelu do skanowania.');
      setEdit(true);
      return;
    }
    setSaving(true);
    try {
      const payload = normalizeModelPayload({ ...form, wartosc: form.wartosc_domyslna_egzemplarza || form.wartosc });
      await api.put(`/api/magazyn/modele/${id}`, payload);
      setEdit(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeModel() {
    if (!confirm(`Ukryć model "${model?.nazwa}" w systemie?`)) return;
    await api.delete(`/api/magazyn/modele/${id}`);
    router.push('/dashboard/warehouse/models');
  }

  async function onPhoto(file?: File | null) {
    if (!file) return;
    const dataUrl = await readImageAsDataUrl(file);
    setForm((current: any) => ({ ...current, zdjecie: dataUrl }));
  }

  if (!model) return <p className="p-8 font-bold text-slate-400">Ładowanie modelu...</p>;

  const quantityModel = isQuantityModel(form);

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle
        eyebrow="Model sprzętu"
        title={model.nazwa}
        description={quantityModel ? "Model ilościowy: stan, parametry i kod kreskowy są zapisane bezpośrednio na modelu." : "Model egzemplarzowy: cena domyślna, parametry gabarytowe oraz lista fizycznych sztuk z własnymi kodami i numerami seryjnymi."}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button>
            <Button variant="secondary" onClick={loadCalendar}><CalendarDays size={16} className="inline" /> Kalendarz</Button>
            {!quantityModel && <Button variant="secondary" onClick={() => openLabelsPage({ modelId: Number(id) })}><QrCode size={16} className="inline" /> Naklejki</Button>}
            <Button variant="secondary" onClick={() => setEdit(!edit)}>{edit ? <X size={16} className="inline" /> : <Pencil size={16} className="inline" />} {edit ? 'Anuluj edycję' : 'Edytuj model'}</Button>
            {!quantityModel && <Button onClick={openAdd}><Plus size={16} className="inline" /> Dodaj egzemplarz</Button>}
          </div>
        }
      />

      {/* METRYKI STANU MAGAZYNOWEGO */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dostępne w magazynie</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{stockStats.available} <span className="text-sm font-bold text-slate-400">{model.jednostka || 'szt.'}</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wydane na realizacje</p>
          <p className="mt-2 text-3xl font-black text-cyan-600 dark:text-[#04e0ff]">{stockStats.issued} <span className="text-sm font-bold text-slate-400">{model.jednostka || 'szt.'}</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">W serwisie / uszkodzone</p>
          <p className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-400">{stockStats.service} <span className="text-sm font-bold text-slate-400">{model.jednostka || 'szt.'}</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Całkowity stan</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{stockStats.total} <span className="text-sm font-bold text-slate-400">{model.jednostka || 'szt.'}</span></p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        {/* LEWA KOLUMNA: EDYCJA DANYCH MODELU */}
        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Parametry i dane modelu</h2>
            {edit && <Button onClick={saveModel} disabled={saving}><Check size={16} className="inline" /> {saving ? 'Zapisuję...' : 'Zapisz model'}</Button>}
          </div>

          <form onSubmit={saveModel} className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner dark:border-white/10 dark:bg-black/20">
                  {form.zdjecie ? <img src={form.zdjecie} alt={form.nazwa} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon size={54} /></div>}
                </div>
                {edit && <input type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0])} className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:font-black file:text-white" />}
                {edit && form.zdjecie && <button type="button" onClick={() => setForm({ ...form, zdjecie: '' })} className="text-xs font-black text-red-500">Usuń zdjęcie</button>}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nazwa modelu"><input disabled={!edit} className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} /></Field>
              <Field label="Kategoria"><select disabled={!edit} className={inputClass} value={form.id_kategorii || ''} onChange={e => setForm({ ...form, id_kategorii: e.target.value })}><option value="">Brak</option>{categories.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field>
              <Field label="Producent"><input disabled={!edit} className={inputClass} value={form.producent || ''} onChange={e => setForm({ ...form, producent: e.target.value })} /></Field>
              <Field label="Typ"><select disabled={!edit} className={inputClass} value={form.typ_sprzetu || 'sprzet'} onChange={e => setForm({ ...form, typ_sprzetu: e.target.value })}><option value="sprzet">Sprzęt</option><option value="opakowanie">Opakowanie (Case)</option><option value="zestaw">Zestaw (Rack)</option></select></Field>
              
              <div className="md:col-span-2 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 dark:border-cyan-500/20 dark:bg-cyan-900/10">
                <label className="flex cursor-pointer items-start gap-3 text-sm font-black text-slate-800 dark:text-slate-200">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600" checked={quantityModel} onChange={e => { setEdit(true); setForm(applyQuantityMode(form, e.target.checked)); }} />
                  <span>
                    Tryb ewidencji: Sprzęt ilościowy
                    <span className="mt-1 block text-xs font-bold text-slate-500">Zaznacz dla drobnicy, kabli i balastów wydawanych na sztuki bez indywidualnych numerów S/N.</span>
                  </span>
                </label>
              </div>

              {quantityModel && (
                <>
                  <Field label="Stan ilościowy"><input disabled={!edit} type="number" step="1" min="0" className={inputClass} value={form.ilosc_magazynowa ?? 0} onChange={e => setForm({ ...form, ilosc_magazynowa: e.target.value })} /></Field>
                  <Field label="Jednostka"><input disabled={!edit} className={inputClass} value={form.jednostka || 'szt.'} onChange={e => setForm({ ...form, jednostka: e.target.value })} /></Field>
                  <div className="md:col-span-2">
                    <Field label="Kod kreskowy modelu (Wymagany do skanowania WZ/PZ)">
                      <input disabled={!edit} required={quantityModel} className={inputClass} value={form.kod_kreskowy || ''} onChange={e => setForm({ ...form, kod_kreskowy: e.target.value })} placeholder="Kod kreskowy do skanera..." />
                    </Field>
                  </div>
                </>
              )}

              <Field label="Wartość domyślna / cena (PLN)"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.wartosc_domyslna_egzemplarza || ''} onChange={e => setForm({ ...form, wartosc_domyslna_egzemplarza: e.target.value, wartosc: e.target.value })} /></Field>
              <Field label="Miejsce w magazynie"><input disabled={!edit} className={inputClass} value={form.miejsce_w_mag || ''} onChange={e => setForm({ ...form, miejsce_w_mag: e.target.value })} placeholder="np. Regał A-3" /></Field>
              <Field label="Szerokość [cm]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.szerokosc || ''} onChange={e => setForm({ ...form, szerokosc: e.target.value })} /></Field>
              <Field label="Wysokość [cm]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.wysokosc || ''} onChange={e => setForm({ ...form, wysokosc: e.target.value })} /></Field>
              <Field label="Głębokość [cm]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.glebokosc || ''} onChange={e => setForm({ ...form, glebokosc: e.target.value })} /></Field>
              <Field label="Waga [kg]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.waga || ''} onChange={e => setForm({ ...form, waga: e.target.value })} /></Field>
              <Field label="Objętość [m³]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.objetosc || ''} onChange={e => setForm({ ...form, objetosc: e.target.value })} /></Field>
              <Field label="Pobór prądu [W]"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.pobor_pradu || ''} onChange={e => setForm({ ...form, pobor_pradu: e.target.value })} /></Field>
            </div>
            
            <Field label="Opis"><textarea disabled={!edit} className={`${inputClass} min-h-[70px] resize-none`} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field>
            <Field label="Notatka wewnętrzna"><textarea disabled={!edit} className={`${inputClass} min-h-[70px] resize-none`} value={form.notatki_wewnetrzne || ''} onChange={e => setForm({ ...form, notatki_wewnetrzne: e.target.value })} /></Field>
            
            {edit && (
              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={() => { setEdit(false); setForm(normalizeForm(model)); }}><ArrowLeft size={16} className="inline" /> Anuluj</Button>
                  <Button variant="danger" type="button" onClick={removeModel}><Trash2 size={16} className="inline" /> Usuń model</Button>
                </div>
                <Button type="submit"><Check size={16} className="inline" /> Zapisz model</Button>
              </div>
            )}
          </form>
        </Card>

        {/* PRAWA KOLUMNA: LISTA EGZEMPLARZY LUB ZAŁĄCZNIKI */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
            <button 
              onClick={() => setActiveTab('egzemplarze')} 
              className={`px-5 py-2.5 font-black text-sm rounded-xl transition ${activeTab === 'egzemplarze' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-white/10'}`}
            >
              Ewidencja sztuk fizycznych
            </button>
            <button 
              onClick={() => setActiveTab('zalaczniki')} 
              className={`px-5 py-2.5 font-black text-sm rounded-xl transition ${activeTab === 'zalaczniki' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-white/10'}`}
            >
              Załączniki i Instrukcje (S3)
            </button>
          </div>
          
          {activeTab === 'egzemplarze' && (
            <Card>
              {quantityModel ? (
                <div className="space-y-5 p-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Sprzęt ilościowy na stanie</h2>
                    <p className="text-sm font-bold text-slate-400">Ten model jest ewidencjonowany na sztuki. Skanowanie kodu modelu w oknie WZ/PZ pyta magazyniera o liczbę sztuk.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-cyan-50 p-5 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-500/30">
                      <div className="text-xs font-black uppercase text-cyan-700 dark:text-[#04e0ff]">Aktualny stan magazynowy</div>
                      <div className="text-4xl font-black text-slate-900 dark:text-white mt-1">{Number(form.ilosc_magazynowa || 0)} <span className="text-base font-bold text-slate-400">{form.jednostka || 'szt.'}</span></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-5 dark:bg-black/20 border border-slate-200 dark:border-white/10">
                      <div className="text-xs font-black uppercase text-slate-400">Kod kreskowy modelu</div>
                      <div className={`break-all text-lg font-black mt-1 ${form.kod_kreskowy ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                        {form.kod_kreskowy || 'BRAK KODU'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">Fizyczne egzemplarze ({egzemplarze.length} szt.)</h2>
                      <p className="text-sm font-bold text-slate-400">Każda sztuka posiada unikalny numer boczny, kod kreskowy i numer seryjny.</p>
                    </div>
                    <Button onClick={openAdd}><Plus size={16} className="inline" /> Dodaj egzemplarz</Button>
                  </div>
                  <DataTable 
                    rows={egzemplarze} 
                    onRowClick={(r: any) => router.push(`/dashboard/warehouse/items/${r.id}`)} 
                    columns={[
                      { key: 'nazwa', label: 'Nazwa egzemplarza', value: (r: any) => <b>{r.nazwa || model.nazwa}</b> },
                      { key: 'numer', label: 'Numer', value: (r: any) => r.numer_egzemplarza || r.numer_urzadzenia || '-' },
                      { key: 'sn', label: 'S/N' },
                      { key: 'kod_kreskowy', label: 'Kod kreskowy' },
                      { key: 'status', label: 'Status', value: (r: any) => (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${r.status_serwisowy === 'Wydany' ? 'bg-cyan-100 text-cyan-800' : r.status_serwisowy === 'Działa' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {r.status_serwisowy || 'Działa'}
                        </span>
                      )},
                      { key: 'case', label: 'Przypisana skrzynia', value: (r: any) => r.case?.nazwa || '-' },
                    ]} 
                  />
                </>
              )}
            </Card>
          )}

          {activeTab === 'zalaczniki' && (
            <AttachmentsPanel modelId={Number(id)} zalaczniki={model.zalaczniki || []} reloadModel={load} />
          )}
        </div>
      </div>

      {showAdd && (
        <SimpleModal title="Dodaj fizyczny egzemplarz" onClose={() => setShowAdd(false)}>
          <form onSubmit={saveItem} className="space-y-6">
            <section>
              <h3 className="mb-3 text-lg font-black">Identyfikacja</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nazwa egzemplarza"><input className={inputClass} value={itemForm.nazwa || ''} onChange={e => setItemForm({ ...itemForm, nazwa: e.target.value })} /></Field>
                <Field label="Numer egzemplarza"><input className={inputClass} value={itemForm.numer_egzemplarza || ''} onChange={e => setItemForm({ ...itemForm, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })} /></Field>
                <Field label="Numer seryjny (S/N)"><input className={inputClass} value={itemForm.sn || ''} onChange={e => setItemForm({ ...itemForm, sn: e.target.value })} /></Field>
                <Field label="Data produkcji"><input type="date" className={inputClass} value={itemForm.data_produkcji || ''} onChange={e => setItemForm({ ...itemForm, data_produkcji: e.target.value })} /></Field>
              </div>
            </section>
            
            <section>
              <h3 className="mb-3 text-lg font-black">Znakowanie i wycena</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Zewnętrzny kod kreskowy"><input className={inputClass} value={itemForm.zewnetrzny_kod_kreskowy || ''} onChange={e => setItemForm({ ...itemForm, zewnetrzny_kod_kreskowy: e.target.value, kod_kreskowy: e.target.value })} /></Field>
                <Field label="Cena wynajmu"><input type="number" step="0.01" className={inputClass} value={itemForm.wartosc || ''} onChange={e => setItemForm({ ...itemForm, wartosc: e.target.value })} /></Field>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-lg font-black">Logistyka</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Magazyn"><select className={inputClass} value={itemForm.id_magazynu || ''} onChange={e => setItemForm({ ...itemForm, id_magazynu: e.target.value })}><option value="">Brak</option>{magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field>
                <Field label="Miejsce na regale"><input className={inputClass} value={itemForm.miejsce_w_mag || ''} onChange={e => setItemForm({ ...itemForm, miejsce_w_mag: e.target.value })} /></Field>
              </div>
            </section>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Anuluj</Button>
              <Button type="submit">Zapisz egzemplarz</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {showCalendar && (
        <SimpleModal title="Kalendarz dostępności modelu" onClose={() => setShowCalendar(false)}>
          <div className="space-y-3">
            {busy.map((b: any) => (
              <div key={b.id} className="rounded-2xl border p-3">
                <b>{b.tytul}</b>
                <p className="text-sm text-slate-500">{b.start ? new Date(b.start).toLocaleDateString('pl-PL') : '-'} - {b.koniec ? new Date(b.koniec).toLocaleDateString('pl-PL') : '-'} · {b.kontrahent || '-'}</p>
              </div>
            ))}
            {busy.length === 0 && <p className="font-bold text-slate-400">Brak zajętości w kalendarzu.</p>}
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

function defaultItemForm(model: any, nextNumber = 1) {
  const base = model?.nazwa || '';
  const code = `EF-${model?.id || 'M'}-${nextNumber}`;
  return { 
    nazwa: base, 
    numer_egzemplarza: String(nextNumber), 
    numer_urzadzenia: String(nextNumber), 
    status_serwisowy: 'Działa', 
    wartosc: model?.wartosc_domyslna_egzemplarza || model?.wartosc || '', 
    zewnetrzny_kod_kreskowy: code, 
    zewnetrzny_qr_kod: code, 
    kod_kreskowy: code, 
    qr_kod: code, 
    rozroznij_kod_qr: false 
  };
}

function AttachmentsPanel({ modelId, zalaczniki, reloadModel }: any) {
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
      await api.post(`/api/magazyn/modele/${modelId}/zalaczniki`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({}); setFile(null); setAdding(false); reloadModel();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Nie udało się wgrać pliku na serwer.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(z: any) {
    try {
      const res = await api.get(`/api/storage/download/${z.id}`);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Nie udało się uzyskać bezpiecznego linku.');
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-black text-xl text-slate-900 dark:text-white">Dokumentacja i załączniki S3</h3>
          <p className="text-sm font-bold text-slate-500">Karty DTR, instrukcje, certyfikaty bezpieczeństwa.</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={uploading}><Paperclip size={16} className="inline mr-1"/> Dodaj plik</Button>
      </div>

      {adding && (
        <div className="mb-6 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] p-5">
          <form onSubmit={saveFile} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <Field label="Nazwa wyświetlana">
              <input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({...form, nazwa: e.target.value})} placeholder="np. Karta DTR"/>
            </Field>
            <Field label="Wybierz Plik z Dysku">
              <input required type="file" className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-black file:text-white hover:file:bg-cyan-700 transition cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => {setAdding(false); setForm({}); setFile(null);}} disabled={uploading}>Anuluj</Button>
              <Button type="submit" disabled={uploading || !file}>{uploading ? 'Wysyłanie...' : 'Wgraj na serwer'}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
         {zalaczniki.map((z: any) => (
           <div key={z.id} className="rounded-[20px] border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between group hover:border-cyan-300 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20"><FileText size={24} strokeWidth={1.5}/></div>
                 <div className="min-w-0 pr-2">
                    <p className="font-black text-[15px] text-slate-900 dark:text-white truncate">{z.nazwa || z.nazwa_pliku}</p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{z.nazwa_pliku} · {((z.rozmiar_bajtow || 0) / 1024 / 1024).toFixed(2)} MB</p>
                 </div>
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => handleDownload(z)} className="p-2 text-[#04e0ff] hover:bg-cyan-50 rounded-xl transition"><Download size={18}/></button>
                <button type="button" onClick={async () => { if(confirm('Usunąć ten załącznik?')) { await api.delete(`/api/magazyn/modele/${modelId}/zalaczniki/${z.id}`); reloadModel(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition"><Trash2 size={18}/></button>
              </div>
           </div>
         ))}
         {zalaczniki.length === 0 && !adding && <div className="col-span-full p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-[28px] text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">Brak wgranych plików do tego modelu.</div>}
      </div>
    </Card>
  );
}