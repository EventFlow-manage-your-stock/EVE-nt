'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  ImageIcon,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, PageTitle } from '../../../components/ProductUI';

function numberOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: any) {
  return `${numberOrZero(value).toFixed(2)} PLN`;
}

function count(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function modelCategoryId(model: any) {
  return String(model.kategoria?.id || model.id_kategorii || model.kategoria_id || '');
}

function getCategoryParentId(category: any) {
  return category.id_rodzica || category.id_kategorii_glownej || category.id_kategorii_nadrzednej || category.parent_id || category.id_parent || null;
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

  // Jeżeli API zwraca już zagnieżdżone kategorie, parent może być w polu parent z flattenCategories.
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

function imageSrc(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) return raw;
  if (raw.length > 80) return `data:image/jpeg;base64,${raw}`;
  return '';
}

function ModelThumb({ model }: { model: any }) {
  const src = imageSrc(model.zdjecie || model.zdjecie_url || model.image || model.photo);
  if (!src) {
    return (
      <div className="flex h-12 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
        <ImageIcon size={20} />
      </div>
    );
  }
  return <img src={src} alt={model.nazwa || 'Zdjęcie modelu'} className="h-12 w-16 rounded-xl border border-slate-200 object-cover" />;
}

function CategoryButton({ active, children, onClick, count }: { active: boolean; children: React.ReactNode; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${active ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
      {typeof count === 'number' && <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>{count}</span>}
    </button>
  );
}

export default function InternalWarehousePage() {
  // EVENTFLOW_PRODUCT_POLISH_V26:
  // Przebudowa widoku magazynu: kategorie główne + rozwijane podkategorie zamiast płaskiej listy kilkudziesięciu chipów.
  // Dodatkowo lista modeli jest bliższa NEW: zdjęcie, nazwa, stany, cena, akcje i szybka edycja modelu.
  const router = useRouter();
  const [models, setModels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeRoot, setActiveRoot] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [m, k] = await Promise.all([
        api.get('/api/magazyn/modele').catch(() => ({ data: [] })),
        api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
      ]);
      setModels(m.data || []);
      setCategories(k.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const { roots, byId } = useMemo(() => buildCategoryTree(categories), [categories]);

  const modelCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const model of models) {
      const id = modelCategoryId(model);
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [models]);

  const totalForCategory = (categoryId: string) => {
    const ids = descendantsOf(categoryId, byId);
    let total = 0;
    ids.forEach((id) => { total += modelCountByCategory.get(id) || 0; });
    return total;
  };

  function selectRoot(rootId: string) {
    const nextOpen = activeRoot === rootId ? !expandedRoots[rootId] : true;
    setActiveRoot(rootId);
    setActiveCategory(rootId);
    setExpandedRoots({ ...expandedRoots, [rootId]: nextOpen });
  }

  function clearCategory() {
    setActiveRoot('');
    setActiveCategory('');
  }

  const activeCategoryIds = useMemo(() => activeCategory ? descendantsOf(activeCategory, byId) : new Set<string>(), [activeCategory, byId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((model: any) => {
      const catId = modelCategoryId(model);
      if (activeCategory && !activeCategoryIds.has(catId)) return false;
      if (!q) return true;
      const haystack = [
        model.nazwa,
        model.kategoria?.nazwa,
        catId ? categoryPath(catId, byId) : '',
        model.typ_sprzetu,
        model.uwagi,
        model.magazyn,
        model.kod,
        model.sku,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [models, activeCategory, activeCategoryIds, search, byId]);

  const totals = useMemo(() => ({
    models: filtered.length,
    items: filtered.reduce((a, m: any) => a + count(m._count?.egzemplarze || m.stan?.total), 0),
    available: filtered.reduce((a, m: any) => a + count(m.dostepnych || m.stan?.magazyn), 0),
    service: filtered.reduce((a, m: any) => a + count(m.stan?.serwis), 0),
  }), [filtered]);

  return (
    <div className="mx-auto max-w-[1900px] space-y-6">
      <PageTitle
        eyebrow="Magazyn"
        title="Magazyn wewnętrzny"
        description="Modele sprzętu, stany, ceny i dostępność. Kategorie są zebrane w grupy, a podkategorie rozwijają się dopiero po wybraniu kategorii głównej."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push('/dashboard/warehouse/models')}><Plus size={16} className="inline" /> Dodaj / modele</Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard/warehouse/labels?type=barcode')}><Tag size={16} className="inline" /> Naklejki</Button>
          </div>
        }
      />

      <Card className="!p-4">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-600">Kategorie</p>
            <h2 className="text-xl font-black text-slate-900">Wybierz kategorię główną</h2>
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 xl:max-w-sm">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj modelu, kategorii, SKU..." className="w-full bg-transparent text-sm font-bold outline-none" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <CategoryButton active={!activeCategory} onClick={clearCategory}>Wszystkie</CategoryButton>
          {roots.map((root: any) => {
            const rootId = String(root.id);
            const isActiveRoot = activeRoot === rootId;
            const isExpanded = !!expandedRoots[rootId] && isActiveRoot;
            return (
              <button
                key={root.id}
                onClick={() => selectRoot(rootId)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${isActiveRoot ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                {root.nazwa}
                {/* <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActiveRoot ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                {
                  //totalForCategory(rootId)
                }
                </span> */}
              </button>
            );
          })}
        </div>

        {activeRoot && expandedRoots[activeRoot] && (
          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-700">Podkategorie</p>
                <p className="text-sm font-bold text-slate-500">Kliknij podkategorię, żeby zawęzić listę modeli.</p>
              </div>
              <button onClick={() => setActiveCategory(activeRoot)} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-700">Pokaż całą kategorię</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(byId.get(activeRoot)?.dzieci || []).length === 0 && <span className="text-sm font-bold text-slate-400">Ta kategoria nie ma podkategorii.</span>}
              {(byId.get(activeRoot)?.dzieci || []).map((child: any) => {
                const childId = String(child.id);
                return (
                  <CategoryButton key={child.id} active={activeCategory === childId} onClick={() => setActiveCategory(childId)}>
                    {child.nazwa}
                  </CategoryButton>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-black uppercase text-slate-400">Modele</p><p className="text-3xl font-black">{totals.models}</p></Card>
        <Card><p className="text-xs font-black uppercase text-slate-400">Egzemplarze</p><p className="text-3xl font-black">{totals.items}</p></Card>
        <Card><p className="text-xs font-black uppercase text-slate-400">Dostępne</p><p className="text-3xl font-black">{totals.available}</p></Card>
        <Card><p className="text-xs font-black uppercase text-slate-400">W serwisie</p><p className="text-3xl font-black">{totals.service}</p></Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-600">Modele sprzętu</p>
              <h2 className="text-xl font-black text-slate-900">Lista modeli</h2>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{filtered.length} wyników</p>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center font-bold text-slate-400">Ładowanie magazynu...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3 font-black">SKU / kod</th>
                  <th className="p-3 font-black">Zdjęcie</th>
                  <th className="p-3 font-black">Nazwa</th>
                  <th className="p-3 font-black">Typ</th>
                  <th className="p-3 font-black">Kategoria</th>
                  <th className="p-3 font-black">Na stanie</th>
                  <th className="p-3 font-black">Dostępnych</th>
                  <th className="p-3 font-black">Rezerwacje</th>
                  <th className="p-3 font-black">Cena</th>
                  <th className="p-3 font-black">Magazyn</th>
                  <th className="p-3 text-right font-black">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((model: any) => {
                  const catId = modelCategoryId(model);
                  const total = count(model.stan?.total || model._count?.egzemplarze);
                  const available = count(model.dostepnych || model.stan?.magazyn);
                  const service = count(model.stan?.serwis);
                  const reservations = count(model.rezerwacje || model.stan?.rezerwacje);
                  return (
                    <tr key={model.id} onClick={() => router.push(`/dashboard/warehouse/models/${model.id}`)} className="cursor-pointer align-top transition hover:bg-cyan-50/50">
                      <td className="p-3 text-xs font-bold text-slate-500">{model.sku || model.kod || model.kod_modelu || model.symbol || <span className="text-slate-300">—</span>}</td>
                      <td className="p-3"><ModelThumb model={model} /></td>
                      <td className="p-3">
                        <b className="text-cyan-700">{model.nazwa}</b>
                        {model.uwagi && <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-400">{model.uwagi}</p>}
                      </td>
                      <td className="p-3 font-bold text-slate-600">{model.typ_sprzetu || 'Sprzęt'}</td>
                      <td className="p-3 font-bold text-slate-500">{catId ? categoryPath(catId, byId) || model.kategoria?.nazwa : model.kategoria?.nazwa || model.kategoria_nazwa || '-'}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{total}</span>
                        {service > 0 && <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-700">serwis {service}</span>}
                      </td>
                      <td className="p-3 font-black text-emerald-700">{available}</td>
                      <td className="p-3"><span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-black text-teal-700">{reservations}</span></td>
                      <td className="p-3 font-bold text-slate-600">{money(model.cena_podstawowa || model.wartosc_domyslna_egzemplarza || model.wartosc)}</td>
                      <td className="p-3 font-bold text-slate-500">{model.magazyn || model.lokalizacja || model.miejsce || '-'}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button title="Edytuj" onClick={() => router.push(`/dashboard/warehouse/models/${model.id}`)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Edit2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={11} className="p-12 text-center font-bold text-slate-400">Brak modeli w wybranej kategorii.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
