'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, History, Loader2, Save, Trash2, FileText, Users, Box, Truck, Wrench, CalendarDays, ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Field, inputClass } from './ProductUI';

export type EntityField = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'checkbox' | 'color' | 'select' | 'image';
  readonly?: boolean;
  options?: any[];
  optionLabel?: (row: any) => string;
  optionValue?: (row: any) => string | number;
  placeholder?: string;
  colSpan?: 'full';
  defaultValue?: any;
};

export type EntityEditorConfig = {
  moduleLabel: string;
  title: string;
  listHref: string;
  getEndpoint: (id: string) => string;
  updateEndpoint: (id: string) => string;
  deleteEndpoint?: (id: string) => string;
  createEndpoint?: string; 
  fields: EntityField[];
  tabs?: { id: string; label: string; icon?: any; render?: (record: any) => any }[];
  dictionaries?: Record<string, string>;
  afterSave?: (record: any) => void;
  normalizePayload?: (form: any) => any;
  titleFromRecord?: (record: any) => string;
  subtitleFromRecord?: (record: any) => string;
  extraActions?: React.ReactNode;
};

function toInputValue(value: any, type?: EntityField['type']) {
  if (value === null || value === undefined) return '';
  if (type === 'date') return String(value).slice(0, 10);
  if (type === 'datetime') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return String(value).slice(0, 16);
  }
  return value;
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (typeof value === 'object') {
    if (value.nazwa) return value.nazwa;
    if (value.numer) return value.numer;
    if (value.imie || value.nazwisko) return `${value.imie || ''} ${value.nazwisko || ''}`.trim();
    return JSON.stringify(value);
  }
  return String(value);
}

function cleanPayload(form: any, fields: EntityField[]) {
  const payload: any = {};
  for (const field of fields) {
    if (field.readonly) continue;
    const raw = form[field.key];
    if (field.type === 'number') payload[field.key] = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    else if (field.type === 'checkbox') payload[field.key] = !!raw;
    // Base64 string przesyłany bezpośrednio do API
    else payload[field.key] = raw === '' ? null : raw;
  }
  return payload;
}

function initials(record: any) {
  const source = record?.nazwa || record?.tytul || record?.numer || record?.email || 'EF';
  return String(source).split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

const DEFAULT_TABS = [
  { id: 'szczegoly', label: 'Szczegóły', icon: FileText },
  { id: 'powiazania', label: 'Powiązania', icon: Box },
  { id: 'historia', label: 'Historia', icon: History },
];

export function EntityEditorPage({ config }: { config: EntityEditorConfig }) {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const isNew = id === 'new';

  const tabs = config.tabs?.length ? config.tabs : DEFAULT_TABS;

  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [dict, setDict] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'szczegoly');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const dictEntries = Object.entries(config.dictionaries || {});
      const dictPromises = dictEntries.map(([, endpoint]) => api.get(endpoint).catch(() => ({ data: [] })));
      
      let rec: any = null;
      let dictResponses: any[] = [];

      // Unikamy rzucenia błędu ParseIntPipe w API poprzez odcięcie metody strzału dla "new"
      if (isNew) {
        dictResponses = await Promise.all(dictPromises);
        rec = {};
      } else {
        const [main, ...rest] = await Promise.all([
          api.get(config.getEndpoint(id)),
          ...dictPromises,
        ]);
        rec = main.data;
        dictResponses = rest;
      }

      setRecord(rec);
      const nextForm: any = {};
      for (const field of config.fields) {
        nextForm[field.key] = toInputValue(rec?.[field.key] ?? field.defaultValue, field.type);
      }
      setForm(nextForm);
      setDict(Object.fromEntries(dictEntries.map(([key], index) => [key, dictResponses[index]?.data || []])));
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się wczytać rekordu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const fields = useMemo(() => config.fields.map((field) => {
    if (field.options) return field;
    const options = dict[field.key];
    return options ? { ...field, options } : field;
  }), [config.fields, dict]);

  async function submit(e?: any) {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      const payload = config.normalizePayload ? config.normalizePayload(form) : cleanPayload(form, fields);
      
      if (isNew) {
        // Oblicz endpoint dla POST na podstawie podanych konfigów
        const createUrl = config.createEndpoint || config.updateEndpoint('new').replace(/\/new$/, '');
        const res = await api.post(createUrl, payload);
        config.afterSave?.(res.data);
        router.push(`${config.listHref}/${res.data.id}`);
        return; // Zatrzymujemy flow na czas nawigacji
      } else {
        const res = await api.put(config.updateEndpoint(id), payload);
        setRecord(res.data || { ...record, ...payload });
        config.afterSave?.(res.data);
        await load();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać zmian.');
    } finally {
      if (!isNew) setSaving(false);
    }
  }

  async function remove() {
    if (!config.deleteEndpoint || isNew) return;
    if (!confirm('Na pewno usunąć ten rekord?')) return;
    await api.delete(config.deleteEndpoint(id));
    router.push(config.listHref);
  }

  const title = isNew ? `Dodaj nowy rekord` : (record ? (config.titleFromRecord?.(record) || record.nazwa || record.tytul || record.numer || `#${record.id}`) : config.title);
  const subtitle = isNew ? '' : (record ? (config.subtitleFromRecord?.(record) || `ID ${record.id}`) : '');

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-cyan-600" /> <span className="ml-3 font-bold text-slate-500">Ładowanie modułu edycji...</span></div>;
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(config.listHref); }} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-slate-50"><ArrowLeft size={16} /> Powrót</button>
          <span>/</span>
          <Link href={config.listHref} className="hover:text-cyan-700">{config.moduleLabel}</Link>
          <span>/</span>
          <span className="font-black text-slate-900">{title}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.extraActions}
          <Button variant="secondary" onClick={() => { if (window.history.length > 1) router.back(); else router.push(config.listHref); }}><ArrowLeft size={16} className="inline" /> Powrót</Button>
          {!isNew && config.deleteEndpoint && <Button variant="danger" onClick={remove}><Trash2 size={16} className="inline" /> Usuń</Button>}
          <Button onClick={submit} disabled={saving}><Save size={16} className="inline" /> {saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Numer / ID" value={isNew ? 'Nowy' : (record?.numer || `#${record?.id}`)} />
        <Metric label="Status" value={isNew ? 'Szkic' : formatValue(record?.status || record?.status_serwisowy || record?.aktywny)} />
        <Metric label="Utworzono" value={isNew ? '-' : (record?.data_utworzenia ? new Date(record.data_utworzenia).toLocaleString('pl-PL') : '-')} />
        <Metric label="Zmieniono" value={isNew ? '-' : (record?.data_aktualizacji ? new Date(record.data_aktualizacji).toLocaleString('pl-PL') : '-')} />
      </div>

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-600">Moduł edycji</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm font-bold text-slate-400">{subtitle}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => {
              const value = form[field.key] ?? '';
              const disabled = field.readonly;
              return (
                <div key={field.key} className={field.colSpan === 'full' || field.type === 'textarea' || field.type === 'image' ? 'md:col-span-2' : ''}>
                  <Field label={field.label}>
                    {field.type === 'textarea' ? (
                      <textarea className={`${inputClass} min-h-28`} disabled={disabled} placeholder={field.placeholder} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
                    ) : field.type === 'select' ? (
                      <select className={inputClass} disabled={disabled} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                        <option value="">Brak / wybierz</option>
                        {(field.options || []).map((option: any) => <option key={field.optionValue ? field.optionValue(option) : option.id} value={field.optionValue ? field.optionValue(option) : option.id}>{field.optionLabel ? field.optionLabel(option) : option.nazwa || option.numer || option.email || `#${option.id}`}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-black"><input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })} /> Tak</label>
                    ) : field.type === 'image' ? (
                      <div className="flex flex-col sm:flex-row items-start gap-5 pt-1">
                        <div className="flex aspect-video w-full sm:w-72 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner">
                          {value ? <img src={value} alt={field.label} className="h-full w-full object-cover" /> : <ImageIcon size={32} className="text-slate-300" />}
                        </div>
                        <div className="space-y-3 pt-2 w-full">
                          <input type="file" accept="image/*" disabled={disabled} onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setForm({ ...form, [field.key]: reader.result });
                            reader.readAsDataURL(file);
                          }} className="block w-full text-sm font-bold text-slate-500 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-black file:text-white disabled:opacity-50 hover:file:bg-cyan-700 transition" />
                          <p className="text-xs font-semibold text-slate-400">Zalecane proporcje obrazka to 16:9. Optymalny format to JPG lub WEBP.</p>
                          {value && !disabled && (
                            <button type="button" onClick={() => setForm({ ...form, [field.key]: '' })} className="text-sm font-black text-red-500 hover:text-red-700 transition underline underline-offset-2">Usuń aktualne zdjęcie</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <input type={field.type === 'datetime' ? 'datetime-local' : field.type || 'text'} className={inputClass} disabled={disabled} placeholder={field.placeholder} value={value} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
                    )}
                  </Field>
                </div>
              );
            })}
          </div>
        </Card>
        
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cyan-100 text-xl font-black text-cyan-700 shadow-inner">
              {form.zdjecie ? <img src={form.zdjecie} className="h-full w-full object-cover"/> : initials(record || form)}
            </div>
            <div>
              <p className="font-black text-slate-900 leading-tight">{title}</p>
              <p className="text-sm font-bold text-slate-400 mt-0.5">{config.moduleLabel}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <Info label="ID rekordu" value={isNew ? 'Nowy' : `#${record?.id}`} />
            <Info label="Aktywny" value={record?.aktywny === false ? 'Nie' : 'Tak'} />
            <InfoImage label="Źródło" value={<Image src="/eventflow-logo-dark.svg" alt="EventFlow" width={120} height={40} className="mt-2" priority/>} />
          </div>
        </Card>
      </form>

      <Card className="!p-0">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon || FileText;
            const active = activeTab === tab.id;
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-w-[120px] flex-col items-center justify-center gap-1.5 border-b-2 px-4 py-3 text-sm font-black transition ${active ? 'border-cyan-600 bg-cyan-50/50 text-cyan-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><Icon size={18} />{tab.label}</button>;
          })}
        </div>
        <div className="p-5">
          {isNew ? (
            <p className="font-bold text-slate-500">Zapisz najpierw nowy rekord górnym przyciskiem "Zapisz", aby móc przeglądać dodatkowe informacje i powiązania w zakładkach.</p>
          ) : (
            tabs.find((t) => t.id === activeTab)?.render ? tabs.find((t) => t.id === activeTab)?.render?.(record) : <DefaultTab id={activeTab} record={record} />
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-lg font-black text-slate-900">{formatValue(value)}</p></div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{formatValue(value)}</p></div>;
}

function InfoImage({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><div className="mt-1">{value}</div></div>;
}

function DefaultTab({ id, record }: { id: string; record: any }) {
  if (id === 'historia') return <p className="font-bold text-slate-500">Historia zmian będzie rozwijana w kolejnym kroku. Rekord: #{record?.id}</p>;
  if (id === 'powiazania') return <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs font-semibold text-slate-100">{JSON.stringify(record, null, 2)}</pre>;
  return <p className="font-bold text-slate-500">Edytuj dane w formularzu powyżej i zapisz zmianę górnym przyciskiem.</p>;
}

export const defaultTabs = {
  service: [
    { id: 'sprzet', label: 'Sprzęt', icon: Box },
    { id: 'historia', label: 'Historia', icon: History },
  ],
  fleet: [
    { id: 'kalendarz', label: 'Kalendarz', icon: CalendarDays },
    { id: 'historia', label: 'Historia', icon: History },
  ],
  crm: [
    { id: 'kontakty', label: 'Kontakty / powiązania', icon: Users },
    { id: 'historia', label: 'Historia', icon: History },
  ],
};