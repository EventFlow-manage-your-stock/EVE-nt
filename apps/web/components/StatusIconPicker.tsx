'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { inputClass } from './ProductUI';

export type StatusIconOption = {
  icon: string;
  label: string;
  group: 'Ogólne' | 'Wydarzenia' | 'Magazyn' | 'Księgowość' | 'Flota';
};

export const statusIconOptions: StatusIconOption[] = [
  { icon: '●', label: 'Kropka / domyślny', group: 'Ogólne' },
  { icon: '🟢', label: 'Aktywne / potwierdzone', group: 'Ogólne' },
  { icon: '🟡', label: 'W toku / oczekuje', group: 'Ogólne' },
  { icon: '🔴', label: 'Problem / pilne', group: 'Ogólne' },
  { icon: '✅', label: 'Zakończone', group: 'Ogólne' },
  { icon: '❌', label: 'Anulowane', group: 'Ogólne' },
  { icon: '⚠️', label: 'Uwaga', group: 'Ogólne' },
  { icon: '⭐', label: 'Ważne', group: 'Ogólne' },
  { icon: '📝', label: 'Robocze / draft', group: 'Wydarzenia' },
  { icon: '📅', label: 'Zaplanowane', group: 'Wydarzenia' },
  { icon: '🤝', label: 'Uzgodnione', group: 'Wydarzenia' },
  { icon: '🎬', label: 'Realizacja', group: 'Wydarzenia' },
  { icon: '⏸️', label: 'Wstrzymane', group: 'Wydarzenia' },
  { icon: '📦', label: 'Magazyn / sprzęt', group: 'Magazyn' },
  { icon: '🧰', label: 'Kompletowanie', group: 'Magazyn' },
  { icon: '🚚', label: 'Transport / wydanie', group: 'Magazyn' },
  { icon: '↩️', label: 'Zwrot', group: 'Magazyn' },
  { icon: '🔍', label: 'Kontrola', group: 'Magazyn' },
  { icon: '💰', label: 'Płatność', group: 'Księgowość' },
  { icon: '🧾', label: 'Faktura', group: 'Księgowość' },
  { icon: '📤', label: 'Wysłane do księgowości', group: 'Księgowość' },
  { icon: '📥', label: 'Odebrane / zaksięgowane', group: 'Księgowość' },
  { icon: '🚗', label: 'Auto / flota', group: 'Flota' },
  { icon: '🔧', label: 'Serwis pojazdu', group: 'Flota' },
  { icon: '🛡️', label: 'OC / ubezpieczenie', group: 'Flota' },
];

export function StatusIconPicker({ value, onChange, label = 'Ikona statusu' }: { value?: string | null; onChange: (value: string) => void; label?: string }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return statusIconOptions;
    return statusIconOptions.filter((option) => `${option.icon} ${option.label} ${option.group}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-700">{label}</p>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj ikony..." className="w-44 bg-transparent text-xs font-bold outline-none" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input className={`${inputClass} max-w-[120px] text-center text-lg`} value={value || ''} onChange={(e) => onChange(e.target.value.slice(0, 20))} placeholder="●" />
        <p className="text-xs font-bold text-slate-400">Możesz wybrać ikonę z listy albo wkleić własny emoji/znak.</p>
      </div>

      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-2 md:grid-cols-3 xl:grid-cols-4">
        {filtered.map((option) => {
          const active = option.icon === value;
          return (
            <button
              key={`${option.group}-${option.icon}-${option.label}`}
              type="button"
              onClick={() => onChange(option.icon)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-black transition ${active ? 'border-cyan-400 bg-cyan-50 text-cyan-800 shadow-sm' : 'border-white bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50'}`}
              title={`${option.group}: ${option.label}`}
            >
              <span className="text-lg leading-none">{option.icon}</span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
