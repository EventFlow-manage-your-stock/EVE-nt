'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2, QrCode } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../../components/ProductUI';
import { DataTable } from '../../../../../components/DataTable';
import { PrintLabelsModal } from '../../../../../components/PrintLabelsModal';

export default function PackageEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [available, setAvailable] = useState<any[]>([]);
  const [magazyny, setMagazyny] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // NOWY STAN DLA MODALA NAKLEJEK
  const [showPrintModal, setShowPrintModal] = useState(false);

  async function load() {
    const [r, a, m] = await Promise.all([
      api.get(`/api/magazyn/opakowania/${id}`),
      api.get(`/api/magazyn/slowniki/dostepne-do-case/${id}`).catch(() => ({ data: [] })),
      api.get('/api/magazyn/slowniki/magazyny').catch(() => ({ data: [] })),
    ]);
    setRecord(r.data); setForm({ ...r.data }); setAvailable(a.data || []); setMagazyny(m.data || []);
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    setSaving(true); setError('');
    try { await api.put(`/api/magazyn/egzemplarze/${id}`, form); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Nie udało się zapisać opakowania.'); }
    finally { setSaving(false); }
  }

  async function removeFromCase(itemId: number) { await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc`, { itemIds: [itemId], action: 'remove' }); await load(); }
  async function addToCase() { if (!selected.length) return; await api.post(`/api/magazyn/egzemplarze/${id}/zawartosc`, { itemIds: selected, action: 'add' }); setSelected([]); await load(); }

  const contents = record?.zawartosc_case || [];
  const title = record?.nazwa || record?.model?.nazwa || `Opakowanie #${id}`;
  const subtitle = `${contents.length} egzemplarzy wewnątrz case`;

  if (!record) return <p className="p-8 font-bold text-slate-400">Ładowanie opakowania...</p>;

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle 
      eyebrow="Opakowania" 
      title={title} 
      description={subtitle} 
      action={
        <div className="flex gap-2">
          {/* NOWY PRZYCISK */}
          <Button variant="secondary" onClick={() => setShowPrintModal(true)}>
            <QrCode size={16} className="inline mr-1" /> Etykieta
          </Button>
          <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button>
          <Button onClick={save} disabled={saving}><Save size={16} className="inline" /> {saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
        </div>
      } 
    />
    
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</div>}
    
    <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="space-y-4">
        <h2 className="text-xl font-black">Dane case</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nazwa opakowania"><input className={inputClass} value={form.nazwa || ''} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} /></Field>
          <Field label="Numer"><input className={inputClass} value={form.numer_egzemplarza || form.numer_urzadzenia || ''} onChange={(e) => setForm({ ...form, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })} /></Field>
          <Field label="Kod kreskowy"><input className={inputClass} value={form.kod_kreskowy || ''} onChange={(e) => setForm({ ...form, kod_kreskowy: e.target.value, zewnetrzny_kod_kreskowy: e.target.value, zewnetrzny_qr_kod: form.rozroznij_kod_qr ? form.zewnetrzny_qr_kod : e.target.value })} /></Field>
          <Field label="QR"><input className={inputClass} value={form.zewnetrzny_qr_kod || ''} disabled={!form.rozroznij_kod_qr} onChange={(e) => setForm({ ...form, zewnetrzny_qr_kod: e.target.value, qr_kod: e.target.value })} /></Field>
          <Field label="Magazyn"><select className={inputClass} value={form.id_magazynu || ''} onChange={(e) => setForm({ ...form, id_magazynu: e.target.value })}><option value="">Brak</option>{magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field>
          <Field label="Miejsce"><input className={inputClass} value={form.miejsce_w_mag || ''} onChange={(e) => setForm({ ...form, miejsce_w_mag: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!form.rozroznij_kod_qr} onChange={(e) => setForm({ ...form, rozroznij_kod_qr: e.target.checked, zewnetrzny_qr_kod: e.target.checked ? form.zewnetrzny_qr_kod : form.kod_kreskowy })}/> Rozróżnij QR i kod kreskowy</label>
        <Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={(e) => setForm({ ...form, opis: e.target.value })}/></Field>
      </Card>
      <Card>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Egzemplarze wewnątrz case</h2><span className="rounded-xl bg-cyan-50 px-3 py-1 text-sm font-black text-cyan-700">{contents.length} szt.</span></div>
        <DataTable rows={contents} columns={[{ key: 'nazwa', label: 'Nazwa', value: (r: any) => <b>{r.nazwa || r.model?.nazwa}</b> }, { key: 'model', label: 'Model', value: (r: any) => r.model?.nazwa || '-' }, { key: 'numer', label: 'Numer', value: (r: any) => r.numer_egzemplarza || r.numer_urzadzenia || '-' }, { key: 'kod', label: 'Kod', value: (r: any) => r.kod_kreskowy || r.qr_kod || '-' }, { key: 'remove', label: 'Akcja', value: (r: any) => <button onClick={(e) => { e.stopPropagation(); removeFromCase(r.id); }} className="text-red-600"><Trash2 size={16} /></button> }]} />
      </Card>
    </div>
    <Card>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">Dodaj sprzęt do case</h2><p className="text-sm font-bold text-slate-500">Zaznacz wolne egzemplarze i dodaj do opakowania.</p></div><Button onClick={addToCase} disabled={!selected.length}><Plus size={16} className="inline" /> Dodaj zaznaczone</Button></div>
      <DataTable rows={available} columns={[{ key: 'select', label: '', value: (r: any) => <input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} onClick={(e) => e.stopPropagation()} /> }, { key: 'nazwa', label: 'Nazwa', value: (r: any) => <b>{r.nazwa || r.model?.nazwa}</b> }, { key: 'model', label: 'Model', value: (r: any) => r.model?.nazwa || '-' }, { key: 'kod', label: 'Kod', value: (r: any) => r.kod_kreskowy || r.qr_kod || '-' }]} />
    </Card>

    {/* NOWY MODAL */}
    <PrintLabelsModal 
      isOpen={showPrintModal} 
      onClose={() => setShowPrintModal(false)} 
      ids={[Number(id)]} 
    />
  </div>;
}