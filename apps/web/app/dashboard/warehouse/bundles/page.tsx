'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';
import { SimpleModal } from '../../../../components/SimpleModal';

export default function BundlesPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get('/api/pakiety').catch(() => ({ data: [] }));
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: any) {
    e.preventDefault();
    await api.post('/api/pakiety', form);
    setShow(false);
    setForm({});
    load();
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle 
        eyebrow="Magazyn" 
        title="Pakiety Ofertowe" 
        description="Pakiety to wirtualne zbiory sprzętu. Służą jako szablony do szybkiego dodawania zestawów (np. 'Scena Mała', 'Nagłośnienie DJ') do ofert. Dodanie pakietu rozbija go w ofercie na pojedyncze modele." 
        action={<Button onClick={() => setShow(true)}><Plus size={16} className="inline" /> Utwórz pakiet</Button>} 
      />

      <Card>
        {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie...</p> : (
          <DataTable 
            rows={items} 
            onRowClick={(r: any) => router.push(`/dashboard/warehouse/bundles/${r.id}`)} 
            columns={[
              { key: 'nazwa', label: 'Nazwa pakietu', value: (r: any) => <b className="text-cyan-700"><Layers size={14} className="inline mr-2"/>{r.nazwa}</b> },
              { key: 'opis', label: 'Opis', value: (r: any) => r.opis || '-' },
              { key: 'pozycje', label: 'Ilość pozycji', value: (r: any) => r._count?.pozycje || 0 }
            ]} 
          />
        )}
      </Card>

      {show && (
        <SimpleModal title="Nowy Pakiet" onClose={() => setShow(false)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nazwa pakietu (np. Zestaw Nagłośnieniowy PRO)"><input className={inputClass} required value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} /></Field>
            <Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShow(false)}>Anuluj</Button>
              <Button type="submit">Zapisz pakiet</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}