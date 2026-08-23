'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Check, ImageIcon, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react';
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
      alert('Sprzęt ilościowy musi mieć kod kreskowy modelu. Ten kod skanujesz przy WZ/PZ, a system zapyta o liczbę sztuk.');
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
    if (!confirm(`Usunąć model "${model?.nazwa}"?\n\nModel zostanie ukryty, a nie fizycznie skasowany z bazy.`)) return;
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
        description={quantityModel ? "Model ilościowy: stan, jednostka i kod kreskowy są zapisane na modelu. Nie dodajemy egzemplarzy z numerem/SN." : "Model egzemplarzowy: cena domyślna, parametry i lista fizycznych egzemplarzy. Kod kreskowy, QR i SN nadajemy egzemplarzom."}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button>
            <Button variant="secondary" onClick={loadCalendar}><CalendarDays size={16} className="inline" /> Kalendarz</Button>
            <Button variant="secondary" onClick={() => openLabelsPage({ modelId: Number(id) })}><QrCode size={16} className="inline" /> Naklejki</Button>
            <Button variant="secondary" onClick={() => setEdit(!edit)}>{edit ? <X size={16} className="inline" /> : <Pencil size={16} className="inline" />} {edit ? 'Anuluj edycję' : 'Edytuj model'}</Button>
            {!quantityModel && <Button onClick={openAdd}><Plus size={16} className="inline" /> Dodaj egzemplarz</Button>}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black">Dane modelu</h2>
            {edit && <Button onClick={saveModel} disabled={saving}><Check size={16} className="inline" /> {saving ? 'Zapisuję...' : 'Zapisz'}</Button>}
          </div>

          <form onSubmit={saveModel} className="space-y-5">
            <div className="space-y-3">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border bg-slate-50 shadow-inner">
                  {form.zdjecie ? <img src={form.zdjecie} alt={form.nazwa} className="object-cover" style={{width: '80% !important', height: '100%'}} /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon size={54} /></div>}
                </div>
                {edit ? <input type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0])} className="block w-full text-xs font-bold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:font-black file:text-white" /> : null}
                {edit && form.zdjecie ? <button type="button" onClick={() => setForm({ ...form, zdjecie: '' })} className="text-xs font-black text-red-500">Usuń zdjęcie</button> : null}
              </div>
            <div className="grid gap-5 lg:grid-cols-[540px_1fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nazwa modelu"><input disabled={!edit} className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} /></Field>
                <Field label="Kategoria"><select disabled={!edit} className={inputClass} value={form.id_kategorii || ''} onChange={e => setForm({ ...form, id_kategorii: e.target.value })}><option value="">Brak</option>{categories.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}</select></Field>
                <Field label="Producent"><input disabled={!edit} className={inputClass} value={form.producent || ''} onChange={e => setForm({ ...form, producent: e.target.value })} /></Field>
                <Field label="Typ">
                  <select disabled={!edit} className={inputClass} value={form.typ_sprzetu || 'sprzet'} onChange={e => setForm({ ...form, typ_sprzetu: e.target.value })}>
                    <option value="sprzet">Sprzęt</option>
                    <option value="opakowanie">Opakowanie (Case - rozpakowuje się na WZ)</option>
                    <option value="rack">Rack (Nie rozpakowuje się na WZ)</option>
                    <option value="zestaw">Zestaw</option>
                  </select>
                </Field>
                <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-black text-slate-800">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={quantityModel} onChange={e => { setEdit(true); setForm(applyQuantityMode(form, e.target.checked)); }} />
                    <span>
                      Sprzęt ilościowy
                      <span className="mt-1 block text-xs font-bold text-slate-500">Zaznaczone = jedna pozycja modelu na sztuki, bez numerów/SN. Odznaczone = fizyczne egzemplarze z własnym numerem, kodem i numerem seryjnym. Zmiana automatycznie włącza edycję — potem kliknij „Zapisz model”.</span>
                    </span>
                  </label>
                </div>
                {quantityModel && <>
                  <Field label="Stan ilościowy"><input disabled={!edit} type="number" step="1" min="0" className={inputClass} value={form.ilosc_magazynowa ?? 0} onChange={e => setForm({ ...form, ilosc_magazynowa: e.target.value })} /></Field>
                  <Field label="Jednostka"><input disabled={!edit} className={inputClass} value={form.jednostka || 'szt.'} onChange={e => setForm({ ...form, jednostka: e.target.value })} /></Field>
                  <div className="md:col-span-2">
                    <Field label="Kod kreskowy modelu — wymagany dla sprzętu ilościowego"><input disabled={!edit} required={quantityModel} className={inputClass} value={form.kod_kreskowy || ''} onChange={e => setForm({ ...form, kod_kreskowy: e.target.value })} placeholder="Np. kod z etykiety balastu / kabla / drobnicy" /></Field>
                    <p className="mt-1 text-xs font-bold text-amber-700">Ten kod jest widoczny tylko przy sprzęcie ilościowym. Po skanie przy WZ/PZ system zapyta, ile sztuk wydać albo przyjąć.</p>
                  </div>
                </>}
                <Field label="Cena / wartość domyślna"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.wartosc_domyslna_egzemplarza || ''} onChange={e => setForm({ ...form, wartosc_domyslna_egzemplarza: e.target.value, wartosc: e.target.value })} /></Field>
                <Field label="Miejsce w magazynie"><input disabled={!edit} className={inputClass} value={form.miejsce_w_mag || ''} onChange={e => setForm({ ...form, miejsce_w_mag: e.target.value })} /></Field>
                <Field label="Szerokość"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.szerokosc || ''} onChange={e => setForm({ ...form, szerokosc: e.target.value })} /></Field>
                <Field label="Wysokość"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.wysokosc || ''} onChange={e => setForm({ ...form, wysokosc: e.target.value })} /></Field>
                <Field label="Głębokość"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.glebokosc || ''} onChange={e => setForm({ ...form, glebokosc: e.target.value })} /></Field>
                <Field label="Waga"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.waga || ''} onChange={e => setForm({ ...form, waga: e.target.value })} /></Field>
                <Field label="Objętość"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.objetosc || ''} onChange={e => setForm({ ...form, objetosc: e.target.value })} /></Field>
                <Field label="Pobór prądu"><input disabled={!edit} type="number" step="0.01" className={inputClass} value={form.pobor_pradu || ''} onChange={e => setForm({ ...form, pobor_pradu: e.target.value })} /></Field>
              </div>
            </div>

            <Field label="Opis"><textarea disabled={!edit} className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field>
            <Field label="Notatka wewnętrzna"><textarea disabled={!edit} className={inputClass} value={form.notatki_wewnetrzne || ''} onChange={e => setForm({ ...form, notatki_wewnetrzne: e.target.value })} /></Field>

            {edit && <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><div className="flex gap-2"><Button variant="secondary" type="button" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button><Button variant="danger" type="button" onClick={removeModel}><Trash2 size={16} className="inline" /> Usuń model</Button></div><Button type="submit"><Check size={16} className="inline" /> Zapisz model</Button></div>}
          </form>
        </Card>

        <Card>
          {quantityModel ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black">Sprzęt ilościowy</h2>
                <p className="text-sm font-bold text-slate-400">Ten model jest ewidencjonowany na sztuki. Nie tworzymy egzemplarzy z numerem/SN.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-cyan-50 p-5"><div className="text-xs font-black uppercase text-cyan-700">Stan</div><div className="text-4xl font-black text-slate-900">{Number(form.ilosc_magazynowa || 0)}</div><div className="text-sm font-bold text-slate-500">{form.jednostka || 'szt.'}</div></div>
                <div className="rounded-2xl bg-slate-50 p-5"><div className="text-xs font-black uppercase text-slate-500">Kod skanowania modelu</div><div className={`break-all text-lg font-black ${form.kod_kreskowy ? 'text-slate-900' : 'text-red-600'}`}>{form.kod_kreskowy || 'BRAK KODU — uzupełnij przed wydaniem'}</div></div>
                <div className="rounded-2xl bg-amber-50 p-5"><div className="text-xs font-black uppercase text-amber-700">Wydanie/PZ</div><div className="text-sm font-bold text-slate-600">Po skanie system pyta ile sztuk wydać albo przyjąć.</div></div>
              </div>
              <div className="rounded-2xl border border-dashed p-4 text-sm font-bold text-slate-500">Aby wrócić do pracy na egzemplarzach, wyłącz opcję „Sprzęt ilościowy” i zapisz model. Wtedy można dodawać fizyczne egzemplarze z kodem, numerem i S/N.</div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">Egzemplarze modelu</h2>
                  <p className="text-sm font-bold text-slate-400">Tutaj są fizyczne sztuki z kodami kreskowymi, QR i numerami seryjnymi.</p>
                </div>
                <Button onClick={openAdd}><Plus size={16} className="inline" /> Dodaj egzemplarz</Button>
              </div>
              <DataTable rows={egzemplarze} onRowClick={(r: any) => router.push(`/dashboard/warehouse/items/${r.id}`)} columns={[
                { key: 'nazwa', label: 'Nazwa egzemplarza', value: (r: any) => <b>{r.nazwa || model.nazwa}</b> },
                { key: 'numer', label: 'Numer', value: (r: any) => r.numer_egzemplarza || r.numer_urzadzenia || '-' },
                { key: 'sn', label: 'S/N' },
                { key: 'kod_kreskowy', label: 'Kod kreskowy' },
                { key: 'qr_kod', label: 'QR' },
                { key: 'status', label: 'Status', value: (r: any) => r.status_serwisowy || '-' },
                { key: 'case', label: 'Case', value: (r: any) => r.case?.nazwa || '-' },
              ]} />
            </>
          )}
        </Card>
      </div>

      {showAdd && <SimpleModal title="Dodaj egzemplarz" onClose={() => setShowAdd(false)}><form onSubmit={saveItem} className="space-y-6"><section><h3 className="mb-3 text-lg font-black">Identyfikacja</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa egzemplarza"><input className={inputClass} value={itemForm.nazwa || ''} onChange={e => setItemForm({ ...itemForm, nazwa: e.target.value })} /></Field><Field label="Numer egzemplarza"><input className={inputClass} value={itemForm.numer_egzemplarza || ''} onChange={e => setItemForm({ ...itemForm, numer_egzemplarza: e.target.value, numer_urzadzenia: e.target.value })} /></Field><Field label="Numer seryjny"><input className={inputClass} value={itemForm.sn || ''} onChange={e => setItemForm({ ...itemForm, sn: e.target.value })} /></Field><Field label="Data produkcji"><input type="date" className={inputClass} value={itemForm.data_produkcji || ''} onChange={e => setItemForm({ ...itemForm, data_produkcji: e.target.value })} /></Field></div></section><section><h3 className="mb-3 text-lg font-black">Znakowanie i wycena</h3><label className="mb-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!itemForm.rozroznij_kod_qr} onChange={e => setItemForm({ ...itemForm, rozroznij_kod_qr: e.target.checked, zewnetrzny_qr_kod: e.target.checked ? itemForm.zewnetrzny_qr_kod : itemForm.zewnetrzny_kod_kreskowy })} /> Rozróżnij zewnętrzny kod kreskowy i zewnętrzny kod QR</label><div className="grid gap-4 md:grid-cols-2"><Field label="Zewnętrzny kod kreskowy"><input className={inputClass} value={itemForm.zewnetrzny_kod_kreskowy || ''} onChange={e => setItemForm({ ...itemForm, zewnetrzny_kod_kreskowy: e.target.value, zewnetrzny_qr_kod: itemForm.rozroznij_kod_qr ? itemForm.zewnetrzny_qr_kod : e.target.value, kod_kreskowy: e.target.value })} /></Field><Field label="Zewnętrzny kod QR"><input className={inputClass} disabled={!itemForm.rozroznij_kod_qr} value={itemForm.zewnetrzny_qr_kod || ''} onChange={e => setItemForm({ ...itemForm, zewnetrzny_qr_kod: e.target.value, qr_kod: e.target.value })} /></Field><Field label="Wartość egzemplarza"><input type="number" step="0.01" className={inputClass} value={itemForm.wartosc || ''} onChange={e => setItemForm({ ...itemForm, wartosc: e.target.value })} /></Field><Field label="Cena zakupu"><input type="number" step="0.01" className={inputClass} value={itemForm.cena_zakupu || ''} onChange={e => setItemForm({ ...itemForm, cena_zakupu: e.target.value })} /></Field></div></section><section><h3 className="mb-3 text-lg font-black">Logistyka i magazyn</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Magazyn"><select className={inputClass} value={itemForm.id_magazynu || ''} onChange={e => setItemForm({ ...itemForm, id_magazynu: e.target.value })}><option value="">Brak</option>{magazyny.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field><Field label="Miejsce w magazynie"><input className={inputClass} value={itemForm.miejsce_w_mag || ''} onChange={e => setItemForm({ ...itemForm, miejsce_w_mag: e.target.value })} /></Field><Field label="Status serwisowy"><select className={inputClass} value={itemForm.status_serwisowy || 'Działa'} onChange={e => setItemForm({ ...itemForm, status_serwisowy: e.target.value })}><option>Działa</option><option>Wymaga serwisu (działa)</option><option>Wymaga serwisu (nie działa)</option><option>W serwisie</option><option>Naprawiony</option></select></Field></div></section><section><h3 className="mb-3 text-lg font-black">Notatki i uwagi</h3><Field label="Uwagi"><textarea className={inputClass} value={itemForm.opis || ''} onChange={e => setItemForm({ ...itemForm, opis: e.target.value })} /></Field></section><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowAdd(false)}>Anuluj</Button><Button type="submit">Zapisz egzemplarz</Button></div></form></SimpleModal>}

      {showCalendar && <SimpleModal title="Kalendarz dostępności modelu" onClose={() => setShowCalendar(false)}><div className="space-y-3">{busy.map((b: any) => <div key={b.id} className="rounded-2xl border p-3"><b>{b.tytul}</b><p className="text-sm text-slate-500">{b.start ? new Date(b.start).toLocaleDateString('pl-PL') : '-'} - {b.koniec ? new Date(b.koniec).toLocaleDateString('pl-PL') : '-'} · {b.kontrahent || '-'}</p></div>)}{busy.length === 0 && <p className="font-bold text-slate-400">Brak zajętości.</p>}</div></SimpleModal>}
    </div>
  );
}

function defaultItemForm(model: any, nextNumber = 1) {
  const base = model?.nazwa || '';
  const code = `EF-${model?.id || 'M'}-${nextNumber}`;
  return { nazwa: base, numer_egzemplarza: String(nextNumber), numer_urzadzenia: String(nextNumber), status_serwisowy: 'Działa', wartosc: model?.wartosc_domyslna_egzemplarza || model?.wartosc || '', zewnetrzny_kod_kreskowy: code, zewnetrzny_qr_kod: code, kod_kreskowy: code, qr_kod: code, rozroznij_kod_qr: false };
}
