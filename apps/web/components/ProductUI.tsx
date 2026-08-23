import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#0891B2]">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '', onClick, ...props }: { children: React.ReactNode; className?: string; onClick?: () => void } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      onClick={onClick} 
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  const cls = variant === 'primary'
    ? 'bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white shadow-md shadow-[#04e0ff]/20 hover:shadow-lg hover:shadow-[#04e0ff]/40 hover:scale-[1.02] border-0'
    : variant === 'danger'
      ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/20'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5';
      
  return (
    <button 
      type={type} 
      disabled={disabled} 
      onClick={onClick} 
      className={`rounded-xl px-5 py-2.5 text-sm font-black transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-slate-700 dark:text-slate-300"><span className="mb-1 block">{label}</span>{children}</label>;
}

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-slate-950 dark:text-white';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-white/10 dark:bg-slate-950"><p className="font-black text-slate-700 dark:text-slate-200">{title}</p>{description && <p className="mt-2 text-sm text-slate-500">{description}</p>}</div>;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Wybierz...',
  disabled = false
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const filtered = safeOptions.filter(o =>
    String(o.label || '').toLowerCase().includes(query.toLowerCase())
  );

  const selectedOption = safeOptions.find(o => String(o.value) === String(value));

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${inputClass} flex w-full min-w-0 items-center justify-between text-left ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <span className="block flex-1 min-w-0 truncate pr-2 text-slate-700 dark:text-slate-200">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900 custom-scrollbar">
          <div className="sticky top-0 mb-1 bg-white pb-1 dark:bg-slate-900">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                autoFocus
                className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                placeholder="Szukaj..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              setQuery('');
            }}
            className={`flex w-full min-w-0 items-center rounded-lg px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-white/5 ${!value ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Brak / Wyczyść
          </button>
          
          {filtered.map((o, index) => (
            <button
              // Zabezpieczamy unikalność klucza generując go wspólnie z indexem
              key={`searchable-option-${String(o.value || '')}-${index}`}
              type="button"
              onClick={() => {
                onChange(String(o.value));
                setIsOpen(false);
                setQuery('');
              }}
              className={`flex w-full min-w-0 items-center rounded-lg px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-white/5 ${String(value) === String(o.value) ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30' : 'text-slate-700 dark:text-slate-200'}`}
              title={o.label}
            >
              <span className="block flex-1 min-w-0 truncate">{o.label}</span>
            </button>
          ))}
          
          {filtered.length === 0 && (
            <div className="p-3 text-center text-sm font-bold text-slate-400">
              Brak wyników
            </div>
          )}
        </div>
      )}
    </div>
  );
}