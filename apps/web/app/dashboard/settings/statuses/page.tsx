'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { StatusIconPicker } from '../../../../components/StatusIconPicker';

type StatusKind = 'wydarzenia' | 'magazynowe' | 'ksiegowe';

type StatusItem = {
  id: number;
  nazwa: string;
  kolor?: string | null;
  ikona?: string | null;
  kolejnosc?: number | null;
  aktywny?: boolean;
};

const config: Record<StatusKind, { title: string; description: string; endpoint: string; defaultColor: string; defaultIcon: string; examples: string }> = {
  wydarzenia: {
    title: 'Główne statusy wydarzeń',
    description: 'Ikona z tego statusu wyświetla się bezpośrednio przed nazwą wydarzenia w listach, panelu wydarzenia i kalendarzu.',
    endpoint: '/api/slowniki/statusy-wydarzenia',
    defaultColor: '#64748B',
    defaultIcon: '●',
    examples: 'np. Robocze, Potwierdzone, W realizacji, Zakończone, Anulowane',
  },
  magazynowe: {
    title: 'Statusy magazynowe wydarzeń',
    description: 'Status poboczny pokazujący stan sprzętu dla wydarzenia: przygotowanie, wydanie, zwrot, kontrola itd.',
    endpoint: '/api/slowniki/statusy-magazynowe',
    defaultColor: '#F97316',
    defaultIcon: '📦',
    examples: 'np. Do przygotowania, Kompletowanie, Wydane, Zwrócone, Braki',
  },
  ksiegowe: {
    title: 'Statusy księgowe wydarzeń',
    description: 'Status poboczny dla rozliczeń wydarzenia: faktura, płatność, księgowanie itd.',
    endpoint: '/api/slowniki/statusy-ksiegowe',
    defaultColor: '#22C55E',
    defaultIcon: '💰',
    examples: 'np. Do wyceny, Faktura wysłana, Opłacone, Zaległość, Zamknięte',
  },
};

const tabs: StatusKind[] = ['wydarzenia', 'magazynowe', 'ksiegowe'];

export default function StatusSettingsPage() {
  // EVENTFLOW_PRODUCT_POLISH_V11:
  // Jedno miejsce do edycji statusów głównych wydarzeń oraz statusów pobocznych: magazynowych i księgowych.
  const [active, setActive] = useState<StatusKind>('wydarzenia');
  const [items, setItems] = useState<StatusItem[]>([]);
  const [draft, setDraft] = useState({ nazwa: '', kolor: config.wydarzenia.defaultColor, ikona: config.wydarzenia.defaultIcon });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const current = config[active];

  useEffect(() => {
    setDraft({ nazwa: '', kolor: config[active].defaultColor, ikona: config[active].defaultIcon });
    load(active);
  }, [active]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => Number(a.kolejnosc ?? 0) - Number(b.kolejnosc ?? 0)), [items]);

  async function load(kind = active) {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(config[kind].endpoint);
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się pobrać statusów.');
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id: number, patch: Partial<StatusItem>) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function createStatus(e: FormEvent) {
    e.preventDefault();
    if (!draft.nazwa.trim()) return;
    await api.post(current.endpoint, draft);
    setDraft({ nazwa: '', kolor: current.defaultColor, ikona: current.defaultIcon });
    await load();
  }

  async function saveStatus(item: StatusItem) {
    setSavingId(item.id);
    try {
      await api.put(`${current.endpoint}/${item.id}`, item);
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function removeStatus(item: StatusItem) {
    if (!confirm(`Ukryć status "${item.nazwa}"? Historia wydarzeń zostanie zachowana.`)) return;
    await api.delete(`${current.endpoint}/${item.id}`);
    await load();
  }

  async function moveStatus(item: StatusItem, dir: -1 | 1) {
    const list = [...sortedItems];
    const idx = list.findIndex((i) => i.id === item.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    await api.put(`${current.endpoint}-kolejnosc`, { items: list.map((i, index) => ({ id: i.id, kolejnosc: index + 1 })) });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Ustawienia"
        title="Statusy operacyjne"
        description="Zarządzaj statusami głównymi wydarzeń oraz statusami pobocznymi magazynowymi i księgowymi. Status ma kolor, kolejność i ikonę. Ikona statusu głównego pojawia się przy nazwie wydarzenia."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${active === tab ? 'bg-cyan-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-cyan-50'}`}
          >
            {config[tab].title}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[0.45fr_1fr]">
        <Card>
          <form onSubmit={createStatus} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-black"><Plus size={18}/>Dodaj status</div>
              <p className="mt-1 text-sm font-semibold text-slate-500">{current.examples}</p>
            </div>
            <Field label="Nazwa statusu">
              <input className={inputClass} value={draft.nazwa} onChange={(e) => setDraft({ ...draft, nazwa: e.target.value })} placeholder="np. Potwierdzone" />
            </Field>
            <Field label="Kolor statusu">
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-16 rounded-xl border border-slate-200 bg-white p-1" value={draft.kolor} onChange={(e) => setDraft({ ...draft, kolor: e.target.value })} />
                <input className={inputClass} value={draft.kolor} onChange={(e) => setDraft({ ...draft, kolor: e.target.value })} />
              </div>
            </Field>
            <StatusIconPicker value={draft.ikona} onChange={(ikona) => setDraft({ ...draft, ikona })} />
            <Button type="submit"><Save size={16} className="inline"/> Zapisz status</Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900">{current.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{current.description}</p>
          </div>

          {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : (
            <div className="space-y-3">
              {sortedItems.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="grid gap-3 xl:grid-cols-[auto_1fr_190px_1.25fr_auto] xl:items-start">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveStatus(item, -1)} disabled={index === 0} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowUp size={15}/></button>
                      <button type="button" onClick={() => moveStatus(item, 1)} disabled={index === sortedItems.length - 1} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowDown size={15}/></button>
                    </div>
                    <Field label="Nazwa">
                      <input className={inputClass} value={item.nazwa || ''} onChange={(e) => updateLocal(item.id, { nazwa: e.target.value })} />
                    </Field>
                    <Field label="Kolor">
                      <div className="flex items-center gap-2">
                        <input type="color" className="h-10 w-14 rounded-xl border border-slate-200 bg-white p-1" value={item.kolor || current.defaultColor} onChange={(e) => updateLocal(item.id, { kolor: e.target.value })} />
                        <input className={inputClass} value={item.kolor || current.defaultColor} onChange={(e) => updateLocal(item.id, { kolor: e.target.value })} />
                      </div>
                    </Field>
                    <StatusIconPicker value={item.ikona || current.defaultIcon} onChange={(ikona) => updateLocal(item.id, { ikona })} label="Ikona" />
                    <div className="flex gap-2 xl:justify-end xl:pt-6">
                      <Button onClick={() => saveStatus(item)} disabled={savingId === item.id}>Zapisz</Button>
                      <Button variant="danger" onClick={() => removeStatus(item)}><Trash2 size={16}/></Button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-white bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Podgląd</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-xl px-3 py-2 text-sm font-black text-white" style={{ backgroundColor: item.kolor || current.defaultColor }}>{item.ikona || current.defaultIcon} {item.nazwa || 'Status'}</span>
                      <span className="text-sm font-bold text-slate-500">Tak status będzie wyglądał przy rekordach i w panelach.</span>
                    </div>
                  </div>
                </div>
              ))}
              {sortedItems.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center font-bold text-slate-400">Brak statusów. Dodaj pierwszy.</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
