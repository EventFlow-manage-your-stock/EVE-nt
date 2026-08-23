'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownUp, Edit2, Search, X } from 'lucide-react';
import { Button, inputClass } from './ProductUI';

export type Column<T> = {
  key: string;
  label: string;
  value?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
};

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (value instanceof Date) return value.toLocaleString('pl-PL');
  if (typeof value === 'object') {
    if (value.nazwa) return String(value.nazwa);
    if (value.imie || value.nazwisko) return `${value.imie || ''} ${value.nazwisko || ''}`.trim();
    if (value.email) return String(value.email);
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function isEditablePrimitive(value: any) {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

export function DataTable<T extends { id?: number | string }>({
  rows,
  columns,
  searchPlaceholder = 'Szukaj...',
  onRowClick,
  empty = 'Brak danych.',
  enableDetails = true,
  onSaveRow,
}: {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  empty?: string;
  enableDetails?: boolean;
  onSaveRow?: (row: T) => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(columns[0]?.key || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<T | null>(null);
  const [edited, setEdited] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = rows;
    if (q) {
      filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
    }
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(col.sortValue ? col.sortValue(a) ?? '' : (a as any)[col.key] ?? '').toLowerCase();
      const bv = String(col.sortValue ? col.sortValue(b) ?? '' : (b as any)[col.key] ?? '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv, 'pl') : bv.localeCompare(av, 'pl');
    });
  }, [rows, query, columns, sortKey, sortDir]);

  function openDetails(row: T) {
    if (onRowClick) return onRowClick(row);
    if (!enableDetails) return;
    setSelected(row);
    setEdited({ ...row });
    setEditMode(false);
    setError('');
  }

  async function saveSelected() {
    if (!selected || !edited || !onSaveRow) return;
    setSaving(true);
    setError('');
    try {
      await onSaveRow(edited);
      setSelected(edited);
      setEditMode(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  }

  const detailKeys = useMemo(() => {
    if (!selected) return [];
    const preferred = columns.map((c) => c.key);
    const all = Object.keys(selected as any);
    return [...preferred, ...all.filter((k) => !preferred.includes(k))].filter((k) => !['haslo', 'password', 'token'].includes(k.toLowerCase()));
  }, [selected, columns]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/70">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-3 font-black ${col.className || ''}`}>
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => {
                      if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(col.key); setSortDir('asc'); }
                    }}
                  >
                    {col.label}<ArrowDownUp size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {data.map((row, index) => (
              <tr key={row.id ?? index} onClick={() => openDetails(row)} className={onRowClick || enableDetails ? 'cursor-pointer hover:bg-cyan-50/50 dark:hover:bg-white/5' : ''}>
                {columns.map((col) => <td key={col.key} className={`p-3 align-top ${col.className || ''}`}>{col.value ? col.value(row) : String((row as any)[col.key] ?? '-')}</td>)}
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={columns.length} className="p-12 text-center font-bold text-slate-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-600">Szczegóły rekordu</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatValue((selected as any).nazwa || (selected as any).tytul || (selected as any).numer || `#${(selected as any).id}`)}</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">Klik w rekord otwiera ten panel; przycisk edycji pozwala poprawić proste pola.</p>
              </div>
              <button className="rounded-full border p-2 text-slate-500 hover:bg-slate-50" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

            <div className="mb-4 flex gap-2">
              <Button variant={editMode ? 'primary' : 'secondary'} onClick={() => setEditMode(!editMode)}><Edit2 size={16} className="inline" /> {editMode ? 'Tryb edycji' : 'Edytuj'}</Button>
              {editMode && onSaveRow && <Button onClick={saveSelected} disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz zmiany'}</Button>}
            </div>

            <div className="space-y-3">
              {detailKeys.map((key) => {
                const value = (edited ?? selected as any)[key];
                const canEdit = editMode && onSaveRow && isEditablePrimitive(value) && key !== 'id';
                return (
                  <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
                    <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{key}</p>
                    {canEdit ? (
                      typeof value === 'boolean' ? (
                        <select className={inputClass} value={value ? 'true' : 'false'} onChange={(e) => setEdited({ ...edited, [key]: e.target.value === 'true' })}>
                          <option value="true">Tak</option>
                          <option value="false">Nie</option>
                        </select>
                      ) : (
                        <input className={inputClass} value={value ?? ''} onChange={(e) => setEdited({ ...edited, [key]: e.target.value })} />
                      )
                    ) : (
                      <pre className="whitespace-pre-wrap break-words text-sm font-bold text-slate-700 dark:text-slate-200">{formatValue(value)}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
