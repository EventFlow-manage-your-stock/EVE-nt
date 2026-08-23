'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Box, Calculator, CheckCircle2, Copy, FileText, 
  Layers, Link as LinkIcon, Mail, PackagePlus, Pencil, Plus, 
  Save, Search, Trash2, Printer, Calendar, MapPin, Loader2 
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle, SearchableSelect } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';
import { OfferDuplicateTargetModal } from '../../../../components/OfferDuplicateTargetModal';

// --- HELPERY MATEMATYCZNE ---
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

// --- HELPERY KATEGORII ---
function numberOrZero(value: any) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function modelCategoryId(model: any) { return String(model?.kategoria?.id || model?.id_kategorii || model?.kategoria_id || ''); }
function getCategoryParentId(cat: any) { return cat?.id_rodzica || cat?.id_kategorii_glownej || cat?.parent_id || null; }
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
  for (const cat of flatInput) byId.set(String(cat.id), { ...cat, dzieci: [], _parentId: getCategoryParentId(cat) ? String(getCategoryParentId(cat)) : null });
  for (const cat of Array.from(byId.values())) if (!cat._parentId && cat.parent?.id) cat._parentId = String(cat.parent.id);
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

const tableInputClass = "w-full border border-transparent bg-transparent hover:border-slate-300 focus:border-cyan-500 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition font-semibold text-slate-800 placeholder-slate-300";

// ============================================================================
// WYSZUKIWARKA SPRZĘTU INLINE
// ============================================================================
function InlineEquipmentAdder({ sectionId, models, onAdd }: { sectionId: number, models: any[], onAdd: (model: any) => void }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return models.filter((m: any) => 
      `${m.nazwa} ${m.kod_kreskowy || ''}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, models]);

  return (
    <div className="relative p-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Wyszukaj sprzęt i naciśnij Enter..." 
          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        />
        {isFocused && filtered.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden">
            {filtered.map(m => (
              <button 
                key={m.id} 
                className="w-full text-left px-4 py-2 text-sm font-semibold hover:bg-cyan-50 hover:text-cyan-700 transition border-b border-slate-100 last:border-0 flex justify-between items-center"
                onClick={() => { onAdd(m); setQuery(''); }}
              >
                <span>{m.nazwa}</span>
                <span className="text-xs text-slate-400">{money(m.cena_podstawowa || m.cena_netto || m.wartosc_domyslna_egzemplarza)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {query && filtered.length === 0 && <span className="text-xs font-bold text-slate-400">Brak wyników w bazie.</span>}
    </div>
  );
}

// ============================================================================
// GŁÓWNY KOMPONENT OFERTY
// ============================================================================
export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Dane z API
  const [offer, setOffer] = useState<any>(null);
  const [localSections, setLocalSections] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [equipmentCategories, setEquipmentCategories] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [dict, setDict] = useState<any>({ kontrahenci: [], statusy: [] });
  
  // Stany formularzy / modali
  const [offerMetaForm, setOfferMetaForm] = useState<any>({});
  const [metaDirty, setMetaDirty] = useState(false);
  const [showSection, setShowSection] = useState(false);
  const [showSectionEdit, setShowSectionEdit] = useState<any>(null);
  const [showEquipment, setShowEquipment] = useState<any>(null);
  const [showItem, setShowItem] = useState<any>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [showBundle, setShowBundle] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [budgetForm, setBudgetForm] = useState<any>({ budzet_netto: '', algorytm: '', pomin_sekcje_ids: [] });
  
  // Magazyn Picker
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentRoot, setEquipmentRoot] = useState('all');
  const [equipmentSub, setEquipmentSub] = useState('');
  const [equipmentQuickQty, setEquipmentQuickQty] = useState<Record<string, string>>({});
  
  // Auto-Zapis i Status
  const [savingId, setSavingId] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const [error, setError] = useState('');
  const [duplicateTarget, setDuplicateTarget] = useState<any>(null);
  const [dirtyItems, setDirtyItems] = useState<Record<number, any>>({});
  const [notice, setNotice] = useState('');

  // Opcje PDF
  const [showPdfSettings, setShowPdfSettings] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({ 
    showUnitPrices: true, 
    showDiscounts: true, 
    showDays: true, 
    showSectionSummary: true, 
    showThumbnails: false,
    showWeight: false,
    showVat: false,
    showSummaryNetto: true,
    showSummaryVat: true,
    showSummaryBrutto: true 
  });

  async function load() {
    const [o, m, k, b, kon, stat, ev, ren] = await Promise.all([
      api.get(`/api/oferty/${id}`),
      api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
      api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
      api.get('/api/pakiety').catch(() => ({ data: [] })),
      api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
      api.get('/api/slowniki/statusy-ofert').catch(() => ({ data: [] })),
      api.get('/api/wydarzenia').catch(() => ({ data: [] })),
      api.get('/api/wynajmy').catch(() => ({ data: [] })),
    ]);
    const offerData = o.data;
    setOffer(offerData);
    setLocalSections(offerData?.wersje?.[0]?.sekcje || []);
    setEvents(ev.data || []);
    setRentals(ren.data || []);
    setOfferMetaForm({
      nazwa: offerData.nazwa,
      id_kontrahenta: offerData.id_kontrahenta ? String(offerData.id_kontrahenta) : '',
      id_statusu_oferty: offerData.id_statusu_oferty ? String(offerData.id_statusu_oferty) : '',
      termin_platnosci_dni: offerData.termin_platnosci_dni,
      id_wydarzenia: offerData.id_wydarzenia ? String(offerData.id_wydarzenia) : '',
      id_wynajmu: offerData.id_wynajmu ? String(offerData.id_wynajmu) : '',
      budzet_netto: offerData.budzet_netto,
      algorytm_budzetu: offerData.algorytm_budzetu || 'brak',
    });
    setModels(m.data || []);
    setEquipmentCategories(k.data || []);
    setBundles(b.data || []);
    setDict({ kontrahenci: kon.data || [], statusy: stat.data || [] });
    setDirtyItems({});
    setMetaDirty(false);
  }

  useEffect(() => { load(); }, [id]);

  // ==========================================================================
  // OBLICZENIA I PODSUMOWANIA (Dynamiczne)
  // ==========================================================================
  const summary = useMemo(() => {
    let sprzet = 0, transport = 0, obsluga = 0, nocleg = 0, usluga = 0, inne = 0;
    const positions = localSections.flatMap((s: any) => s.pozycje || []);
    
    positions.forEach((p: any) => {
      const current = dirtyItems[p.id] ? { ...p, ...dirtyItems[p.id] } : p;
      const total = current.razem_netto !== undefined && !dirtyItems[p.id] ? Number(current.razem_netto) : calc(current);
      
      if (current.typ_pozycji === 'sprzet') sprzet += total;
      else if (current.typ_pozycji === 'transport') transport += total;
      else if (current.typ_pozycji === 'obsluga') obsluga += total;
      else if (current.typ_pozycji === 'nocleg') nocleg += total;
      else if (current.typ_pozycji === 'usluga') usluga += total;
      else inne += total;
    });

    const netto = sprzet + transport + obsluga + nocleg + usluga + inne;
    return { sprzet, transport, obsluga, nocleg, usluga, inne, netto, vat: netto * 0.23, brutto: netto * 1.23 };
  }, [localSections, dirtyItems]);

  // ==========================================================================
  // AUTO-SAVE MECHANIZM
  // ==========================================================================
  const dirtyCount = Object.keys(dirtyItems).length;

  const registerDirtyItem = useCallback((itemId: number, patch: any | null) => {
    setDirtyItems((prev) => {
      const next = { ...prev };
      if (!patch) delete next[itemId];
      else next[itemId] = patch;
      return next;
    });
  }, []);

  function handleMetaChange(field: string, value: any) {
    setOfferMetaForm((prev: any) => ({ ...prev, [field]: value }));
    setMetaDirty(true);
  }

  useEffect(() => {
    if (dirtyCount === 0 && !metaDirty) return;
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => { saveAllChanges(); }, 1500);
    return () => clearTimeout(timer);
  }, [dirtyItems, offerMetaForm, metaDirty]);

  async function saveAllChanges() {
    if (dirtyCount === 0 && !metaDirty) return;
    setSavingId(-999999);
    setAutoSaveStatus('saving');
    setError('');
    try {
      const promises: Promise<any>[] = [];
      if (metaDirty) {
        promises.push(api.put(`/api/oferty/${id}`, {
          nazwa: offerMetaForm.nazwa,
          id_kontrahenta: offerMetaForm.id_kontrahenta ? Number(offerMetaForm.id_kontrahenta) : null,
          id_statusu_oferty: offerMetaForm.id_statusu_oferty ? Number(offerMetaForm.id_statusu_oferty) : null,
          termin_platnosci_dni: Number(offerMetaForm.termin_platnosci_dni),
          id_wydarzenia: offerMetaForm.id_wydarzenia ? Number(offerMetaForm.id_wydarzenia) : null,
          id_wynajmu: offerMetaForm.id_wynajmu ? Number(offerMetaForm.id_wynajmu) : null,
        }));
      }
      const entries = Object.entries(dirtyItems);
      if (entries.length > 0) {
        entries.forEach(([itemId, patch]) => {
          promises.push(api.put(`/api/oferty/${id}/pozycje/${itemId}`, patch));
        });
      }
      await Promise.all(promises);
      setDirtyItems({});
      setMetaDirty(false);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
      api.get(`/api/oferty/${id}/przelicz`).catch(() => {});
    } catch (err: any) {
      setError('Błąd zapisu. Sprawdź połączenie.');
      setAutoSaveStatus('idle');
    } finally {
      setSavingId(null);
    }
  }

  // ==========================================================================
  // AKCJE SEKCJI I POZYCJI
  // ==========================================================================
  async function addSection(e: any) {
    e.preventDefault();
    await api.post(`/api/oferty/${id}/sekcje`, form);
    setForm({});
    setShowSection(false);
    load();
  }

  function openEditSection(section: any) {
    setShowSectionEdit(section);
    setForm({ nazwa: section.nazwa || '', opis: section.opis || '', kolor: section.kolor || '#0891B2', kolejnosc: section.kolejnosc ?? 0, budzet_netto: section.budzet_netto || '' });
  }

  async function saveSectionEdit(e: any) {
    e.preventDefault();
    if (!showSectionEdit) return;
    try {
      await api.put(`/api/oferty/${id}/sekcje/${showSectionEdit.id}`, form);
      setShowSectionEdit(null);
      setForm({});
      await load();
    } catch (err: any) {
      setError(err?.message || 'Błąd zapisu grupy.');
    }
  }

  async function deleteSection(section: any) {
    if (!confirm(`Usunąć grupę „${section.nazwa}”?`)) return;
    try {
      await api.delete(`/api/oferty/${id}/sekcje/${section.id}`);
      await load();
    } catch (err: any) {
      setError('Błąd usuwania grupy.');
    }
  }

  async function handleSummaryDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const srcIdx = Number(e.dataTransfer.getData('sectionIndex'));
    if (isNaN(srcIdx) || srcIdx === targetIdx) return;
    const newSections = [...localSections];
    const [moved] = newSections.splice(srcIdx, 1);
    newSections.splice(targetIdx, 0, moved);
    setLocalSections(newSections);

    setSavingId(-999999);
    try {
      await Promise.all(newSections.map((sec, i) => api.put(`/api/oferty/${id}/sekcje/${sec.id}`, { kolejnosc: i + 1 })));
      await load();
    } catch (err) {
      setError('Nie udało się zmienić kolejności.');
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function updateSectionColor(section: any, color: string) {
    const newSections = localSections.map(s => s.id === section.id ? { ...s, kolor: color } : s);
    setLocalSections(newSections);
    await api.put(`/api/oferty/${id}/sekcje/${section.id}`, { kolor: color });
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

  // Szybkie dodawanie z wyszukiwarki inline
  async function handleInlineAdd(sectionId: number, model: any) {
    const price = model.cena_podstawowa || model.cena_netto || model.wartosc_domyslna_egzemplarza || 0;
    try {
      await api.post(`/api/oferty/${id}/pozycje`, {
        id_sekcji: sectionId,
        typ_pozycji: 'sprzet',
        id_modelu: model.id,
        id_kategorii: model.kategoria?.id || model.id_kategorii || undefined,
        nazwa: model.nazwa,
        cena_netto: price,
        ilosc: 1,
        dni_pracy: 1,
        rabat_proc: 0,
        vat: 23,
        widoczna_w_pdf: true,
      });
      load();
    } catch (err) {
      console.error(err);
    }
  }

  // Dodawanie pozycji ręcznej
  function openAddItem(section: any) {
    setShowItem(section);
    setForm({
      typ_pozycji: 'sprzet',
      nazwa: '',
      cena_netto: '',
      ilosc: 1,
      dni_pracy: 1,
      rabat_proc: 0,
      vat: 23,
      opis: '',
      widoczna_w_pdf: true,
    });
  }

  async function addItem(e: any) {
    e.preventDefault();
    if (!showItem) return;
    try {
      await api.post(`/api/oferty/${id}/pozycje`, {
        ...form,
        id_sekcji: showItem.id,
        cena_netto: Number(form.cena_netto || 0),
        ilosc: Number(form.ilosc || 1),
        dni_pracy: Number(form.dni_pracy || 1),
        rabat_proc: Number(form.rabat_proc || 0),
        vat: Number(form.vat || 23),
      });
      setForm({});
      setShowItem(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Nie udało się dodać pozycji ręcznej.');
    }
  }

  // Zaawansowany picker sprzętu z magazynu
  function openAddEquipment(section: any) {
    setShowEquipment(section);
    setEquipmentSearch('');
    setEquipmentRoot('all');
    setEquipmentSub('');
    setEquipmentQuickQty({});
    setForm({ typ_pozycji: 'sprzet', id_modelu: '', nazwa: '', cena_netto: 0, ilosc: 1, dni_pracy: 1, rabat_proc: 0, vat: 23, widoczna_w_pdf: true });
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
    if (qty <= 0) {
      setError('Wpisz liczbę sztuk większą od 0.');
      return;
    }
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
    if (!form.id_modelu && !form.nazwa) {
      setError('Wybierz model sprzętu albo wpisz nazwę dla pozycji ręcznej.');
      return;
    }
    await api.post(`/api/oferty/${id}/pozycje`, {
      ...form,
      id_sekcji: showEquipment.id,
      typ_pozycji: form.typ_pozycji || 'sprzet',
      cena_netto: Number(form.cena_netto || 0),
      ilosc: Number(form.ilosc || 1),
      dni_pracy: Number(form.dni_pracy || 1),
      rabat_proc: Number(form.rabat_proc || 0),
      vat: Number(form.vat || 23),
    });
    setForm({});
    setShowEquipment(null);
    load();
  }

  async function deleteItem(item: any) {
    if (!confirm(`Usunąć pozycję „${item.nazwa}”?`)) return;
    await api.delete(`/api/oferty/${id}/pozycje/${item.id}`);
    registerDirtyItem(item.id, null);
    load();
  }

  // Synchronizacja z wydarzeniem
  async function sync(direction: 'event-to-offer' | 'offer-to-event') {
    setError(''); setNotice('');
    try {
      const res = await api.post(`/api/oferty/${id}/synchronizuj`, { direction });
      const count = res?.data?.count ?? res?.data?.created ?? 0;
      setNotice(direction === 'offer-to-event' ? `Wysłano sprzęt z oferty do operacji: ${count} pozycji.` : `Zaciągnięto sprzęt operacyjny do oferty: ${count} pozycji.`);
      await load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Błąd synchronizacji.'); }
  }
  
  // Zastosowanie budżetu
  async function applyBudget(e: any) {
    e.preventDefault(); setError('');
    try {
      await api.post(`/api/oferty/${id}/budzet`, budgetForm);
      setShowBudget(false); load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Nie udało się zastosować budżetu.'); }
  }

  function toggleSectionLock(sectionId: number) {
    setBudgetForm((prev: any) => {
      const arr = prev.pomin_sekcje_ids || [];
      return { ...prev, pomin_sekcje_ids: arr.includes(sectionId) ? arr.filter((x: number) => x !== sectionId) : [...arr, sectionId] };
    });
  }

  function generatePdf() {
    const q = new URLSearchParams();
    Object.entries(pdfConfig).forEach(([k, v]) => q.set(k, String(v)));
    window.open(`/dashboard/offers/${id}/pdf?${q.toString()}`, '_blank');
    setShowPdfSettings(false);
  }

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
    return models.filter((m: any) => {
        const catId = modelCategoryId(m);
        const matchesCategory = !selectedIds || selectedIds.has(catId);
        const matchesQuery = !q || m.nazwa.toLowerCase().includes(q) || m.kod_kreskowy?.toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
      }).slice(0, 100);
  }, [models, equipmentSearch, equipmentRoot, equipmentSub, equipmentCategoryById]);
  
  async function addBundle(e: any) {
    e.preventDefault();
    if (!showBundle) return;
    try {
      await api.post(`/api/oferty/${id}/sekcje/${showBundle.id}/pakiety`, { id_pakietu: form.id_pakietu, ilosc_pakietow: form.ilosc_pakietow || 1, dni_pracy: form.dni_pracy || 1 });
      setForm({}); setShowBundle(null); await load();
    } catch (err: any) {}
  }

  if (!offer) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-cyan-600 w-10 h-10"/></div>;

  return (
    <div className="mx-auto max-w-[1900px] space-y-6 animate-fade-in-up">
      {/* NAGŁÓWEK OFERTY */}
      <PageTitle
        eyebrow="Sprzedaż / Oferty"
        title={offerMetaForm.nazwa || 'Oferta'}
        description={`${offer.numer || ''} · ${offer.kontrahent?.nazwa || 'Brak powiązanego klienta'} · Powiązanie: ${offer.wydarzenie?.nazwa || (offer.wynajem ? `Wynajem #${offer.wynajem.numer}` : 'Brak')}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {autoSaveStatus === 'saving' && <span className="text-sm font-bold text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Zapisywanie...</span>}
            {autoSaveStatus === 'saved' && <span className="text-sm font-bold text-emerald-600 flex items-center gap-2"><CheckCircle2 size={14}/> Zapisano</span>}
            <Button variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} className="inline mr-2" /> Powrót</Button>
            <Button onClick={saveAllChanges} disabled={autoSaveStatus === 'saving' || (dirtyCount === 0 && !metaDirty)}><Save size={16} className="inline mr-2" /> Zapisz</Button>
            <Button variant="secondary" onClick={() => setDuplicateTarget(offer)}><Copy size={16} className="inline mr-2" /> Duplikuj</Button>
            <Button variant="secondary" onClick={() => setShowPdfSettings(true)}><Printer size={16} className="inline mr-2" /> Drukuj PDF</Button>
          </div>
        }
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

      {/* GÓRNE KARTY METADANYCH */}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr_0.8fr]">
        <Card className="flex flex-col h-full">
          <h2 className="text-lg font-black text-slate-800 mb-4">Dane oferty</h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <Field label="Nazwa oferty">
              <input className={inputClass} value={offerMetaForm.nazwa || ''} onChange={e => handleMetaChange('nazwa', e.target.value)} />
            </Field>
            <Field label="Status oferty">
              <select className={inputClass} value={offerMetaForm.id_statusu_oferty || ''} onChange={e => handleMetaChange('id_statusu_oferty', e.target.value)}>
                <option value="">Wybierz...</option>
                {dict.statusy.map((s:any) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
              </select>
            </Field>
            <Field label="Klient z bazy (CRM)">
              <SearchableSelect 
                value={offerMetaForm.id_kontrahenta || ''} 
                onChange={val => handleMetaChange('id_kontrahenta', val)} 
                options={dict.kontrahenci.map((k:any) => ({ value: String(k.id), label: k.nazwa }))} 
              />
            </Field>
            <Field label="Termin płatności (Dni)">
              <input type="number" className={inputClass} value={offerMetaForm.termin_platnosci_dni ?? 14} onChange={e => handleMetaChange('termin_platnosci_dni', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800">Podsumowanie finansowe</h2>
            <Button variant="secondary" onClick={() => { setBudgetForm({ budzet_netto: offer.budzet_netto || Math.round(summary.netto), algorytm: offer.algorytm_budzetu || 'proporcjonalnie_sprzet', pomin_sekcje_ids: [] }); setShowBudget(true); }}>
              <Calculator size={14} className="inline mr-1" /> Ustal Budżet
            </Button>
          </div>
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between"><span>Sprzęt:</span><b className="text-slate-900">{money(summary.sprzet)}</b></div>
              <div className="flex justify-between"><span>Obsługa:</span><b className="text-slate-900">{money(summary.obsluga)}</b></div>
              <div className="flex justify-between"><span>Transport:</span><b className="text-slate-900">{money(summary.transport)}</b></div>
              <div className="flex justify-between"><span>Nocleg:</span><b className="text-slate-900">{money(summary.nocleg)}</b></div>
              <div className="flex justify-between"><span>Usługa:</span><b className="text-slate-900">{money(summary.usluga)}</b></div>
              {summary.inne > 0 && <div className="flex justify-between"><span>Inne:</span><b className="text-slate-900">{money(summary.inne)}</b></div>}
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Wg grup na ofercie:</p>
              <div className="space-y-1">
                {localSections.map((s: any) => (
                  <div key={s.id} className="flex justify-between text-xs">
                    <span className="text-slate-500 truncate pr-2">{s.nazwa}</span>
                    <b className="text-slate-800">{money((s.pozycje || []).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0))}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Razem netto</p><p className="text-3xl font-black text-cyan-600 leading-none">{money(summary.netto)}</p></div>
            <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Brutto</p><p className="text-base font-bold text-slate-600 leading-none">{money(summary.brutto)}</p></div>
          </div>
          {Number(offer.rabat_budzetowy_netto || 0) > 0 && <p className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-xs font-black text-emerald-700 text-center">Rabat z nałożonego budżetu: {money(offer.rabat_budzetowy_netto)} (-{Number(offer.rabat_budzetowy_proc || 0).toFixed(2)}%)</p>}
        </Card>

        <Card className="flex flex-col h-full">
          <h2 className="text-lg font-black text-slate-800 mb-4">Powiązanie operacyjne</h2>
          <div className="flex-1 space-y-4">
            <Field label="Przypisane wydarzenie (zmieniaj ostrożnie)">
              <select className={inputClass} value={offerMetaForm.id_wydarzenia || ''} onChange={e => { handleMetaChange('id_wydarzenia', e.target.value); handleMetaChange('id_wynajmu', ''); }}>
                <option value="">Brak / Wolna oferta</option>
                {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.numer ? `${ev.numer} - ` : ''}{ev.nazwa}</option>)}
              </select>
            </Field>
            <Field label="Lub przypisany wynajem (zmieniaj ostrożnie)">
              <select className={inputClass} value={offerMetaForm.id_wynajmu || ''} onChange={e => { handleMetaChange('id_wynajmu', e.target.value); handleMetaChange('id_wydarzenia', ''); }}>
                <option value="">Brak / Wolna oferta</option>
                {rentals.map((r: any) => <option key={r.id} value={r.id}>{r.numer || `Wynajem #${r.id}`}</option>)}
              </select>
            </Field>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Button variant="secondary" onClick={() => sync('event-to-offer')} disabled={!offerMetaForm.id_wydarzenia && !offerMetaForm.id_wynajmu}><LinkIcon size={14} className="inline mr-2 text-cyan-600" /> Zaciągnij plan sprzętu z operacji</Button>
              <Button variant="secondary" onClick={() => sync('offer-to-event')} disabled={!offerMetaForm.id_wydarzenia && !offerMetaForm.id_wynajmu}><Save size={14} className="inline mr-2 text-emerald-600" /> Wyślij plan na wydarzenie</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* LISTA GRUP SPRZĘTOWYCH */}
      <Card className="!p-0 border-transparent shadow-none bg-transparent mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600 mr-2 ml-2">Przeciągaj grupy:</p>
          <div className="flex flex-wrap gap-2 flex-1">
            {localSections.map((s: any, idx: number) => 
              <div 
                key={s.id} draggable onDragStart={(e) => { e.dataTransfer.setData('sectionIndex', String(idx)); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => handleSummaryDrop(e, idx)}
                className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2 text-sm font-black flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition"
              >
                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ background: s.kolor || '#0891B2' }} />
                <span className="truncate max-w-[150px]">{s.nazwa}</span>
                <span className="ml-2 text-cyan-700 whitespace-nowrap">{money((s.pozycje || []).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0))}</span>
              </div>
            )}
          </div>
          <Button onClick={() => setShowSection(true)}><Plus size={16} className="inline mr-2" /> Dodaj nową grupę</Button>
        </div>

        <div className="space-y-6">
          {localSections.map((section: any) => (
            <div key={section.id} className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-white relative overflow-hidden" style={{ backgroundColor: section.kolor || '#0891B2' }}>
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                <div className="flex items-center gap-4 z-10">
                  <div>
                    <h3 className="text-xl font-black">{section.nazwa}</h3>
                    {section.opis && <p className="text-xs font-medium text-white/80 mt-0.5">{section.opis}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 z-10">
                  <div className="font-black text-lg mr-4 bg-black/20 px-3 py-1 rounded-lg">{money((section.pozycje || []).reduce((a: number, p: any) => a + Number(p.razem_netto || calc(p)), 0))}</div>
                  <button onClick={() => openEditSection(section)} className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30 transition shadow-sm"><Pencil size={14} /></button>
                  <button onClick={() => promptSectionDiscount(section)} className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30 transition shadow-sm">% Rabat grupy</button>
                  <button onClick={() => { setShowBundle(section); setForm({ ilosc_pakietow: 1, dni_pracy: 1 }); }} className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30 transition flex items-center gap-1.5"><Layers size={14}/> Pakiet</button>
                  <button onClick={() => openAddEquipment(section)} className="rounded-lg bg-white/30 px-3 py-2 text-xs font-black hover:bg-white/40 transition flex items-center gap-1.5"><Search size={14}/> Baza sprzętu</button>
                  <button onClick={() => openAddItem(section)} className="rounded-lg bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30 transition flex items-center gap-1.5">+ Pozycja ręczna</button>
                  <button onClick={() => deleteSection(section)} className="rounded-lg bg-red-500/80 px-3 py-2 text-xs font-black hover:bg-red-600 transition shadow-sm ml-2"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="overflow-x-auto bg-white">
                <table className="w-full min-w-[950px] text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-[25%]">Nazwa i Parametry</th>
                      <th className="px-3 py-3 w-[20%]">Uwagi do pozycji</th>
                      <th className="px-3 py-3 w-[10%] text-right">Cena PLN</th>
                      <th className="px-3 py-3 w-[10%] text-center">Ilość</th>
                      <th className="px-3 py-3 w-[9%] text-center">Dni</th>
                      <th className="px-3 py-3 w-[8%] text-center">Rabat %</th>
                      <th className="px-3 py-3 w-[7%] text-center">VAT %</th>
                      <th className="px-2 py-3 w-[5%] text-center"><FileText size={14} className="mx-auto"/></th>
                      <th className="px-3 py-3 text-right w-[10%]">Razem netto</th>
                      <th className="px-3 py-3 w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(section.pozycje || []).map((p: any) => (
                      <OfferPositionRow key={p.id} item={p} onDraftChange={registerDirtyItem} onDelete={() => deleteItem(p)} />
                    ))}
                  </tbody>
                </table>
                <InlineEquipmentAdder sectionId={section.id} models={models} onAdd={(m) => handleInlineAdd(section.id, m)} />
                {(!section.pozycje || section.pozycje.length === 0) && (
                  <div className="p-8 text-center text-sm font-bold text-slate-400 bg-slate-50/30">Ta grupa jest pusta.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* MODAL USTAWIEN PDF */}
      {showPdfSettings && (
        <SimpleModal title="Opcje wydruku (PDF)" onClose={() => setShowPdfSettings(false)}>
          <div className="space-y-5">
            <p className="text-sm font-bold text-slate-500 mb-2">Wybierz, jakie informacje mają być widoczne na PDF:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showUnitPrices} onChange={(e) => setPdfConfig({...pdfConfig, showUnitPrices: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż ceny jednostkowe</span><span className="text-xs text-slate-500">Wyświetla bazową cenę.</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showDiscounts} onChange={(e) => setPdfConfig({...pdfConfig, showDiscounts: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż przydzielone rabaty</span><span className="text-xs text-slate-500">Pokazuje kolumnę z udzielonym rabatem (%).</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showDays} onChange={(e) => setPdfConfig({...pdfConfig, showDays: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż Dni pracy</span><span className="text-xs text-slate-500">Wyświetla mnożnik dni.</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showThumbnails} onChange={(e) => setPdfConfig({...pdfConfig, showThumbnails: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż miniatury zdjęć</span><span className="text-xs text-slate-500">Dodaje zdjęcie na ofercie.</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showWeight} onChange={(e) => setPdfConfig({...pdfConfig, showWeight: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż wagę sprzętu</span><span className="text-xs text-slate-500">Wylicza wagę kg x ilość.</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showVat} onChange={(e) => setPdfConfig({...pdfConfig, showVat: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż stawkę VAT</span><span className="text-xs text-slate-500">Procentowa stawka podatku dla klienta.</span></div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition shadow-sm sm:col-span-2">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-cyan-600" checked={pdfConfig.showSectionSummary} onChange={(e) => setPdfConfig({...pdfConfig, showSectionSummary: e.target.checked})} />
                <div><span className="font-bold text-slate-800 block">Pokaż podsumowania grup</span><span className="text-xs text-slate-500">Dodaje kwoty na nagłówku grupy na PDF.</span></div>
              </label>
            </div>
            <div className="pt-2 border-t mt-4">
              <p className="text-sm font-bold text-slate-500 mb-3">Podsumowanie końcowe (stopka):</p>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="checkbox" checked={pdfConfig.showSummaryNetto} onChange={e => setPdfConfig({...pdfConfig, showSummaryNetto: e.target.checked})} className="w-4 h-4 text-cyan-600 rounded"/> Razem Netto</label>
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="checkbox" checked={pdfConfig.showSummaryVat} onChange={e => setPdfConfig({...pdfConfig, showSummaryVat: e.target.checked})} className="w-4 h-4 text-cyan-600 rounded"/> Wartość VAT</label>
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="checkbox" checked={pdfConfig.showSummaryBrutto} onChange={e => setPdfConfig({...pdfConfig, showSummaryBrutto: e.target.checked})} className="w-4 h-4 text-cyan-600 rounded"/> Razem Brutto</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowPdfSettings(false)}>Anuluj</Button>
              <Button onClick={generatePdf}><Printer size={16} className="inline mr-2" /> Przejdź do PDF</Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* MODAL DUPLIKACJI */}
      {duplicateTarget && <OfferDuplicateTargetModal offer={duplicateTarget} defaultEventId={offer?.id_wydarzenia} defaultRentalId={offer?.id_wynajmu} onClose={() => setDuplicateTarget(null)} onDone={(o) => router.push(`/dashboard/offers/${o.id}`)} />}
      
      {/* MODAL BUDŻETU */}
      {showBudget && <SimpleModal title="Dostosuj ofertę do budżetu" onClose={() => setShowBudget(false)}>
        {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        <form onSubmit={applyBudget} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budżet netto (PLN)"><input type="number" step="0.01" className={inputClass} value={budgetForm.budzet_netto || ''} onChange={e => setBudgetForm({ ...budgetForm, budzet_netto: e.target.value })} required /></Field>
            <Field label="Algorytm pomniejszania"><select className={inputClass} value={budgetForm.algorytm} onChange={e => setBudgetForm({ ...budgetForm, algorytm: e.target.value })}><option value="proporcjonalnie_sprzet">Tylko pozycje sprzętowe</option><option value="brak">Tylko zapisz kwotę w systemie</option></select></Field>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <p className="mb-3 text-sm font-black text-slate-700">Zamrożenie cen (grupy wyłączone z obniżki):</p>
            <div className="grid gap-2 md:grid-cols-2">
              {localSections.map((s: any) => 
                <label key={s.id} className="flex items-center gap-3 rounded-xl border bg-white p-3 text-sm font-bold shadow-sm cursor-pointer hover:bg-slate-50 transition">
                  <input type="checkbox" className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer" checked={(budgetForm.pomin_sekcje_ids || []).includes(s.id)} onChange={() => toggleSectionLock(s.id)} />
                  <span className="flex items-center gap-2 truncate"><span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ background: s.kolor || '#0891B2' }} /> <span className="truncate">{s.nazwa}</span></span>
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t"><Button variant="secondary" onClick={() => setShowBudget(false)}>Anuluj</Button><Button type="submit">Zastosuj budżet</Button></div>
        </form>
      </SimpleModal>}

      {/* MODAL DODAWANIA POZYCJI RĘCZNEJ */}
      {showItem && (
        <SimpleModal title={`Dodaj pozycję ręczną do grupy: ${showItem.nazwa}`} onClose={() => setShowItem(null)}>
          <form onSubmit={addItem} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Typ pozycji">
                <select className={inputClass} value={form.typ_pozycji || 'sprzet'} onChange={e => setForm({ ...form, typ_pozycji: e.target.value })}>
                  {positionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Nazwa pozycji">
                <input className={inputClass} required value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} placeholder="np. Usługa transportowa, Licencja..." />
              </Field>
              <Field label="Cena netto (PLN)">
                <input type="number" step="0.01" className={inputClass} value={form.cena_netto || ''} onChange={e => setForm({ ...form, cena_netto: e.target.value })} required />
              </Field>
              <Field label="Ilość">
                <input type="number" step="0.01" className={inputClass} value={form.ilosc || 1} onChange={e => setForm({ ...form, ilosc: e.target.value })} required />
              </Field>
              <Field label="Dni pracy">
                <input type="number" step="0.01" className={inputClass} value={form.dni_pracy || 1} onChange={e => setForm({ ...form, dni_pracy: e.target.value })} />
              </Field>
              <Field label="Rabat %">
                <input type="number" step="0.01" className={inputClass} value={form.rabat_proc || 0} onChange={e => setForm({ ...form, rabat_proc: e.target.value })} />
              </Field>
              <Field label="VAT %">
                <input type="number" step="0.01" className={inputClass} value={form.vat || 23} onChange={e => setForm({ ...form, vat: e.target.value })} />
              </Field>
            </div>
            <Field label="Opis / Uwagi">
              <textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} placeholder="Dodatkowe informacje..." />
            </Field>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setShowItem(null)}>Anuluj</Button>
              <Button type="submit">Dodaj pozycję</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* MODAL DODAWANIA GRUPY */}
      {showSection && <SimpleModal title="Dodaj grupę / sekcję" onClose={() => setShowSection(false)}><form onSubmit={addSection} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} required /></Field><Field label="Kolor grupy"><input type="color" className={inputClass} value={form.kolor || '#0891B2'} onChange={e => setForm({ ...form, kolor: e.target.value })} /></Field></div><Field label="Opis dodatkowy"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowSection(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}
      
      {/* MODAL EDYCJI GRUPY */}
      {showSectionEdit && <SimpleModal title={`Edytuj grupę: ${showSectionEdit.nazwa}`} onClose={() => setShowSectionEdit(null)}><form onSubmit={saveSectionEdit} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa grupy"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({ ...form, nazwa: e.target.value })} required /></Field><Field label="Kolor grupy"><input type="color" className={inputClass} value={form.kolor || '#0891B2'} onChange={e => setForm({ ...form, kolor: e.target.value })} /></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis || ''} onChange={e => setForm({ ...form, opis: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowSectionEdit(null)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}
      
      {/* MODAL PAKIETU */}
      {showBundle && (
        <SimpleModal title={`Dodaj z szablonu do: ${showBundle.nazwa}`} onClose={() => setShowBundle(null)}>
          <form onSubmit={addBundle} className="space-y-4">
            <Field label="Wybierz szablon pakietu">
              <select className={inputClass} required value={form.id_pakietu || ''} onChange={e => setForm({ ...form, id_pakietu: e.target.value })}>
                <option value="">Wybierz...</option>
                {bundles.map((b: any) => <option key={b.id} value={b.id}>{b.nazwa}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Wielokrotność (Sztuki)"><input type="number" min="1" className={inputClass} value={form.ilosc_pakietow || 1} onChange={e => setForm({ ...form, ilosc_pakietow: e.target.value })} /></Field>
              <Field label="Ilość dni pracy"><input type="number" min="0" step="0.01" className={inputClass} value={form.dni_pracy || 1} onChange={e => setForm({ ...form, dni_pracy: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t"><Button variant="secondary" onClick={() => setShowBundle(null)}>Anuluj</Button><Button type="submit">Dodaj pakiet</Button></div>
          </form>
        </SimpleModal>
      )}
      
      {/* MODAL BAZY SPRZĘTOWEJ */}
      {showEquipment && <SimpleModal className="max-w-[1500px]" title={`Wyszukiwarka sprzętu i pozycji ręcznych`} onClose={() => setShowEquipment(null)}>
        <form onSubmit={addEquipment} className="space-y-5">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[380px_1fr_320px]">
              <aside className="border-b border-slate-200 bg-slate-50/40 p-5 xl:border-b-0 xl:border-r">
                <Field label="Szukaj w bazie sprzętowej">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={17}/>
                    <input className={`${inputClass} pl-10`} value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Wpisz np. projektor..." />
                  </div>
                </Field>
                <div className="mt-4 rounded-xl bg-white border border-slate-200 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Kategorie Sprzętowe</p>
                  <div className="flex max-h-[160px] flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
                    <button type="button" onClick={() => { setEquipmentRoot('all'); setEquipmentSub(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-black ${equipmentRoot === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Wszystkie</button>
                    {equipmentCategoryRoots.map((root: any) => <button key={root.id} type="button" onClick={() => { setEquipmentRoot(String(root.id)); setEquipmentSub(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-black ${equipmentRoot === String(root.id) ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{root.nazwa}</button>)}
                  </div>
                </div>
              </aside>
              <main className="bg-white p-5 border-r border-slate-200">
                <div className="max-h-[600px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                  {equipmentModels.map((m: any) => {
                    const active = Number(form.id_modelu) === Number(m.id);
                    const price = m.cena_podstawowa || m.cena_netto || m.wartosc_domyslna_egzemplarza || 0;
                    return (
                      <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${active ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-200'}`}>
                        <div className="flex gap-3 items-center">
                          <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">{m.zdjecie ? <img src={m.zdjecie} className="w-full h-full object-cover" alt="img"/> : <Box size={16} className="text-slate-400"/>}</div>
                          <div><b className="text-sm cursor-pointer hover:underline" onClick={() => pickEquipmentModel(m)}>{m.nazwa}</b><p className="text-xs text-slate-500">{money(price)} · Dost.: {m.dostepnych ?? '-'}</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </main>
              <aside className="bg-slate-50/40 p-5">
                 <p className="text-xs font-black uppercase text-slate-400 mb-4">Manualne parametry pozycji</p>
                 <div className="space-y-3">
                   <Field label="Typ pozycji">
                     <select className={inputClass} value={form.typ_pozycji || 'sprzet'} onChange={e => setForm({...form, typ_pozycji: e.target.value})}>
                       {positionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                     </select>
                   </Field>
                   <Field label="Nazwa (edytowana na ofercie)"><input className={inputClass} value={form.nazwa || ''} onChange={e => setForm({...form, nazwa: e.target.value})} /></Field>
                   <Field label="Cena za 1 sztukę (PLN)"><input type="number" step="0.01" className={inputClass} value={form.cena_netto ?? 0} onChange={e => setForm({...form, cena_netto: e.target.value})} /></Field>
                   <Field label="Ilość sztuk"><input type="number" className={inputClass} value={form.ilosc ?? 1} onChange={e => setForm({...form, ilosc: e.target.value})} /></Field>
                 </div>
                 <div className="mt-6 pt-4 border-t border-slate-200">
                    <Button type="submit" className="w-full">Dodaj na dokument</Button>
                 </div>
              </aside>
            </div>
          </div>
        </form>
      </SimpleModal>}
    </div>
  );
}

function OfferPositionRow({ item, onDraftChange, onDelete }: { item: any; onDraftChange: (itemId: number, patch: any | null) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<any>(item);
  useEffect(() => setDraft(item), [item]);
  
  const predicted = calc(draft);
  const isChanged = JSON.stringify({
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

  useEffect(() => {
    if (isChanged) {
      const patch = {
        nazwa: draft.nazwa,
        opis: draft.opis,
        typ_pozycji: draft.typ_pozycji,
        cena_netto: Number(draft.cena_netto || 0),
        ilosc: Number(draft.ilosc || 1),
        dni_pracy: Number(draft.dni_pracy || 1),
        rabat_proc: Number(draft.rabat_proc || 0),
        vat: Number(draft.vat || 23),
        razem_netto: predicted,
        widoczna_w_pdf: Boolean(draft.widoczna_w_pdf),
      };
      onDraftChange(item.id, patch);
    } else {
      onDraftChange(item.id, null);
    }
  }, [draft, isChanged, item.id, predicted, onDraftChange]);

  const bump = (field: 'ilosc' | 'dni_pracy' | 'rabat_proc', delta: number, min = 0) => {
    const next = Math.max(min, Number(draft[field] || 0) + delta);
    setDraft({ ...draft, [field]: next });
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-cyan-50/30 transition group">
      <td className="px-3 py-2 align-top">
        <input className={`${tableInputClass} mb-1 text-[13px]`} value={draft.nazwa || ''} onChange={(e) => setDraft({ ...draft, nazwa: e.target.value })} placeholder="Nazwa pozycji" />
        <select className={`${tableInputClass} text-[11px] text-slate-500 !py-1 !px-1 font-bold bg-slate-50/50 hover:bg-slate-100 w-auto inline-block cursor-pointer`} value={draft.typ_pozycji || 'sprzet'} onChange={(e) => setDraft({ ...draft, typ_pozycji: e.target.value })}>
          {positionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <textarea className={`${tableInputClass} min-h-[58px] resize-none text-xs leading-tight`} value={draft.opis || ''} onChange={(e) => setDraft({ ...draft, opis: e.target.value })} placeholder="Notatki i dopiski do pozycji na ofercie..." />
      </td>
      <td className="px-2 py-2 align-top">
        <input type="number" step="0.01" className={`${tableInputClass} text-right text-[13px]`} value={draft.cena_netto || 0} onChange={(e) => setDraft({ ...draft, cena_netto: e.target.value })} />
      </td>
      <td className="px-2 py-2 align-top">
        <Stepper value={draft.ilosc || 1} onMinus={() => bump('ilosc', -1, 0)} onPlus={() => bump('ilosc', 1, 0)} onChange={(value) => setDraft({ ...draft, ilosc: value })} />
      </td>
      <td className="px-2 py-2 align-top">
        <Stepper value={draft.dni_pracy || 1} onMinus={() => bump('dni_pracy', -1, 0)} onPlus={() => bump('dni_pracy', 1, 0)} onChange={(value) => setDraft({ ...draft, dni_pracy: value })} />
      </td>
      <td className="px-2 py-2 align-top">
        <Stepper value={draft.rabat_proc || 0} suffix="%" onMinus={() => bump('rabat_proc', -5, 0)} onPlus={() => bump('rabat_proc', 5, 0)} onChange={(value) => setDraft({ ...draft, rabat_proc: value })} />
      </td>
      <td className="px-2 py-2 align-top">
        <input type="number" step="0.01" className={`${tableInputClass} text-right text-[13px] text-slate-500`} value={draft.vat || 23} onChange={(e) => setDraft({ ...draft, vat: e.target.value })} />
      </td>
      <td className="px-2 py-3 align-top text-center pt-4">
        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer" checked={Boolean(draft.widoczna_w_pdf)} onChange={(e) => setDraft({ ...draft, widoczna_w_pdf: e.target.checked })} title="Widoczna na wygenerowanym pliku PDF" />
      </td>
      <td className="px-3 py-3 align-top text-right pt-4">
        <span className={`text-[15px] font-black ${isChanged ? 'text-cyan-600' : 'text-slate-800'}`}>{money(isChanged ? predicted : (item.razem_netto || predicted))}</span>
        {Number(item.rabat_budzetowy_netto || 0) > 0 && <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-wider">Korekta -{money(item.rabat_budzetowy_netto)}</p>}
      </td>
      <td className="px-2 py-3 align-top text-center pt-3.5">
        <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100" title="Usuń pozycję"><Trash2 size={16} /></button>
      </td>
    </tr>
  );
}

function Stepper({ value, suffix, onMinus, onPlus, onChange }: { value: any; suffix?: string; onMinus: () => void; onPlus: () => void; onChange: (value: string) => void }) {
  return (
    <div className="flex w-full min-w-[90px] max-w-[120px] items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-within:border-cyan-500 focus-within:bg-white transition shadow-sm">
      <button type="button" onClick={onMinus} className="px-2 py-2 font-black text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition">−</button>
      <input 
        type="number" 
        step="0.01" 
        className="w-full min-w-[30px] border-0 bg-transparent p-0 text-center text-sm font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
      />
      {suffix && <span className="pr-1.5 text-xs font-black text-slate-400">{suffix}</span>}
      <button type="button" onClick={onPlus} className="px-2 py-2 font-black text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition">+</button>
    </div>
  );
}