'use client';

import { useEffect, useState } from 'react';
import { Plus, Building2, MapPin, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [form, setForm] = useState<any>({ nazwa: '', kod: '', miasto: '', adres: '', kod_pocztowy: '', opis: '', domyslny: false });
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/magazyn/magazyny');
      setWarehouses(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingWarehouse(null);
    setForm({ nazwa: '', kod: '', miasto: '', adres: '', kod_pocztowy: '', opis: '', domyslny: warehouses.length === 0 });
    setError('');
    setShowModal(true);
  }

  function openEdit(w: any) {
    setEditingWarehouse(w);
    setForm({ ...w });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError('');
    try {
      if (editingWarehouse) {
        await api.put(`/api/magazyn/magazyny/${editingWarehouse.id}`, form);
      } else {
        await api.post('/api/magazyn/magazyny', form);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Wystąpił błąd zapisu.');
    }
  }

  async function handleDelete(w: any) {
    if (!confirm(`Czy na pewno chcesz usunąć magazyn "${w.nazwa}"?`)) return;
    try {
      await api.delete(`/api/magazyn/magazyny/${w.id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Nie można usunąć magazynu.');
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="Magazyn"
        title="Lokalizacje Magazynowe"
        description="Zarządzaj swoimi magazynami (np. Magazyn Poznań, Magazyn Warszawa). Każdy egzemplarz sprzętu jest przypisany do konkretnego magazynu i lokalizacji półkowej."
        action={<Button onClick={openAdd}><Plus size={16} className="inline mr-1" /> Dodaj magazyn</Button>}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((w: any) => (
          <Card key={w.id} className="relative flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 font-black">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {w.nazwa}
                      {w.domyslny && <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5">Główny</span>}
                    </h3>
                    {w.kod && <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">{w.kod}</p>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(w)} className="p-2 text-slate-400 hover:text-cyan-600 rounded-lg hover:bg-slate-50"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(w)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-white/5 pt-3">
                {(w.adres || w.miasto) && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span>{[w.adres, w.kod_pocztowy, w.miasto].filter(Boolean).join(', ')}</span>
                  </p>
                )}
                {w.opis && <p className="text-slate-500 italic mt-2">{w.opis}</p>}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Przypisanych egzemplarzy:</span>
              <span className="text-sm font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                {w._count?.egzemplarze || 0} szt.
              </span>
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <SimpleModal title={editingWarehouse ? "Edytuj magazyn" : "Nowy magazyn"} onClose={() => setShowModal(false)}>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nazwa magazynu *">
                <input required className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} placeholder="np. Magazyn Poznań Główny" />
              </Field>
              <Field label="Kod identyfikacyjny">
                <input className={inputClass} value={form.kod || ''} onChange={e => setForm({ ...form, kod: e.target.value })} placeholder="np. WMS-POZ-01" />
              </Field>
              <Field label="Miasto">
                <input className={inputClass} value={form.miasto || ''} onChange={e => setForm({ ...form, miasto: e.target.value })} placeholder="np. Poznań" />
              </Field>
              <Field label="Kod pocztowy">
                <input className={inputClass} value={form.kod_pocztowy || ''} onChange={e => setForm({ ...form, kod_pocztowy: e.target.value })} placeholder="60-001" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Ulica i numer">
                  <input className={inputClass} value={form.adres || ''} onChange={e => setForm({ ...form, adres: e.target.value })} placeholder="ul. Magazynowa 10" />
                </Field>
              </div>
            </div>
            <Field label="Opis / Notatki">
              <textarea className={inputClass} rows={2} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <input type="checkbox" checked={!!form.domyslny} onChange={e => setForm({ ...form, domyslny: e.target.checked })} className="w-5 h-5 rounded text-cyan-600" />
              <span className="text-sm font-bold text-slate-800 dark:text-white">Ustaw jako magazyn domyślny dla nowych pozycji</span>
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-white/10 pt-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Anuluj</Button>
              <Button type="submit">Zapisz magazyn</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}