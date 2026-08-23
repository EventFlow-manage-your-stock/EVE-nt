'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { ArrowDown, ArrowUp, Palette, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';

type EventType = {
  id: number;
  nazwa: string;
  kolor?: string | null;
  kolejnosc?: number | null;
};

const defaultColors = ['#0891B2', '#2563EB', '#7C3AED', '#F97316', '#22C55E', '#DC2626', '#111827', '#EC4899'];

export default function EventTypesSettingsPage() {
  const router = useRouter();
  // EVENTFLOW_PRODUCT_POLISH_V9:
  // Edycja typów wydarzeń. Kolor typu jest używany przez /api/kalendarz jako kolor paska wydarzenia.
  const [items, setItems] = useState<EventType[]>([]);
  const [draft, setDraft] = useState({ nazwa: '', kolor: '#0891B2' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/slowniki/typy-wydarzen');
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się pobrać typów wydarzeń.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sortedItems = useMemo(() => [...items].sort((a, b) => Number(a.kolejnosc ?? 0) - Number(b.kolejnosc ?? 0)), [items]);

  async function createType(e: FormEvent) {
    e.preventDefault();
    if (!draft.nazwa.trim()) return;
    await api.post('/api/slowniki/typy-wydarzen', draft);
    setDraft({ nazwa: '', kolor: '#0891B2' });
    await load();
  }

  async function saveType(item: EventType) {
    setSavingId(item.id);
    try {
      await api.put(`/api/slowniki/typy-wydarzen/${item.id}`, item);
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function removeType(item: EventType) {
    if (!confirm(`Ukryć typ wydarzenia "${item.nazwa}"? Wydarzenia historyczne zachowają powiązanie.`)) return;
    await api.delete(`/api/slowniki/typy-wydarzen/${item.id}`);
    await load();
  }

  async function move(item: EventType, dir: -1 | 1) {
    const list = [...sortedItems];
    const idx = list.findIndex((i) => i.id === item.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    const payload = { items: list.map((i, index) => ({ id: i.id, kolejnosc: index + 1 })) };
    await api.put('/api/slowniki/typy-wydarzen-kolejnosc', payload);
    await load();
  }

  function updateLocal(id: number, patch: Partial<EventType>) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Ustawienia"
        title="Typy wydarzeń"
        description="Tutaj ustawiasz nazwy, kolejność i kolory typów. Kolor typu wydarzenia jest automatycznie kolorem paska w kalendarzu. Status wydarzenia nadal pokazuje się tylko jako ikona."
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[0.45fr_1fr]">
        <Card>
          <form onSubmit={createType} className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-black"><Plus size={18}/>Dodaj typ wydarzenia</div>
            <Field label="Nazwa typu">
              <input className={inputClass} value={draft.nazwa} onChange={(e) => setDraft({ ...draft, nazwa: e.target.value })} placeholder="np. Konferencja, Wynajem, Spotkanie" />
            </Field>
            <Field label="Kolor paska w kalendarzu">
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-16 rounded-xl border border-slate-200 bg-white p-1" value={draft.kolor} onChange={(e) => setDraft({ ...draft, kolor: e.target.value })} />
                <input className={inputClass} value={draft.kolor} onChange={(e) => setDraft({ ...draft, kolor: e.target.value })} />
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              {defaultColors.map((color) => <button key={color} type="button" onClick={() => setDraft({ ...draft, kolor: color })} className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: color }} />)}
            </div>
            <Button type="submit"><Save size={16} className="inline"/> Zapisz typ</Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 text-lg font-black"><Palette size={18}/>Lista typów wydarzeń</div>
          {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : (
            <div className="space-y-3">
              {sortedItems.map((item, index) => (
                <div key={item.id} onDoubleClick={() => router.push(`/dashboard/settings/event-types/${item.id}`)} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[auto_1fr_170px_auto] md:items-center hover:bg-cyan-50">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(item, -1)} disabled={index === 0} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowUp size={15}/></button>
                    <button type="button" onClick={() => move(item, 1)} disabled={index === sortedItems.length - 1} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowDown size={15}/></button>
                  </div>
                  <input className={inputClass} value={item.nazwa} onChange={(e) => updateLocal(item.id, { nazwa: e.target.value })} />
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-10 w-14 rounded-xl border border-slate-200 bg-white p-1" value={item.kolor || '#0891B2'} onChange={(e) => updateLocal(item.id, { kolor: e.target.value })} />
                    <input className={inputClass} value={item.kolor || '#0891B2'} onChange={(e) => updateLocal(item.id, { kolor: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveType(item)} disabled={savingId === item.id}>Zapisz</Button>
                    <Button variant="danger" onClick={() => removeType(item)}><Trash2 size={16}/></Button>
                  </div>
                </div>
              ))}
              {sortedItems.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center font-bold text-slate-400">Brak typów. Dodaj pierwszy typ wydarzenia.</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
