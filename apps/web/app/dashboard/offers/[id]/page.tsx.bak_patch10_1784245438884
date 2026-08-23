'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Box, Calculator, CheckCircle2, Copy, FileText, Link as LinkIcon, Mail, PackagePlus, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';
import { OfferDuplicateTargetModal } from '../../../../components/OfferDuplicateTargetModal';

function money(v: any) {
  return `${Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}
function asNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function calc(p: any) {
  const cena = asNumber(p.cena_netto, 0);
  const ilosc = asNumber(p.ilosc, 1);
  const dni = asNumber(p.dni_pracy, 1);
  const rabat = asNumber(p.rabat_proc, 0);
  return cena * ilosc * dni * (1 - rabat / 100);
}
const positionTypes = [
  { value: 'sprzet', label: 'Sprzęt' },
  { value: 'obsluga', label: 'Obsługa' },
  { value: 'transport', label: 'Transport' },
  { value: 'nocleg', label: 'Nocleg' },
  { value: 'usluga', label: 'Usługa' },
];

function numberOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function modelCategoryId(model: any) {
  return String(model?.kategoria?.id || model?.id_kategorii || model?.kategoria_id || '');
}
function getCategoryParentId(category: any) {
  return category?.id_rodzica || category?.id_kategorii_glownej || category?.id_kategorii_nadrzednej || category?.parent_id || category?.id_parent || null;
}
function flattenCategories(categories: any[]): any[] {
  const result: any[] = [];
  const walk = (items: any[], parent: any = null, level = 0) => {
    for (const item of items || []) {
      const copy = { ...item, parent, level };
      result.push(copy);
      if (item.dzieci?.length) walk(item.dzieci, copy, level + 1);
      if (item.children?.length) walk(item.children, copy, level + 1);
      if (item.podkategorie?.length) walk(item.podkategorie, copy, level + 1);
    }
  };
  walk(categories || []);
  return result;
}
function buildCategoryTree(categories: any[]) {
  const flatInput = flattenCategories(categories || []);
  const byId = new Map<string, any>();

  for (const cat of flatInput) {
    byId.set(String(cat.id), { ...cat, dzieci: [], _parentId: getCategoryParentId(cat) ? String(getCategoryParentId(cat)) : null });
  }

  for (const cat of Array.from(byId.values())) {
    if (!cat._parentId && cat.parent?.id) cat._parentId = String(cat.parent.id);
  }

  const roots: any[] = [];
  for (const cat of Array.from(byId.values())) {
    if (cat._parentId && byId.has(cat._parentId)) byId.get(cat._parentId).dzieci.push(cat);
    else roots.push(cat);
  }

  const sortByOrder = (items: any[]) => {
    items.sort((a, b) => numberOrZero(a.kolejnosc) - numberOrZero(b.kolejnosc) || String(a.nazwa || '').localeCompare(String(b.nazwa || ''), 'pl'));
    items.forEach((item) => sortByOrder(item.dzieci || []));
  };
  sortByOrder(roots);

  return { roots, byId };
}
function descendantsOf(categoryId: string, byId: Map<string, any>) {
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const cat = byId.get(id);
    for (const child of cat?.dzieci || []) walk(String(child.id));
  };
  walk(categoryId);
  return ids;
}
function categoryPath(categoryId: string, byId: Map<string, any>) {
  const parts: string[] = [];
  let current = byId.get(categoryId);
  let guard = 0;
  while (current && guard < 12) {
    parts.unshift(current.nazwa);
    current = current._parentId ? byId.get(String(current._parentId)) : null;
    guard++;
  }
  return parts.join(' / ');
}

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [offer, setOffer] = useState<any>(null);
  const [showSection, setShowSection] = useState(false);
  const [showSectionEdit, setShowSectionEdit] = useState<any>(null);
  const [showEquipment, setShowEquipment] = useState<any>(null);
  const [showItem, setShowItem] = useState<any>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [budgetForm, setBudgetForm] = useState<any>({ budzet_netto: '', pomin_sekcje_ids: [] });
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentRoot, setEquipmentRoot] = useState('all');
  const [equipmentSub, setEquipmentSub] = useState('');
  const [equipmentCategories, setEquipmentCategories] = useState<any[]>([]);
  const [equipmentQuickQty, setEquipmentQuickQty] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [duplicateTarget, setDuplicateTarget] = useState<any>(null);
  const [dirtyItems, setDirtyItems] = useState<Record<number, any>>({});
  const [notice, setNotice] = useState('');

  async function load() {
    const [o, m, k] = await Promise.all([
      api.get(`/api/oferty/${id}`),
      api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
      api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
    ]);
    setOffer(o.data);
    setModels(m.data || []);
    setEquipmentCategories(k.data || []);
    setDirtyItems({});
  }

  useEffect(() => { load(); }, [id]);

  const version = offer?.wersje?.[0];
  const sections = version?.sekcje || [];
  const positions = sections.flatMap((s: any) => s.pozycje || []);
  const summary = useMemo(() => {
    const sum = (typ: string) => positions.filter((p: any) => p.typ_pozycji === typ).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0);
    const sprzet = sum('sprzet');
    const transport = sum('transport');
    const obsluga = sum('obsluga');
    const nocleg = sum('nocleg');
    const inne = positions.filter((p: any) => !['sprzet', 'transport', 'obsluga', 'nocleg'].includes(p.typ_pozycji)).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0);
    const netto = sprzet + transport + obsluga + nocleg + inne;
    return { sprzet, transport, obsluga, nocleg, inne, netto, vat: netto * .23, brutto: netto * 1.23 };
  }, [offer]);

  const { roots: equipmentCategoryRoots, byId: equipmentCategoryById } = useMemo(() => buildCategoryTree(equipmentCategories), [equipmentCategories]);
  const activeEquipmentRootObj = equipmentRoot !== 'all' ? equipmentCategoryById.get(equipmentRoot) : null;

  function totalForEquipmentCategory(categoryId: string) {
    if (categoryId === 'all') return models.length;
    const ids = descendantsOf(categoryId, equipmentCategoryById);
    return models.filter((m: any) => ids.has(modelCategoryId(m))).length;
  }

  const equipmentModels = useMemo(() => {
    const q = equipmentSearch.trim().toLowerCase();
    const selectedCategoryId = equipmentSub || (equipmentRoot === 'all' ? '' : equipmentRoot);
    const selectedIds = selectedCategoryId ? descendantsOf(selectedCategoryId, equipmentCategoryById) : null;

    return models
      .filter((m: any) => {
        const catId = modelCategoryId(m);
        const categoryLabel = categoryPath(catId, equipmentCategoryById) || m.kategoria_nazwa || m.kategoria?.nazwa || 'Bez kategorii';
        const matchesCategory = !selectedIds || selectedIds.has(catId);
        const matchesQuery = !q || [m.nazwa, categoryLabel, m.typ_sprzetu, m.kod_kreskowy].filter(Boolean).join(' ').toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
      })
      .slice(0, 240);
  }, [models, equipmentSearch, equipmentRoot, equipmentSub, equipmentCategoryById]);

  const dirtyCount = Object.keys(dirtyItems).length;

  const registerDirtyItem = useCallback((itemId: number, patch: any | null) => {
    setDirtyItems((prev) => {
      const next = { ...prev };
      if (!patch) delete next[itemId];
      else next[itemId] = patch;
      return next;
    });
  }, []);

  async function saveAllItems() {
    const entries = Object.entries(dirtyItems);
    if (!entries.length) return;
    setError('');
    setNotice('');
    setSavingId(-999999);
    try {
      await Promise.all(entries.map(([itemId, patch]) => api.put(`/api/oferty/${id}/pozycje/${itemId}`, patch)));
      setDirtyItems({});
      setNotice(`Zapisano ${entries.length} zmienionych pozycji oferty.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać wszystkich zmian.');
    } finally {
      setSavingId(null);
    }
  }

  async function addSection(e: any) {
    e.preventDefault();
    await api.post(`/api/oferty/${id}/sekcje`, form);
    setForm({});
    setShowSection(false);
    load();
  }

  function openEditSection(section: any) {
    setShowSectionEdit(section);
    setForm({ nazwa: section.nazwa || '', opis: section.opis || '', kolor: section.kolor || '#f59e0b', kolejnosc: section.kolejnosc ?? 0, budzet_netto: section.budzet_netto || '' });
  }

  async function saveSectionEdit(e: any) {
    e.preventDefault();
    if (!showSectionEdit) return;
    setError('');
    try {
      await api.put(`/api/oferty/${id}/sekcje/${showSectionEdit.id}`, form);
      setShowSectionEdit(null);
      setForm({});
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać grupy sprzętowej.');
    }
  }

  async function deleteSection(section: any) {
    const count = (section.pozycje || []).length;
    const ok = confirm(`Usunąć grupę „${section.nazwa}” razem z ${count} pozycjami? Te dane zostaną ukryte w ofercie, ale nie będą kasowane fizycznie z bazy.`);
    if (!ok) return;
    setError('');
    try {
      await api.delete(`/api/oferty/${id}/sekcje/${section.id}`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się usunąć grupy sprzętowej.');
    }
  }

  function openAddEquipment(section: any) {
    setShowEquipment(section);
    setEquipmentSearch('');
    setEquipmentRoot('all');
    setEquipmentSub('');
    setEquipmentQuickQty({});
    setForm({ typ_pozycji: 'sprzet', id_modelu: '', nazwa: '', cena_netto: 0, ilosc: 0, dni_pracy: 1, rabat_proc: 0, vat: 23, widoczna_w_pdf: true });
  }

  function pickEquipmentModel(model: any) {
    setForm((prev: any) => ({
      ...prev,
      typ_pozycji: 'sprzet',
      id_modelu: model.id,
      id_kategorii: model.kategoria?.id || model.id_kategorii || undefined,
      nazwa: model.nazwa,
      cena_netto: model.cena_podstawowa || model.cena_netto || model.wartosc_domyslna_egzemplarza || 0,
    }));
  }

  async function quickAddEquipment(model: any) {
    if (!showEquipment) return;
    const qty = Math.max(0, Number(equipmentQuickQty[String(model.id)] || 0) || 0);
    if (qty <= 0) { setError('Wpisz liczbę sztuk większą od 0. Domyślnie picker nie dodaje sprzętu do oferty.'); return; }
    const price = model.cena_podstawowa || model.cena_netto || model.wartosc_domyslna_egzemplarza || 0;
    setError('');
    await api.post(`/api/oferty/${id}/pozycje`, {
      id_sekcji: showEquipment.id,
      typ_pozycji: 'sprzet',
      id_modelu: model.id,
      id_kategorii: model.kategoria?.id || model.id_kategorii || undefined,
      nazwa: model.nazwa,
      cena_netto: price,
      ilosc: qty,
      dni_pracy: Number(form.dni_pracy || 1) || 1,
      rabat_proc: Number(form.rabat_proc || 0) || 0,
      vat: Number(form.vat || 23) || 23,
      widoczna_w_pdf: true,
    });
    await load();
  }

  async function addEquipment(e: any) {
    e.preventDefault();
    if (!showEquipment) return;
    if (!form.id_modelu) {
      setError('Wybierz model sprzętu z listy albo użyj przycisku „Dodaj pozycję ręczną”.');
      return;
    }
    await api.post(`/api/oferty/${id}/pozycje`, { ...form, id_sekcji: showEquipment.id, typ_pozycji: 'sprzet' });
    setForm({});
    setShowEquipment(null);
    load();
  }

  async function addItem(e: any) {
    e.preventDefault();
    await api.post(`/api/oferty/${id}/pozycje`, { ...form, id_sekcji: showItem?.id });
    setForm({});
    setShowItem(null);
    load();
  }

  async function updateItem(item: any, patch: any) {
    setError('');
    setSavingId(item.id);
    try {
      await api.put(`/api/oferty/${id}/pozycje/${item.id}`, { ...item, ...patch });
      registerDirtyItem(item.id, null);
      setNotice('Zapisano pozycję oferty.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać pozycji oferty.');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(item: any) {
    if (!confirm(`Usunąć pozycję „${item.nazwa}”?`)) return;
    await api.delete(`/api/oferty/${id}/pozycje/${item.id}`);
    registerDirtyItem(item.id, null);
    load();
  }

  async function applySectionPatch(section: any, patch: any) {
    const items = section.pozycje || [];
    if (!items.length) return;
    setSavingId(-section.id);
    try {
      await Promise.all(items.map((p: any) => api.put(`/api/oferty/${id}/pozycje/${p.id}`, { ...p, ...patch })));
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function promptSectionDiscount(section: any) {
    const value = window.prompt(`Jaki rabat % nadać całej grupie „${section.nazwa}”?`, '0');
    if (value === null) return;
    await applySectionPatch(section, { rabat_proc: Number(value) });
  }

  async function dupOffer() {
    setDuplicateTarget(offer);
  }
  async function dupSection(section: any) {
    await api.post(`/api/oferty/${id}/sekcje/${section.id}/duplikuj`, {});
    load();
  }
  async function updateSectionColor(section: any, color: string) {
    await api.put(`/api/oferty/${id}/sekcje/${section.id}`, { ...section, kolor: color });
    load();
  }
  async function sync(direction: 'event-to-offer' | 'offer-to-event') {
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/api/oferty/${id}/synchronizuj`, { direction });
      const count = res?.data?.count ?? res?.data?.created ?? 0;
      setNotice(direction === 'offer-to-event'
        ? `Wysłano sprzęt z oferty do wydarzenia: ${count} pozycji.`
        : `Zaciągnięto sprzęt z wydarzenia do oferty: ${count} pozycji.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zsynchronizować sprzętu.');
    }
  }
  async function applyBudget(e: any) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/api/oferty/${id}/budzet`, budgetForm);
      setShowBudget(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się zastosować budżetu.');
    }
  }
  function toggleSectionLock(sectionId: number) {
    setBudgetForm((prev: any) => {
      const arr = prev.pomin_sekcje_ids || [];
      return { ...prev, pomin_sekcje_ids: arr.includes(sectionId) ? arr.filter((x: number) => x !== sectionId) : [...arr, sectionId] };
    });
  }

  function openAddItem(section: any) {
    setShowItem(section);
    setForm({ typ_pozycji: 'sprzet', dni_pracy: 1, ilosc: 1, rabat_proc: 0, vat: 23, widoczna_w_pdf: true });
  }

  if (!offer) return <p className="p-8 font-bold text-slate-400">Ładowanie oferty...</p>;

  return <div className="mx-auto max-w-[1800px] space-y-6">
    <PageTitle
      eyebrow="Oferty"
      title={offer.nazwa}
      description={`${offer.numer || ''} · ${offer.kontrahent?.nazwa || 'brak klienta'} · przypisana do wydarzenia: ${offer.wydarzenie?.nazwa || '-'}`}
      action={<div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline" /> Powrót</Button>
        {dirtyCount > 0 && <Button onClick={saveAllItems}><Save size={16} className="inline" /> Zapisz wszystkie zmiany ({dirtyCount})</Button>}
        <Button variant="secondary" onClick={dupOffer}><Copy size={16} className="inline" /> Duplikuj</Button>
        <Button variant="secondary"><Mail size={16} className="inline" /> Wyślij E-mailem</Button>
        <Button variant="secondary" onClick={() => window.open(`/dashboard/offers/${id}/pdf`, '_blank')}><FileText size={16} className="inline" /> PDF</Button>
        <Button variant="secondary" onClick={() => { setBudgetForm({ budzet_netto: offer.budzet_netto || Math.round(summary.netto), pomin_sekcje_ids: [] }); setShowBudget(true); }}><Calculator size={16} className="inline" /> Budżet</Button>
        <Button onClick={() => setShowSection(true)}><Plus size={16} className="inline" /> Dodaj grupę sprzętową</Button>
      </div>}
    />

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

    <div className="grid gap-6 xl:grid-cols-[0.8fr_0.8fr_0.8fr]">
      <Card><h2 className="text-lg font-black">Dane oferty</h2><div className="mt-4 space-y-3 text-sm"><p><b>Klient:</b> {offer.kontrahent?.nazwa || '-'}</p><p><b>Status:</b> {offer.status?.nazwa || 'Nowa'}</p><p><b>Termin płatności:</b> {offer.termin_platnosci_dni || 14} dni</p><p><b>Budżet:</b> {money(offer.budzet_netto)}</p><p><b>Algorytm:</b> {offer.algorytm_budzetu || 'brak'}</p></div></Card>
      <Card><h2 className="text-lg font-black">Podsumowanie</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p>Sprzęt<br /><b>{money(summary.sprzet)}</b></p><p>Transport<br /><b>{money(summary.transport)}</b></p><p>Obsługa<br /><b>{money(summary.obsluga)}</b></p><p>Nocleg<br /><b>{money(summary.nocleg)}</b></p><p>Netto<br /><b>{money(summary.netto)}</b></p><p>Brutto<br /><b>{money(summary.brutto)}</b></p></div>{Number(offer.rabat_budzetowy_netto || 0) > 0 && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-black text-emerald-700">Obniżka budżetowa: {money(offer.rabat_budzetowy_netto)} ({Number(offer.rabat_budzetowy_proc || 0).toFixed(2)}%)</p>}</Card>
      <Card><h2 className="text-lg font-black">Powiązanie z wydarzeniem</h2><div className="mt-4 flex flex-col gap-2"><Button variant="secondary" onClick={() => sync('event-to-offer')}><LinkIcon size={16} className="inline" /> Zaciągnij sprzęt z wydarzenia</Button><Button variant="secondary" onClick={() => sync('offer-to-event')}><Save size={16} className="inline" /> Wyślij ofertę do wydarzenia</Button></div><p className="mt-3 text-xs font-bold text-slate-400">Oferta może być stale korygowana: sztuki, dni, rabaty, typ pozycji i widoczność w PDF zapisujesz bezpośrednio w tabeli.</p></Card>
    </div>

    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        {sections.map((s: any) => <button key={s.id} className="rounded-xl border px-4 py-2 text-sm font-black"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: s.kolor || '#f59e0b' }} /> {s.nazwa} {money((s.pozycje || []).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0))}</button>)}
        </div>
        <Button onClick={saveAllItems} disabled={dirtyCount === 0 || savingId === -999999}>{savingId === -999999 ? 'Zapisywanie...' : `Zapisz wszystkie zmiany${dirtyCount ? ` (${dirtyCount})` : ''}`}</Button>
      </div>

      <div className="space-y-6">
        {sections.map((section: any) => <div key={section.id} className="rounded-2xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl px-4 py-3 text-white" style={{ backgroundColor: section.kolor || '#f59e0b' }}>
            <h3 className="text-lg font-black">{section.nazwa}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-black">Kolor <input type="color" value={section.kolor || '#f59e0b'} onChange={(e) => updateSectionColor(section, e.target.value)} className="h-6 w-8 rounded border-0 bg-transparent" /></label>
              <button onClick={() => openEditSection(section)} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-black"><Pencil size={14} className="inline" /> Edytuj nazwę</button>
              <button onClick={() => promptSectionDiscount(section)} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-black">Rabat grupy</button>
              <button onClick={() => applySectionPatch(section, { dni_pracy: 1 })} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-black">Dni = 1</button>
              <button onClick={() => dupSection(section)} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-black">Duplikuj grupę</button>
              <button onClick={() => openAddEquipment(section)} className="rounded-lg bg-white/25 px-3 py-1 text-xs font-black"><PackagePlus size={14} className="inline" /> Dodaj sprzęt</button>
              <button onClick={() => openAddItem(section)} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-black">+ Pozycja ręczna</button>
              <button onClick={() => deleteSection(section)} className="rounded-lg bg-red-500/80 px-3 py-1 text-xs font-black">Usuń grupę</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Nazwa / typ</th>
                  <th className="p-2 text-left">Opis</th>
                  <th className="p-2">Cena netto</th>
                  <th className="p-2">Szt.</th>
                  <th className="p-2">Dni pracy</th>
                  <th className="p-2">Rabat %</th>
                  <th className="p-2">VAT %</th>
                  <th className="p-2">PDF</th>
                  <th className="p-2 text-right">Razem netto</th>
                  <th className="p-2 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {(section.pozycje || []).map((p: any) => <OfferPositionRow key={p.id} item={p} saving={savingId === p.id} onDraftChange={registerDirtyItem} onUpdate={(patch: any) => updateItem(p, patch)} onDelete={() => deleteItem(p)} />)}
              </tbody>
            </table>
          </div>
        </div>)}
      </div>
    </Card>

    {duplicateTarget && <OfferDuplicateTargetModal offer={duplicateTarget} defaultEventId={offer?.id_wydarzenia} defaultRentalId={offer?.id_wynajmu} onClose={() => setDuplicateTarget(null)} onDone={(o) => router.push(`/dashboard/offers/${o.id}`)} />}

    {showBudget && <SimpleModal title="Dostosuj ofertę do budżetu klienta" onClose={() => setShowBudget(false)}>
      {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      <form onSubmit={applyBudget} className="space-y-4">
        <Field label="Budżet klienta netto"><input type="number" step="0.01" className={inputClass} value={budgetForm.budzet_netto || ''} onChange={e => setBudgetForm({ ...budgetForm, budzet_netto: e.target.value })} required /></Field>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-2 text-sm font-black text-slate-700">Nie zmieniaj cen w tych grupach:</p><div className="grid gap-2 md:grid-cols-2">{sections.map((s: any) => <label key={s.id} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold"><input type="checkbox" checked={(budgetForm.pomin_sekcje_ids || []).includes(s.id)} onChange={() => toggleSectionLock(s.id)} /><span className="inline-block h-3 w-3 rounded-full" style={{ background: s.kolor || '#f59e0b' }} /> {s.nazwa}</label>)}</div></div>
        <p className="text-xs font-bold text-slate-500">System proporcjonalnie obniża tylko sprzęt. Obsługa, nocleg, transport i usługi nie są zmieniane.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowBudget(false)}>Anuluj</Button><Button type="submit">Zastosuj budżet</Button></div>
      </form>
    </SimpleModal>}

    {showSection && <SimpleModal title="Dodaj grupę / sekcję" onClose={() => setShowSection(false)}><form onSubmit={addSection} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} required /></Field><Field label="Kolor"><input type="color" className={inputClass} value={form.kolor || '#f59e0b'} onChange={e => setForm({ ...form, kolor: e.target.value })} /></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowSection(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}

    {showSectionEdit && <SimpleModal title={`Edytuj grupę: ${showSectionEdit.nazwa}`} onClose={() => setShowSectionEdit(null)}><form onSubmit={saveSectionEdit} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa grupy"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} required /></Field><Field label="Kolor grupy"><input type="color" className={inputClass} value={form.kolor || '#f59e0b'} onChange={e => setForm({ ...form, kolor: e.target.value })} /></Field><Field label="Kolejność"><input type="number" className={inputClass} value={form.kolejnosc || 0} onChange={e => setForm({ ...form, kolejnosc: e.target.value })} /></Field><Field label="Budżet grupy netto"><input type="number" step="0.01" className={inputClass} value={form.budzet_netto || ''} onChange={e => setForm({ ...form, budzet_netto: e.target.value })} /></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field><p className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500">Zmiana nazwy/koloru grupy aktualizuje widok oferty i PDF. Usuwanie grupy jest osobną akcją z potwierdzeniem.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowSectionEdit(null)}>Anuluj</Button><Button type="submit">Zapisz grupę</Button></div></form></SimpleModal>}

    {showEquipment && <SimpleModal className="max-w-[1500px]" title={`Dodaj sprzęt do grupy: ${showEquipment.nazwa}`} onClose={() => setShowEquipment(null)}>
      <form onSubmit={addEquipment} className="space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-cyan-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 bg-gradient-to-r from-slate-950 via-cyan-950 to-cyan-700 p-5 text-white lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Picker sprzętu</p>
              <h3 className="mt-1 text-2xl font-black">Wybierz kategorię, model i ilość</h3>
              <p className="mt-1 max-w-3xl text-sm font-bold text-cyan-100">Oferta pracuje na modelach i ilościach. Egzemplarze wybierasz dopiero przy wydaniu/przyjęciu magazynowym.</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">
              Widoczne modele: {equipmentModels.length}
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[430px_1fr_360px]">
            <aside className="border-b border-cyan-100 bg-cyan-50/40 p-5 xl:border-b-0 xl:border-r">
              <Field label="Szukaj modelu">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input className={`${inputClass} pl-10`} placeholder="projektor, monitor, kabel..." value={equipmentSearch} onChange={e => setEquipmentSearch(e.target.value)} />
                </div>
              </Field>

              <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Kategorie główne</p>
                <div className="flex max-h-[190px] flex-wrap gap-2 overflow-y-auto pr-1">
                  <button type="button" onClick={() => { setEquipmentRoot('all'); setEquipmentSub(''); }} className={`rounded-2xl px-4 py-3 text-sm font-black ${equipmentRoot === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-cyan-50'}`}>Wszystkie <span className="opacity-60">{models.length}</span></button>
                  {equipmentCategoryRoots.map((root: any) => <button key={root.id} type="button" onClick={() => { setEquipmentRoot(String(root.id)); setEquipmentSub(''); }} className={`rounded-2xl px-4 py-3 text-sm font-black ${equipmentRoot === String(root.id) ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-cyan-50'}`}>{root.nazwa} <span className="opacity-60">{totalForEquipmentCategory(String(root.id))}</span></button>)}
                </div>
              </div>

              {activeEquipmentRootObj?.dzieci?.length > 0 && <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Podkategorie</p>
                <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
                  <button type="button" onClick={() => setEquipmentSub('')} className={`rounded-2xl px-4 py-3 text-sm font-black ${!equipmentSub ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>Wszystkie w {activeEquipmentRootObj.nazwa}</button>
                  {activeEquipmentRootObj.dzieci.map((child: any) => <button key={child.id} type="button" onClick={() => setEquipmentSub(String(child.id))} className={`rounded-2xl px-4 py-3 text-sm font-black ${equipmentSub === String(child.id) ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{child.nazwa} <span className="opacity-60">{totalForEquipmentCategory(String(child.id))}</span></button>)}
                </div>
              </div>}
            </aside>

            <main className="bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Lista modeli</p>
                  <h4 className="text-lg font-black text-slate-900">Kliknij model albo od razu wpisz ilość</h4>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">Bez koszyka</span>
              </div>

              <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                {equipmentModels.map((m: any) => {
                  const active = Number(form.id_modelu) === Number(m.id);
                  const price = m.cena_podstawowa || m.cena_netto || m.wartosc_domyslna_egzemplarza || 0;
                  const qty = equipmentQuickQty[String(m.id)] ?? '0';
                  const selected = Number(qty || 0) > 0;
                  const catId = modelCategoryId(m);
                  const catLabel = categoryPath(catId, equipmentCategoryById) || m.kategoria_nazwa || m.kategoria?.nazwa || 'Bez kategorii';
                  return <div key={m.id} className={`grid gap-3 rounded-2xl border p-3 transition md:grid-cols-[76px_1fr_120px_150px] md:items-center ${active || selected ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40'}`}>
                    <button type="button" onClick={() => pickEquipmentModel(m)} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs font-black text-slate-400">
                      {m.zdjecie ? <img src={m.zdjecie} alt="" className="h-full w-full object-cover" /> : <Box size={22} />}
                    </button>
                    <button type="button" onClick={() => pickEquipmentModel(m)} className="min-w-0 text-left">
                      <b className="block text-sm leading-snug text-slate-900">{m.nazwa}</b>
                      <p className="mt-1 truncate text-xs font-bold text-slate-400">{catLabel}</p>
                      <p className="mt-1 text-xs font-black text-cyan-700">Dostępne: {m.dostepnych ?? m.stan?.magazyn ?? m.na_stanie ?? '-'}</p>
                    </button>
                    <div className="text-left md:text-center">
                      <p className="text-[11px] font-black uppercase text-slate-400">Cena</p>
                      <p className="text-sm font-black text-cyan-700">{money(price)}</p>
                    </div>
                    <div className="grid grid-cols-[72px_1fr] gap-2">
                      <input type="number" min="0" step="1" className={`${inputClass} text-center font-black`} value={qty} onChange={(e) => setEquipmentQuickQty((prev) => ({ ...prev, [String(m.id)]: e.target.value }))} aria-label="Ilość sztuk" />
                      <button type="button" onClick={() => quickAddEquipment(m)} className={selected ? "rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700" : "rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-700"}>{selected ? 'Dodaj' : 'Dodaj'}</button>
                    </div>
                  </div>;
                })}
                {!equipmentModels.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Nie znaleziono sprzętu. Zmień kategorię albo wpisz inną frazę.</p>}
              </div>
            </main>

            <aside className="border-t border-cyan-100 bg-slate-50 p-5 xl:border-l xl:border-t-0">
              <div className="sticky top-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-black text-slate-700">Dodaj wybrany model z parametrami</p>
                  {form.id_modelu ? <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700">Wybrany model</p>
                    <p className="mt-1 font-black text-slate-900">{form.nazwa}</p>
                  </div> : <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-400">Wybierz model z listy albo użyj szybkiego „Dodaj”.</div>}

                  <div className="space-y-3">
                    <Field label="Nazwa na ofercie"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} required /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Sztuk"><input type="number" step="0.01" className={inputClass} value={form.ilosc || 1} onChange={e => setForm({ ...form, ilosc: e.target.value })} /></Field>
                      <Field label="Dni pracy"><input type="number" step="0.01" className={inputClass} value={form.dni_pracy || 1} onChange={e => setForm({ ...form, dni_pracy: e.target.value })} /></Field>
                      <Field label="Rabat %"><input type="number" step="0.01" className={inputClass} value={form.rabat_proc || 0} onChange={e => setForm({ ...form, rabat_proc: e.target.value })} /></Field>
                      <Field label="Cena netto"><input type="number" step="0.01" className={inputClass} value={form.cena_netto || 0} onChange={e => setForm({ ...form, cena_netto: e.target.value })} /></Field>
                    </div>
                    <Field label="Opis / uwagi"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-bold text-slate-500">Razem netto</p>
                      <p className="text-2xl font-black text-slate-900">{money(calc(form))}</p>
                      <p className="text-xs font-bold text-slate-400">Cena × sztuki × dni × rabat.</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowEquipment(null)}>Anuluj</Button><Button type="submit"><PackagePlus size={16} className="inline" /> Dodaj wybrany model</Button></div>
      </form>
    </SimpleModal>}

    {showItem && <SimpleModal title={`Dodaj pozycję ręczną do: ${showItem.nazwa}`} onClose={() => setShowItem(null)}><form onSubmit={addItem} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Typ pozycji"><select className={inputClass} value={form.typ_pozycji || 'sprzet'} onChange={e => setForm({ ...form, typ_pozycji: e.target.value })}>{positionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field><Field label="Model sprzętu"><select className={inputClass} value={form.id_modelu || ''} onChange={e => { const m = models.find((x: any) => String(x.id) === e.target.value); setForm({ ...form, id_modelu: e.target.value, nazwa: m?.nazwa || form.nazwa, cena_netto: m?.cena_podstawowa || form.cena_netto || 0 }); }}><option value="">Pozycja ręczna</option>{models.map((m: any) => <option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field><Field label="Nazwa"><input className={inputClass} required value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} /></Field><Field label="Cena netto"><input type="number" step="0.01" className={inputClass} value={form.cena_netto || ''} onChange={e => setForm({ ...form, cena_netto: e.target.value })} /></Field><Field label="Liczba"><input type="number" step="0.01" className={inputClass} value={form.ilosc || 1} onChange={e => setForm({ ...form, ilosc: e.target.value })} /></Field><Field label="Dni pracy"><input type="number" step="0.01" className={inputClass} value={form.dni_pracy || 1} onChange={e => setForm({ ...form, dni_pracy: e.target.value })} /></Field><Field label="Rabat %"><input type="number" step="0.01" className={inputClass} value={form.rabat_proc || 0} onChange={e => setForm({ ...form, rabat_proc: e.target.value })} /></Field><Field label="VAT %"><input type="number" step="0.01" className={inputClass} value={form.vat || 23} onChange={e => setForm({ ...form, vat: e.target.value })} /></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowItem(null)}>Anuluj</Button><Button type="submit">Dodaj pozycję</Button></div></form></SimpleModal>}
  </div>;
}

function OfferPositionRow({ item, saving, onDraftChange, onUpdate, onDelete }: { item: any; saving: boolean; onDraftChange: (itemId: number, patch: any | null) => void; onUpdate: (patch: any) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<any>(item);
  useEffect(() => setDraft(item), [item]);
  const predicted = calc(draft);
  const changed = JSON.stringify({
    nazwa: draft.nazwa,
    opis: draft.opis,
    typ_pozycji: draft.typ_pozycji,
    cena_netto: Number(draft.cena_netto || 0),
    ilosc: Number(draft.ilosc || 0),
    dni_pracy: Number(draft.dni_pracy || 0),
    rabat_proc: Number(draft.rabat_proc || 0),
    vat: Number(draft.vat || 0),
    widoczna_w_pdf: Boolean(draft.widoczna_w_pdf),
  }) !== JSON.stringify({
    nazwa: item.nazwa,
    opis: item.opis,
    typ_pozycji: item.typ_pozycji,
    cena_netto: Number(item.cena_netto || 0),
    ilosc: Number(item.ilosc || 0),
    dni_pracy: Number(item.dni_pracy || 0),
    rabat_proc: Number(item.rabat_proc || 0),
    vat: Number(item.vat || 0),
    widoczna_w_pdf: Boolean(item.widoczna_w_pdf),
  });
  const patch = {
    nazwa: draft.nazwa,
    opis: draft.opis,
    typ_pozycji: draft.typ_pozycji,
    cena_netto: Number(draft.cena_netto || 0),
    ilosc: Number(draft.ilosc || 1),
    dni_pracy: Number(draft.dni_pracy || 1),
    rabat_proc: Number(draft.rabat_proc || 0),
    vat: Number(draft.vat || 23),
    widoczna_w_pdf: Boolean(draft.widoczna_w_pdf),
  };

  useEffect(() => {
    onDraftChange(item.id, changed ? patch : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, changed, JSON.stringify(patch)]);

  const bump = (field: 'ilosc' | 'dni_pracy' | 'rabat_proc', delta: number, min = 0) => {
    const next = Math.max(min, Number(draft[field] || 0) + delta);
    setDraft({ ...draft, [field]: next });
  };

  return <tr className="border-t align-top">
    <td className="p-2">
      <input className={`${inputClass} mb-2`} value={draft.nazwa || ''} onChange={(e) => setDraft({ ...draft, nazwa: e.target.value })} />
      <select className={inputClass} value={draft.typ_pozycji || 'sprzet'} onChange={(e) => setDraft({ ...draft, typ_pozycji: e.target.value })}>{positionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
    </td>
    <td className="p-2"><textarea className={`${inputClass} min-h-[76px]`} value={draft.opis || ''} onChange={(e) => setDraft({ ...draft, opis: e.target.value })} /></td>
    <td className="p-2"><input type="number" step="0.01" className={`${inputClass} w-28`} value={draft.cena_netto || 0} onChange={(e) => setDraft({ ...draft, cena_netto: e.target.value })} /></td>
    <td className="p-2"><Stepper value={draft.ilosc || 1} onMinus={() => bump('ilosc', -1, 0)} onPlus={() => bump('ilosc', 1, 0)} onChange={(value) => setDraft({ ...draft, ilosc: value })} /></td>
    <td className="p-2"><Stepper value={draft.dni_pracy || 1} onMinus={() => bump('dni_pracy', -1, 0)} onPlus={() => bump('dni_pracy', 1, 0)} onChange={(value) => setDraft({ ...draft, dni_pracy: value })} /></td>
    <td className="p-2"><Stepper value={draft.rabat_proc || 0} suffix="%" onMinus={() => bump('rabat_proc', -5, 0)} onPlus={() => bump('rabat_proc', 5, 0)} onChange={(value) => setDraft({ ...draft, rabat_proc: value })} /></td>
    <td className="p-2"><input type="number" step="0.01" className={`${inputClass} w-20`} value={draft.vat || 23} onChange={(e) => setDraft({ ...draft, vat: e.target.value })} /></td>
    <td className="p-2 text-center"><input type="checkbox" checked={Boolean(draft.widoczna_w_pdf)} onChange={(e) => setDraft({ ...draft, widoczna_w_pdf: e.target.checked })} /></td>
    <td className="p-2 text-right font-black"><span className={changed ? 'text-cyan-700' : ''}>{money(changed ? predicted : (item.razem_netto || predicted))}</span>{Number(item.rabat_budzetowy_netto || 0) > 0 && <p className="text-xs text-emerald-700">budżet -{money(item.rabat_budzetowy_netto)}</p>}</td>
    <td className="p-2 text-right"><div className="flex justify-end gap-2"><button onClick={() => onUpdate(patch)} disabled={!changed || saving} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Save size={14} className="inline" /> {saving ? '...' : 'Zapisz'}</button><button onClick={onDelete} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600"><Trash2 size={14} className="inline" /></button></div></td>
  </tr>;
}

function Stepper({ value, suffix, onMinus, onPlus, onChange }: { value: any; suffix?: string; onMinus: () => void; onPlus: () => void; onChange: (value: string) => void }) {
  return <div className="flex w-32 items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
    <button type="button" onClick={onMinus} className="px-2 py-2 font-black text-slate-500 hover:bg-slate-50">−</button>
    <input type="number" step="0.01" className="w-full border-0 px-1 py-2 text-center text-sm font-black outline-none" value={value} onChange={(e) => onChange(e.target.value)} />
    {suffix && <span className="pr-1 text-xs font-black text-slate-400">{suffix}</span>}
    <button type="button" onClick={onPlus} className="px-2 py-2 font-black text-slate-500 hover:bg-slate-50">+</button>
  </div>;
}
