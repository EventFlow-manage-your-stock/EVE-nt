'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';

function numberOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: any) {
  return `${numberOrZero(value).toFixed(2)} PLN`;
}

function modelCategoryId(model: any) {
  return String(model?.kategoria?.id || model?.id_kategorii || model?.kategoria_id || '');
}

function getCategoryParentId(category: any) {
  return category?.id_rodzica || category?.id_kategorii_glownej || category?.id_kategorii_nadrzednej || category?.parent_id || null;
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
  while (current && guard < 10) {
    parts.unshift(current.nazwa);
    current = current._parentId ? byId.get(String(current._parentId)) : null;
    guard++;
  }
  return parts.join(' / ');
}

export default function PricingPage() {
  const router = useRouter();
  const [models, setModels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Filtry
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'wszystkie' | 'sprzet' | 'zestaw'>('wszystkie');
  const [statusFilter, setStatusFilter] = useState<'wszystkie' | 'brak_ceny' | 'wycenione'>('wszystkie');

  // Stany edycji masowej
  const [initialPrices, setInitialPrices] = useState<Record<number, string>>({});
  const [editedPrices, setEditedPrices] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Modal ostrzeżenia o niezapisanych zmianach przed przejściem
  const [pendingTargetModel, setPendingTargetModel] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
        api.get('/api/magazyn/cennik').catch(() => ({ data: [] })),
      ]);
      setCategories(c.data || []);
      
      // Odrzucamy opakowania/case'y (wymóg 1)
      const validModels = (m.data || []).filter((item: any) => item.typ_sprzetu !== 'opakowanie');
      setModels(validModels);

      const prices: Record<number, string> = {};
      validModels.forEach((model: any) => {
        const rawPrice = model.stawki?.[0]?.cena_netto;
        prices[model.id] = rawPrice != null && rawPrice !== '' ? String(rawPrice) : '';
      });

      setInitialPrices(prices);
      setEditedPrices(prices);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Nie udało się pobrać danych cennika.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const { roots, byId } = useMemo(() => buildCategoryTree(categories), [categories]);

  // Identyfikacja zmienionych pozycji
  const changedIds = useMemo(() => {
    return Object.keys(editedPrices)
      .map(Number)
      .filter((id) => (editedPrices[id] ?? '') !== (initialPrices[id] ?? ''));
  }, [editedPrices, initialPrices]);

  const hasUnsavedChanges = changedIds.length > 0;

  // Filtrowanie listy
  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryIds = selectedCategory ? descendantsOf(selectedCategory, byId) : null;

    return models.filter((m: any) => {
      // Filtr typu
      if (typeFilter !== 'wszystkie') {
        if (typeFilter === 'zestaw' && m.typ_sprzetu !== 'zestaw' && m.typ_sprzetu !== 'rack') return false;
        if (typeFilter === 'sprzet' && (m.typ_sprzetu === 'zestaw' || m.typ_sprzetu === 'rack')) return false;
      }

      // Filtr kategorii
      if (categoryIds) {
        const catId = modelCategoryId(m);
        if (!categoryIds.has(catId)) return false;
      }

      // Filtr statusu wyceny
      const currentPriceVal = editedPrices[m.id];
      const hasPrice = currentPriceVal !== '' && currentPriceVal !== null && Number(currentPriceVal) > 0;
      if (statusFilter === 'brak_ceny' && hasPrice) return false;
      if (statusFilter === 'wycenione' && !hasPrice) return false;

      // Szukajka
      if (q) {
        const catId = modelCategoryId(m);
        const path = catId ? categoryPath(catId, byId) : '';
        const haystack = [m.nazwa, m.producent, m.kod_kreskowy, m.kategoria?.nazwa, path].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [models, search, selectedCategory, typeFilter, statusFilter, editedPrices, byId]);

  // Statystyki
  const stats = useMemo(() => {
    let unpriced = 0;
    let priced = 0;
    models.forEach((m: any) => {
      const p = editedPrices[m.id];
      if (p !== '' && p !== null && Number(p) > 0) priced++;
      else unpriced++;
    });
    return { total: models.length, priced, unpriced, changed: changedIds.length };
  }, [models, editedPrices, changedIds]);

  async function saveAll() {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updates = changedIds.map((id) => {
        const val = editedPrices[id];
        return {
          id_modelu: id,
          cena: val === '' || val === null || isNaN(Number(val)) ? null : Number(val),
        };
      });

      await api.put('/api/magazyn/cennik/masowo', { updates });
      setNotice(`Pomyślnie zaktualizowano ceny dla ${updates.length} pozycji.`);
      
      // Aktualizujemy bazowy stan
      setInitialPrices({ ...editedPrices });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się zapisać cen.');
    } finally {
      setSaving(false);
    }
  }

  function handleRowClick(modelItem: any) {
    if (hasUnsavedChanges) {
      setPendingTargetModel(modelItem);
    } else {
      router.push(`/dashboard/warehouse/models/${modelItem.id}`);
    }
  }

  async function handleConfirmNavigationWithSave() {
    if (!pendingTargetModel) return;
    setSaving(true);
    try {
      const updates = changedIds.map((id) => {
        const val = editedPrices[id];
        return {
          id_modelu: id,
          cena: val === '' || val === null || isNaN(Number(val)) ? null : Number(val),
        };
      });
      await api.put('/api/magazyn/cennik/masowo', { updates });
      const targetId = pendingTargetModel.id;
      setPendingTargetModel(null);
      router.push(`/dashboard/warehouse/models/${targetId}`);
    } catch (e: any) {
      alert('Nie udało się zapisać zmian przed przejściem.');
      setSaving(false);
    }
  }

  function handleDiscardAndNavigate() {
    if (!pendingTargetModel) return;
    const targetId = pendingTargetModel.id;
    setPendingTargetModel(null);
    router.push(`/dashboard/warehouse/models/${targetId}`);
  }

  return (
    <div className="mx-auto max-w-[1750px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="Magazyn & Finanse"
        title="Cennik Podstawowy Sprzętu i Zestawów"
        description="Zarządzaj stawkami bazowymi modeli sprzętu i racków. Ceny są wykorzystywane jako domyślne przy tworzeniu wycen i ofert dla klientów."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <Button variant="secondary" onClick={() => setEditedPrices({ ...initialPrices })} disabled={saving}>
                <RotateCcw size={16} className="inline mr-1" /> Cofnij zmiany ({changedIds.length})
              </Button>
            )}
            <Button onClick={saveAll} disabled={saving || !hasUnsavedChanges}>
              {saving ? <Loader2 size={16} className="animate-spin inline mr-1" /> : <Save size={16} className="inline mr-1" />}
              {saving ? 'Zapisywanie...' : `Zapisz cennik ${hasUnsavedChanges ? `(${changedIds.length})` : ''}`}
            </Button>
          </div>
        }
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

      {/* METRYKI STANU CENNIKA */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pozycji w cenniku</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <Box size={24} />
          </div>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wycenione poprawnie</p>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.priced}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
        </Card>

        <Card className={`flex items-center justify-between border ${stats.unpriced > 0 ? 'border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-900/10' : ''}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Brak stawki (Alarm)</p>
            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">{stats.unpriced}</p>
          </div>
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
            <AlertTriangle size={24} />
          </div>
        </Card>

        <Card className={`flex items-center justify-between border ${hasUnsavedChanges ? 'border-cyan-400 bg-cyan-50/40 dark:border-cyan-500/30 dark:bg-cyan-900/10' : ''}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-[#04e0ff]">Niezapisane edycje</p>
            <p className="mt-1 text-2xl font-black text-cyan-700 dark:text-[#04e0ff]">{stats.changed}</p>
          </div>
          <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700 dark:bg-cyan-500/20 dark:text-[#04e0ff]">
            <DollarSign size={24} />
          </div>
        </Card>
      </div>

      {/* PANEL FILTROWANIA */}
      <Card className="!p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* PRZEŁĄCZNIKI TYPÓW */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('wszystkie')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${typeFilter === 'wszystkie' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}
            >
              Wszystkie pozycje
            </button>
            <button
              onClick={() => setTypeFilter('sprzet')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${typeFilter === 'sprzet' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}
            >
              Sprzęt pojedynczy
            </button>
            <button
              onClick={() => setTypeFilter('zestaw')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${typeFilter === 'zestaw' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}
            >
              Zestawy
            </button>
          </div>

          {/* FILTR STANU WYCENY */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('wszystkie')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border ${statusFilter === 'wszystkie' ? 'border-slate-800 bg-slate-800 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'}`}
            >
              Wszystkie statusy
            </button>
            <button
              onClick={() => setStatusFilter('brak_ceny')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${statusFilter === 'brak_ceny' ? 'border-amber-500 bg-amber-500 text-white shadow-sm' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-400'}`}
            >
              <AlertTriangle size={13} /> Tylko bez wyceny ({stats.unpriced})
            </button>
            <button
              onClick={() => setStatusFilter('wycenione')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${statusFilter === 'wycenione' ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-400'}`}
            >
              <CheckCircle2 size={13} /> Wycenione ({stats.priced})
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_320px] pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              className={`${inputClass} pl-10`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj modelu, kategorii, producenta, kodu kreskowego..."
            />
          </div>

          <select
            className={inputClass}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Wszystkie kategorie</option>
            {roots.map((root: any) => (
              <option key={root.id} value={root.id}>
                {root.nazwa}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* TABELA CENNIKA Z EDYCJĄ MASOWĄ */}
      <Card className="!p-0 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-white/5 dark:bg-slate-950">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Wykaz stawek do ofert</h3>
            <p className="text-xs font-bold text-slate-400">
              Kliknij na wiersz, aby otworzyć pełną kartę modelu. Wpisz stawkę w polu po prawej stronie, aby edytować masowo.
            </p>
          </div>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400">
            Wyświetlono: {filteredModels.length} z {models.length} pozycji
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-950/50">
              <tr>
                <th className="p-4">Model sprzętu</th>
                <th className="p-4">Typ ewidencji</th>
                <th className="p-4">Kategoria</th>
                <th className="p-4 text-center">Status wyceny</th>
                <th className="p-4 text-right">Wartość sprzętu</th>
                <th className="p-4 text-right w-[240px]">Cena katalogowa netto (1 doba)</th>
                <th className="p-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center font-bold text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2 text-cyan-600" size={24} />
                    Ładowanie stawek cennika...
                  </td>
                </tr>
              ) : (
                filteredModels.map((m: any) => {
                  const isQty = m.tryb_ewidencji === 'ilosciowe' || m.typ_sprzetu === 'ilosciowe';
                  const isSet = m.typ_sprzetu === 'zestaw' || m.typ_sprzetu === 'rack';
                  const currentPrice = editedPrices[m.id] ?? '';
                  const isPriceSet = currentPrice !== '' && currentPrice !== null && Number(currentPrice) > 0;
                  const isModified = (editedPrices[m.id] ?? '') !== (initialPrices[m.id] ?? '');
                  const catId = modelCategoryId(m);
                  const catLabel = catId ? categoryPath(catId, byId) : m.kategoria?.nazwa || '-';

                  return (
                    <tr
                      key={m.id}
                      onClick={() => handleRowClick(m)}
                      className={`group cursor-pointer transition-colors ${
                        isModified
                          ? 'bg-cyan-50/40 hover:bg-cyan-50/70 dark:bg-cyan-900/10 dark:hover:bg-cyan-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {/* MODEL */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800">
                            {isSet ? <Layers size={18} className="text-purple-600" /> : <Box size={18} className="text-cyan-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 dark:text-white group-hover:text-cyan-600 transition truncate">
                              {m.nazwa}
                            </p>
                            <p className="text-xs font-semibold text-slate-400 truncate">
                              {m.producent ? `${m.producent} · ` : ''}{m.kod_kreskowy ? `Kod: ${m.kod_kreskowy}` : `ID: #${m.id}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* TYP */}
                      <td className="p-4">
                        {isSet ? (
                          <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Zestaw
                          </span>
                        ) : isQty ? (
                          <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            Ilościowy
                          </span>
                        ) : (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                            Egzemplarzowy
                          </span>
                        )}
                      </td>

                      {/* KATEGORIA */}
                      <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">
                        {catLabel}
                      </td>

                      {/* STATUS WYCENY (ALARM / OK) */}
                      <td className="p-4 text-center">
                        {!isPriceSet ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-400 animate-pulse">
                            <AlertTriangle size={13} /> Brak wyceny
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <CheckCircle2 size={13} /> Wyceniony
                          </span>
                        )}
                      </td>

                      {/* WARTOŚĆ / KOSZT SPRZĘTU */}
                      <td className="p-4 text-right font-bold text-slate-500">
                        {money(m.wartosc_domyslna_egzemplarza || m.wartosc || m.stawki?.[0]?.koszt || 0)}
                      </td>

                      {/* EDYCJA CENY W INPUT (MASOWA) */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block w-full max-w-[180px]">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="-"
                            value={editedPrices[m.id] ?? ''}
                            onChange={(e) => setEditedPrices({ ...editedPrices, [m.id]: e.target.value })}
                            className={`${inputClass} text-right font-black pr-11 py-2 ${
                              isModified
                                ? 'border-cyan-500 bg-white ring-2 ring-cyan-100 dark:border-[#04e0ff] dark:bg-slate-950 dark:ring-cyan-900/30'
                                : !isPriceSet
                                ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-900/10'
                                : ''
                            }`}
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                            PLN
                          </span>
                        </div>
                      </td>

                      {/* AKCJE */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleRowClick(m)}
                          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-white/5 dark:hover:text-cyan-400 transition"
                          title="Przejdź do pełnej edycji modelu"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {!loading && filteredModels.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center font-bold text-slate-400">
                    Brak modeli spełniających kryteria filtrowania.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL OSTRZEŻENIA O NIEZAPISANYCH ZMIANACH (WYMÓG 6) */}
      {pendingTargetModel && (
        <SimpleModal
          title="Niezapisane zmiany w cenniku"
          onClose={() => setPendingTargetModel(null)}
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-900/20">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                  Wprowadzono zmiany w stawkach ({changedIds.length} poz.)
                </p>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-1">
                  Przejście do karty modelu <b>{pendingTargetModel.nazwa}</b> bez zapisu spowoduje utratę wprowadzonych cen.
                </p>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-500">
              Wybierz, jak chcesz postąpić przed przejściem do edycji wybranego sprzętu:
            </p>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <Button onClick={handleConfirmNavigationWithSave} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin inline mr-1" /> : <Save size={16} className="inline mr-1" />}
                Zapisz zmiany i przejdź
              </Button>
              <Button variant="danger" onClick={handleDiscardAndNavigate} disabled={saving}>
                Odrzuć zmiany i przejdź
              </Button>
              <Button variant="secondary" onClick={() => setPendingTargetModel(null)} disabled={saving}>
                Anuluj (zostań w cenniku)
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}