'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field, inputClass, SearchableSelect } from './ProductUI';

interface EventFormProps { isOpen: boolean; onClose: () => void; onSuccess?: () => void; }

// EVENTFLOW_PRODUCT_POLISH_V3:
// Poprawiony formularz wydarzenia. Stary formularz używał nazw pól typu nazwa_wydarzenia/data_rozpoczecia,
// które nie pasowały 1:1 do backendu. Nie dodajemy już miesiąca księgowania. Dodany jest typ wydarzenia.
export function EventForm({ isOpen, onClose, onSuccess }: EventFormProps) {
  const [form, setForm] = useState<any>({});
  const [dict, setDict] = useState<any>({ typy: [], statusy: [], kontrahenci: [], miejsca: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      api.get('/api/slowniki/typy-wydarzen'),
      api.get('/api/slowniki/statusy-wydarzenia'),
      api.get('/api/slowniki/kontrahenci'),
      api.get('/api/slowniki/miejsca'),
    ]).then(([typy, statusy, kontrahenci, miejsca]) => setDict({ typy: typy.data, statusy: statusy.data, kontrahenci: kontrahenci.data, miejsca: miejsca.data })).catch(console.error);
  }, [isOpen]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await api.post('/api/wydarzenia', {
      ...form,
      id_typu_wydarzenia: form.id_typu_wydarzenia ? Number(form.id_typu_wydarzenia) : null,
      id_statusu_wydarzenia: form.id_statusu_wydarzenia ? Number(form.id_statusu_wydarzenia) : null,
      id_kontrahenta: form.id_kontrahenta ? Number(form.id_kontrahenta) : null,
      id_miejsca: form.id_miejsca ? Number(form.id_miejsca) : null,
    });
    setSaving(false); onSuccess?.(); onClose();
  }

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
    <form onSubmit={submit} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-black">Nowe wydarzenie</h2><button type="button" onClick={onClose}><X/></button></div><div className="space-y-4"><Field label="Nazwa"><input className={inputClass} value={form.nazwa||''} onChange={e=>setForm({...form,nazwa:e.target.value})} required/></Field><Field label="Typ wydarzenia"><select className={inputClass} value={form.id_typu_wydarzenia||''} onChange={e=>setForm({...form,id_typu_wydarzenia:e.target.value})}><option value="">Wybierz</option>{dict.typy.map((t:any)=><option key={t.id} value={t.id}>{t.nazwa}</option>)}</select></Field><Field label="Status"><select className={inputClass} value={form.id_statusu_wydarzenia||''} onChange={e=>setForm({...form,id_statusu_wydarzenia:e.target.value})}><option value="">Wybierz</option>{dict.statusy.map((s:any)=><option key={s.id} value={s.id}>{s.ikona||'●'} {s.nazwa}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Start"><input type="datetime-local" className={inputClass} value={form.data_start||''} onChange={e=>setForm({...form,data_start:e.target.value})}/></Field><Field label="Koniec"><input type="datetime-local" className={inputClass} value={form.data_koniec||''} onChange={e=>setForm({...form,data_koniec:e.target.value})}/></Field></div><Field label="Kontrahent">
            <SearchableSelect
              value={form.id_kontrahenta || ''}
              onChange={(val) => setForm({ ...form, id_kontrahenta: val })}
              options={(dict.kontrahenci || []).map((k: any) => ({ id: k.id, label: k.nazwa }))}
              placeholder="Brak / wpiszę później"
            />
          </Field><Field label="Miejsce z bazy"><select className={inputClass} value={form.id_miejsca||''} onChange={e=>setForm({...form,id_miejsca:e.target.value})}><option value="">Dodam ręcznie</option>{dict.miejsca.map((m:any)=><option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field><Field label="Miejsce ręcznie"><input className={inputClass} value={form.miejsce_reczne||''} onChange={e=>setForm({...form,miejsce_reczne:e.target.value})}/></Field><Field label="Adres"><input className={inputClass} value={form.adres_reczny||''} onChange={e=>setForm({...form,adres_reczny:e.target.value})}/></Field><Field label="Opis"><textarea className={inputClass+' min-h-28'} value={form.opis||''} onChange={e=>setForm({...form,opis:e.target.value})}/></Field><div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Anuluj</Button><Button type="submit" disabled={saving}>{saving?'Zapis...':'Zapisz'}</Button></div></div></form></div>;
}
