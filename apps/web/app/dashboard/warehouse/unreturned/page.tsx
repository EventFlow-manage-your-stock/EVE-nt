'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';

// Funkcja pomocnicza do czytelnego formatowania dat
function formatDate(dateString: any) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function UnreturnedPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stan nałożonych filtrów
  const [filters, setFilters] = useState({
    search: '',
    kontrahent: '',
    od: '',
    do: ''
  });

  async function load() {
    setLoading(true);
    try {
      // Pobieramy dane za pomocą nowego dedykowanego endpointu WMS
      const [unreturnedRes, clientsRes] = await Promise.all([
        api.get('/api/magazyn/niezwrocone').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] }))
      ]);
      
      setItems(unreturnedRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    
    return items.filter((w: any) => {
      // Filtr Kontrahenta
      if (filters.kontrahent && String(w.kontrahent?.id) !== filters.kontrahent) {
        return false;
      }

      // Filtr dat od-do na podstawie planowanego zwrotu
      const planDate = w.data_koniec?.slice?.(0, 10);
      if (filters.od && planDate && planDate < filters.od) return false;
      if (filters.do && planDate && planDate > filters.do) return false;

      // Wyszukiwarka tekstowa (Numer, nazwa, nazwa klienta)
      if (query) {
        const haystack = `${w.numer || ''} ${w.nazwa || ''} ${w.kontrahent?.nazwa || ''} ${w.typ_kontekstu || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [items, filters]);

  return (
    <div className="mx-auto max-w-[1650px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="Magazyn"
        title="Niezwrócony sprzęt"
        description="Lista wydanych fizycznie sprzętów (Wydarzenia oraz Wynajmy), które nie zostały jeszcze rozliczone na dokumencie Przyjęcia (PZ)."
      />

      <Card className="!p-4 border-slate-200 shadow-sm">
        {/* Panel filtrów */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Field label="Wyszukaj">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  className={`${inputClass} pl-9`}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Szukaj po nazwie, numerze lub kliencie..."
                />
              </div>
            </Field>
          </div>

          <Field label="Kontrahent">
            <select
              className={inputClass}
              value={filters.kontrahent}
              onChange={(e) => setFilters({ ...filters, kontrahent: e.target.value })}
            >
              <option value="">Wszyscy</option>
              {clients.map((k: any) => (
                <option key={k.id} value={k.id}>{k.nazwa}</option>
              ))}
            </select>
          </Field>

          <Field label="Planowany zwrot (Od)">
            <input
              type="date"
              className={inputClass}
              value={filters.od}
              onChange={(e) => setFilters({ ...filters, od: e.target.value })}
            />
          </Field>

          <Field label="Planowany zwrot (Do)">
            <input
              type="date"
              className={inputClass}
              value={filters.do}
              onChange={(e) => setFilters({ ...filters, do: e.target.value })}
            />
          </Field>
        </div>

        {/* Tabela wyników */}
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        ) : (
          <DataTable
            rows={filteredItems}
            onRowClick={(r: any) => {
              if (r.typ_kontekstu === 'wynajem') router.push(`/dashboard/rentals/${r.id}`);
              else router.push(`/dashboard/events/${r.id}`);
            }}
            columns={[
              {
                key: 'typ_kontekstu',
                label: 'Źródło',
                value: (r: any) => (
                  <span className={`px-2 py-1 rounded-md text-xs font-black uppercase ${r.typ_kontekstu === 'wynajem' ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}`}>
                    {r.typ_kontekstu}
                  </span>
                )
              },
              {
                key: 'nazwa',
                label: 'Nazwa / Numer',
                value: (r: any) => (
                  <div>
                    <b className="text-slate-900 block">{r.nazwa || '-'}</b>
                    <span className="text-xs text-slate-400 font-bold">{r.numer || `#${r.id}`}</span>
                  </div>
                )
              },
              {
                key: 'kontrahent',
                label: 'Kontrahent',
                value: (r: any) => r.kontrahent?.nazwa || '-'
              },
              {
                key: 'status_obj',
                label: 'Status Głównego Obiektu',
                value: (r: any) => r.status_obj?.nazwa ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                    {r.status_obj.nazwa}
                  </span>
                ) : '-'
              },
              {
                key: 'data_start',
                label: 'Start / Wydanie',
                value: (r: any) => formatDate(r.data_start),
                sortValue: (r: any) => r.data_start
              },
              {
                key: 'data_koniec',
                label: 'Planowany zwrot',
                value: (r: any) => {
                  const isOverdue = r.data_koniec && new Date(r.data_koniec) < new Date();
                  return (
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatDate(r.data_koniec)}
                      {isOverdue && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700 shadow-sm">Opóźnienie</span>}
                    </span>
                  );
                },
                sortValue: (r: any) => r.data_koniec
              },
              {
                key: 'niezwrocone_szt',
                label: 'Niezwrócono',
                value: (r: any) => (
                  <span className="font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
                    {r.niezwrocone_szt} szt.
                  </span>
                )
              }
            ]}
            empty="Cały wydany sprzęt został poprawnie przyjęty (rozliczony na PZ) w systemie."
          />
        )}
      </Card>
    </div>
  );
}