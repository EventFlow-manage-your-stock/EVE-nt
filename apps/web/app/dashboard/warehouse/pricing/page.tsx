'use client';

import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';

// ============================================================================
// HELPERY LOGIKI BIZNESOWEJ (Klasyfikacja Sprzętu)
// ============================================================================

function getEquipmentText(row: any): string {
  const egz = row?.egzemplarz || row;
  const model = row?.model || egz?.model || row;
  return [
    row?.nazwa, row?.nazwa_modelu, row?.typ, row?.rodzaj, row?.typ_sprzetu,
    egz?.nazwa, model?.nazwa, model?.typ, model?.rodzaj, model?.typ_sprzetu
  ].filter(Boolean).map(v => String(v).toLowerCase()).join(' ');
}

function isZestaw(row: any): boolean {
  const txt = getEquipmentText(row);
  return txt.includes('zestaw') || txt.includes('rack') || row?.rowType === 'zestaw' || row?.czy_zestaw === true;
}

function isCase(row: any): boolean {
  if (isZestaw(row)) return false;
  const txt = getEquipmentText(row);
  return txt.includes('case') || txt.includes('opakowan') || txt.includes('skrzyn') || row?.isCase === true || row?.rowType === 'case' || row?.czy_case === true;
}

// ============================================================================
// GŁÓWNY KOMPONENT CENNIKA
// ============================================================================

export default function PricingPage() {
  const [models, setModels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editedPrices, setEditedPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (selectedCategory) qs.set('kategoriaId', selectedCategory);
      if (search) qs.set('search', search);
      const [c, m] = await Promise.all([
        api.get('/api/magazyn/kategorie').catch(() => ({ data: [] })),
        api.get(`/api/magazyn/cennik${qs.toString() ? `?${qs}` : ''}`).catch(() => ({ data: [] })),
      ]);
      setCategories(c.data || []);
      setModels(m.data || []);
      
      const prices: Record<number, string> = {};
      (m.data || []).forEach((model: any) => { 
        prices[model.id] = model.stawki?.[0]?.cena_netto != null 
          ? String(model.stawki[0].cena_netto) 
          : (model.cena_netto != null ? String(model.cena_netto) : ''); 
      });
      setEditedPrices(prices);
    } finally { setLoading(false); }
  }
  
  useEffect(() => { load(); }, [selectedCategory]);

  async function saveAll() {
    setSaving(true);
    try {
      // SECURITY: Odrzucamy Case'y ze struktury wysyłanej do bazy danych
      const updates = Object.entries(editedPrices)
        .filter(([id]) => {
          const item = models.find(m => String(m.id) === String(id));
          return item && !isCase(item);
        })
        .map(([id, cena]) => ({ id_modelu: Number(id), cena: cena === '' ? null : Number(cena) }));

      await api.put('/api/magazyn/cennik/masowo', { updates });
      await load();
      alert('Ceny zapisane.');
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Nie udało się zapisać cen.');
    } finally { setSaving(false); }
  }

  function calculateCasePrice(caseItem: any) {
    const contents = caseItem.zawartosc || caseItem.dzieci || caseItem.elementy || [];
    if (!contents.length) return 0;
    
    return contents.reduce((sum: number, child: any) => {
      const childPrice = editedPrices[child.id] !== undefined 
        ? Number(editedPrices[child.id]) 
        : Number(child.cena_netto || child.stawki?.[0]?.cena_netto || 0);
      return sum + (isNaN(childPrice) ? 0 : childPrice);
    }, 0);
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle 
        eyebrow="Magazyn" 
        title="Cennik i wycena sprzętu" 
        description="Ceny bazowe ustala się wyłącznie dla Egzemplarzy i Zestawów. Cena dla Case (skrzyń) jest stała, wyliczana automatycznie z wartości jej zawartości." 
        action={<Button onClick={saveAll} disabled={saving}><Save size={16} className="inline" /> {saving ? 'Zapisuję...' : 'Zapisz zmiany'}</Button>} 
      />
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Field label="Kategoria">
            <select className={inputClass} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">Wszystkie</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
            </select>
          </Field>
          <Field label="Szukaj">
            <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="Nazwa modelu / sprzętu" />
          </Field>
          <div className="flex items-end"><Button variant="secondary" onClick={load}>Filtruj</Button></div>
        </div>
        
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3 text-left">Sprzęt</th>
                <th className="p-3 text-left">Typ logistyczny</th>
                <th className="p-3 text-left">Kategoria</th>
                <th className="p-3 text-right">Cena podstawowa netto (PLN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center font-bold text-slate-400">Ładowanie...</td></tr>
              ) : models.map((m: any) => {
                const isItemCase = isCase(m);
                const isItemZestaw = isZestaw(m);
                const displayPrice = isItemCase ? calculateCasePrice(m).toFixed(2) : (editedPrices[m.id] ?? '');

                return (
                  <tr key={m.id} className={isItemCase ? 'bg-slate-50/50' : ''}>
                    <td className="p-3">
                      <p className="font-black text-cyan-700">{m.nazwa}</p>
                    </td>
                    <td className="p-3">
                      {isItemCase ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-600"><Info size={12}/> Case</span>
                      ) : isItemZestaw ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">Zestaw</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-100 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">Egzemplarz</span>
                      )}
                    </td>
                    <td className="p-3">{m.kategoria?.nazwa || '-'}</td>
                    <td className="p-3 text-right">
                      {isItemCase ? (
                        <div className="flex justify-end items-center gap-2 text-slate-500 font-black">
                           <span title="Cena wyliczana na podstawie sumy elementów wewnątrz" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automatyczna:</span> 
                           <span className="w-[120px] bg-white rounded-lg py-2 px-3 border border-slate-200 inline-block text-right">{displayPrice}</span>
                        </div>
                      ) : (
                        <input 
                          type="number" 
                          step="0.01" 
                          className={`${inputClass} ml-auto w-[160px] text-right font-black transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500`} 
                          value={editedPrices[m.id] ?? ''} 
                          onChange={(e) => setEditedPrices({ ...editedPrices, [m.id]: e.target.value })} 
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && models.length === 0 && <tr><td colSpan={4} className="p-8 text-center font-bold text-slate-400">Brak modeli do wyceny.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}