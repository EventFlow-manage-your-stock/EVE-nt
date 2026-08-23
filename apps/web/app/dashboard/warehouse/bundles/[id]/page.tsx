'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Plus, Save, Trash2, Box } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle, SearchableSelect } from '../../../../../components/ProductUI';
import { DataTable } from '../../../../../components/DataTable';
import { SimpleModal } from '../../../../../components/SimpleModal';

export default function BundleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = id === 'new';

  const [bundle, setBundle] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ nazwa: '', opis: '' });
  
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<any>({ id_modelu: '', ilosc: 1 });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    if (isNew) return;
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        api.get(`/api/pakiety/${id}`),
        api.get('/api/magazyn/modele').catch(() => ({ data: [] }))
      ]);
      setBundle(pRes.data);
      setForm({ nazwa: pRes.data.nazwa || '', opis: pRes.data.opis || '' });
      setModels(mRes.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się wczytać pakietu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // Aktualizacja danych głównych pakietu
  async function saveBundle(e?: any) {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (isNew) {
        const res = await api.post('/api/pakiety', form);
        router.push(`/dashboard/warehouse/bundles/${res.data.id}`);
      } else {
        await api.put(`/api/pakiety/${id}`, form);
        setNotice('Zapisano dane pakietu.');
        await load();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać pakietu.');
    } finally {
      setSaving(false);
    }
  }

  // Dodawanie nowej pozycji do pakietu
  async function addPosition(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.id_modelu) return setError('Wybierz sprzęt do dodania.');
    setError('');
    
    try {
      await api.post(`/api/pakiety/${id}/pozycje`, {
        id_modelu: addForm.id_modelu,
        ilosc: addForm.ilosc
      });
      setShowAdd(false);
      setAddForm({ id_modelu: '', ilosc: 1 });
      setNotice('Dodano pozycję do pakietu.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się dodać pozycji.');
    }
  }

  // Zmiana ilości inline
  async function updateQty(pozId: number, ilosc: string) {
    const parsed = Number(ilosc);
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await api.put(`/api/pakiety/${id}/pozycje/${pozId}`, { ilosc: parsed });
      setBundle((prev: any) => ({
        ...prev,
        pozycje: prev.pozycje.map((p: any) => p.id === pozId ? { ...p, ilosc: parsed } : p)
      }));
    } catch (err: any) {
      alert('Nie udało się zaktualizować ilości.');
    }
  }

  // Usuwanie pozycji z pakietu
  async function removePosition(pozId: number) {
    if (!confirm('Na pewno usunąć tę pozycję z pakietu?')) return;
    try {
      await api.delete(`/api/pakiety/${id}/pozycje/${pozId}`);
      await load();
    } catch (err: any) {
      alert('Nie udało się usunąć pozycji.');
    }
  }

  async function deleteBundle() {
    if (!confirm('Na pewno usunąć cały pakiet? Tej operacji nie można cofnąć.')) return;
    try {
      await api.delete(`/api/pakiety/${id}`);
      router.push('/dashboard/warehouse/bundles');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się usunąć pakietu.');
    }
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-400">Ładowanie pakietu...</div>;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageTitle 
        eyebrow="Magazyn / Pakiety Ofertowe" 
        title={isNew ? 'Nowy pakiet' : bundle?.nazwa} 
        description="Skonfiguruj szablon pakietu. Pozycje dodane tutaj zostaną automatycznie rozbite i dodane do oferty przy użyciu tego pakietu."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard/warehouse/bundles')}>
              <ArrowLeft size={16} className="inline" /> Powrót
            </Button>
            {!isNew && (
              <Button variant="danger" onClick={deleteBundle}>
                <Trash2 size={16} className="inline" /> Usuń
              </Button>
            )}
            <Button onClick={saveBundle} disabled={saving}>
              <Save size={16} className="inline" /> {saving ? 'Zapisywanie...' : 'Zapisz pakiet'}
            </Button>
          </div>
        }
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        
        {/* LEWA KOLUMNA: DANE PAKIETU */}
        <Card className="h-fit">
          <form onSubmit={saveBundle} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                <Layers size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Ustawienia ogólne</h2>
                <p className="text-xs font-bold text-slate-500">Metadane szablonu</p>
              </div>
            </div>

            <Field label="Nazwa pakietu (np. Oświetlenie sceny)">
              <input 
                className={inputClass} 
                value={form.nazwa} 
                onChange={(e) => setForm({ ...form, nazwa: e.target.value })} 
                required 
              />
            </Field>

            <Field label="Opis / Zastosowanie (opcjonalnie)">
              <textarea 
                className={`${inputClass} min-h-32`} 
                value={form.opis || ''} 
                onChange={(e) => setForm({ ...form, opis: e.target.value })} 
                placeholder="Wewnętrzny opis, do czego służy ten pakiet..."
              />
            </Field>

            <Button onClick={saveBundle} disabled={saving} className="w-full">
              Zapisz zmiany
            </Button>
          </form>
        </Card>

        {/* PRAWA KOLUMNA: ZAWARTOŚĆ PAKIETU */}
        {!isNew && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Box size={18} className="text-cyan-600"/> Zawartość pakietu
                </h2>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  Te modele zostaną wciągnięte do oferty z podanymi ilościami.
                </p>
              </div>
              <Button onClick={() => setShowAdd(true)}>
                <Plus size={16} className="inline" /> Dodaj sprzęt
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3 font-black">Model sprzętu</th>
                    <th className="p-3 font-black">Kategoria</th>
                    <th className="p-3 font-black w-32">Ilość domyślna</th>
                    <th className="p-3 font-black text-right w-16">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(bundle?.pozycje || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900">
                        {p.model?.nazwa || p.egzemplarz?.nazwa || 'Nieznany model'}
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-500">
                        {p.model?.kategoria?.nazwa || p.egzemplarz?.model?.kategoria?.nazwa || '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            className={`${inputClass} !py-1 text-center`} 
                            value={Number(p.ilosc)} 
                            onChange={(e) => updateQty(p.id, e.target.value)} 
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => removePosition(p.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition"
                          title="Usuń z pakietu"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!bundle?.pozycje || bundle.pozycje.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-sm font-bold text-slate-400">
                        Ten pakiet jest pusty. Dodaj pierwszy sprzęt, aby stworzyć szablon.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* MODAL DODAWANIA SPRZĘTU */}
      {showAdd && (
        <SimpleModal title="Dodaj sprzęt do pakietu" onClose={() => setShowAdd(false)}>
          <form onSubmit={addPosition} className="space-y-5">
            <Field label="Wybierz model sprzętu">
              <SearchableSelect 
                value={addForm.id_modelu} 
                onChange={(val) => setAddForm({ ...addForm, id_modelu: val })}
                options={models.map((m: any) => ({
                  value: String(m.id),
                  label: `${m.nazwa} ${m.kategoria ? `(${m.kategoria.nazwa})` : ''}`
                }))}
                placeholder="Wyszukaj model..."
              />
            </Field>

            <Field label="Domyślna ilość w tym pakiecie">
              <input 
                type="number" 
                min="0.01" 
                step="0.01" 
                className={inputClass} 
                value={addForm.ilosc} 
                onChange={(e) => setAddForm({ ...addForm, ilosc: e.target.value })} 
                required 
              />
            </Field>

            <div className="rounded-xl bg-cyan-50 p-4 border border-cyan-100">
              <p className="text-xs font-bold text-cyan-800">
                Po dodaniu pakietu do oferty, ilość tę będzie można dowolnie zmienić. Pakiet określa jedynie zestaw startowy.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Anuluj</Button>
              <Button type="submit">Dodaj do szablonu</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}