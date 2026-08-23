'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Wrench, Loader2, Settings, LayoutGrid, 
  Truck, FileText, CheckSquare, Plus, AlertCircle,
  Box, Activity, Minus, Zap, ArrowRight, Flag, Car, ChevronRight, ChevronDown, Users, ArchiveRestore, CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ProductUI';
import { QuickAddCalendarModal } from '../../components/QuickAddCalendarModal';
import { SimpleModal } from '../../components/SimpleModal';
import { useAuthStore } from '../../store/auth.store';

// ============================================================================
// POMOCNICZE FUNKCJE
// ============================================================================
const formatMoney = (val: any) => `${Number(val || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

const formatTaskTime = (dateStr: string) => {
  if (!dateStr) return 'Brak terminu';
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  const isTomorrow = d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();

  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Dzisiaj, ${time}`;
  if (isTomorrow) return `Jutro, ${time}`;
  return `${d.toLocaleDateString('pl-PL')} ${time}`;
};

// ============================================================================
// WIDGET REGISTRY (Zmodernizowany Wygląd)
// ============================================================================

const WIDGETS: Record<string, { title: string; colSpan: string; render: (data: any, router: any) => JSX.Element }> = {
  
  'kpi-events': {
    title: 'KPI: Wydarzenia w tygodniu',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => (
      <div className="relative h-full flex flex-col justify-between p-6 rounded-[32px] bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg cursor-pointer transition-all duration-300 group overflow-hidden" onClick={() => router.push('/dashboard/events')}>
        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Wydarzenia</p>
            <p className="mt-2 text-6xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-sm">{data?.kpis?.eventsThisWeek ?? 0}</p>
          </div>
          <div className="rounded-[20px] bg-blue-500 text-white p-3.5 shadow-md shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><Calendar size={24} strokeWidth={2.5} /></div>
        </div>
        <p className="mt-4 text-[11px] font-bold text-slate-400 relative z-10 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>Zaplanowane w tym tygodniu</p>
        
        <div className="absolute -bottom-2 left-0 w-full h-20 opacity-30 pointer-events-none transition-opacity duration-300 group-hover:opacity-50">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,25 C30,10 60,30 100,5 L100,30 L0,30 Z" fill="url(#blue-grad)" />
            <defs><linearGradient id="blue-grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="transparent"/></linearGradient></defs>
          </svg>
        </div>
      </div>
    )
  },

  'kpi-service': {
    title: 'KPI: Serwis Sprzętu',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => (
      <div className="relative h-full flex flex-col justify-between p-6 rounded-[32px] bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg cursor-pointer transition-all duration-300 group overflow-hidden" onClick={() => router.push('/dashboard/service')}>
        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Sprzęt w naprawie</p>
            <p className="mt-2 text-6xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-sm">{data?.kpis?.activeService ?? 0}</p>
          </div>
          <div className="rounded-[20px] bg-purple-500 text-white p-3.5 shadow-md shadow-purple-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300"><Wrench size={24} strokeWidth={2.5} /></div>
        </div>
        <p className="mt-4 text-[11px] font-bold text-slate-400 relative z-10 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>Otwarte zgłoszenia</p>

        <div className="absolute -bottom-2 left-0 w-full h-20 opacity-30 pointer-events-none transition-opacity duration-300 group-hover:opacity-50">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,25 C30,10 60,30 100,5 L100,30 L0,30 Z" fill="url(#purp-grad)" />
            <defs><linearGradient id="purp-grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#a855f7"/><stop offset="100%" stopColor="transparent"/></linearGradient></defs>
          </svg>
        </div>
      </div>
    )
  },

  'quick-actions': {
    title: 'Szybkie akcje operacyjne',
    colSpan: 'md:col-span-2 xl:col-span-2',
    render: (data, router) => (
      <div className="h-full flex flex-col justify-center rounded-[32px] bg-white dark:bg-slate-900 p-7 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Zap size={16} className="text-[#04e0ff] fill-[#04e0ff]/20"/> Szybkie akcje
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: 'Wydarzenie', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 hover:bg-blue-500 hover:text-white', href: '/dashboard/events/new' },
            { icon: FileText, label: 'Oferta', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 hover:bg-purple-500 hover:text-white', href: '/dashboard/offers' },
            { icon: Box, label: 'Wydanie (WZ)', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white', href: '/dashboard/warehouse/receiving' },
            { icon: Wrench, label: 'Zgłoś Serwis', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-500 hover:text-white', href: '/dashboard/service' },
          ].map((action, i) => (
            <button key={i} onClick={() => router.push(action.href)} className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[20px] ${action.bg} transition-all duration-300 group`}>
              <action.icon size={26} className={`${action.color} group-hover:text-white transition-colors duration-300`} strokeWidth={2} /> 
              <span className={`text-[12px] font-black ${action.color} group-hover:text-white transition-colors duration-300`}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  },

  'smartflow-insights': {
    title: 'SmartFlow: Podsumowanie Dnia',
    colSpan: 'md:col-span-2 xl:col-span-2',
    render: (data, router) => {
      const issues = (data?.fleetAlerts?.length || 0) + (data?.unreturned?.length || 0) + (data?.kpis?.activeService || 0);
      return (
        <div className="h-full flex flex-col justify-center rounded-[32px] bg-slate-900 p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <svg viewBox="0 0 400 200" className="w-full h-full object-cover">
              <path d="M0,100 C150,200 250,0 400,100 L400,200 L0,200 Z" fill="url(#wave-gradient)" />
              <path d="M0,150 C100,50 300,250 400,50 L400,200 L0,200 Z" fill="url(#wave-gradient-2)" />
              <defs>
                <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#04e0ff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <h2 className="mb-4 text-[12px] font-black uppercase tracking-[0.2em] text-[#04e0ff] flex items-center gap-2 relative z-10">
            <Activity size={16} /> Podsumowanie dnia
          </h2>
          <p className="text-[14px] font-medium leading-relaxed text-slate-300 relative z-10 max-w-sm">
            Masz dzisiaj w planie <b className="text-white">{data?.todaysEvents?.length || 0} wydarzeń</b>. Oczekuje <b className="text-white">{data?.pendingOffers?.length || 0} ofert</b> do przypisania statusu.<br/><br/>System wykrył <b className="text-white">{issues} alertów operacyjnych</b>.
          </p>
          <div className="mt-6 relative z-10">
            <button onClick={() => router.push('/dashboard/events')} className="text-[12px] font-black px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center gap-2 border border-white/5">
              Przejdź do projektów <ArrowRight size={14}/>
            </button>
          </div>
        </div>
      );
    }
  },

  'events-today': {
    title: 'Plan wydarzeń na dzisiaj',
    colSpan: 'md:col-span-2 xl:col-span-2',
    render: (data, router) => (
      <div className="h-full flex flex-col p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Calendar size={16} className="text-blue-500"/> Plan na dzisiaj
          </h2>
          <button onClick={() => router.push('/dashboard/calendar')} className="text-[11px] font-black tracking-wider text-[#04e0ff] hover:text-cyan-600 transition-colors flex items-center gap-1 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1.5 rounded-lg">
            Kalendarz <ArrowRight size={12}/>
          </button>
        </div>
        <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {(data?.todaysEvents || []).map((e: any) => (
            <div key={e.id} className="flex gap-4 relative group cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition" onClick={() => router.push(`/dashboard/events/${e.id}`)}>
              <div className="flex flex-col items-center pt-1">
                <div className="text-[12px] font-black text-slate-600 dark:text-slate-400 w-12 text-right">{e.time?.split(' - ')[0] || e.time}</div>
              </div>
              <div className="relative w-1 bg-slate-100 dark:bg-slate-800 flex-shrink-0 rounded-full">
                <div className="absolute -left-[3px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 shadow-sm" style={{ backgroundColor: e.typeColor || '#3b82f6' }} />
              </div>
              <div className="pb-1 flex-1 min-w-0">
                <p className="font-black text-slate-800 dark:text-white text-[14px] group-hover:text-blue-600 transition-colors truncate">{e.title}</p>
                <p className="text-[12px] font-semibold text-slate-500 mt-1 truncate flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {e.type} · {e.location}</p>
              </div>
            </div>
          ))}
          {(!data?.todaysEvents || data.todaysEvents.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 p-6 text-center bg-slate-50/50 dark:bg-transparent">
              <Calendar size={28} className="text-slate-300 dark:text-slate-600 mb-3"/>
              <p className="text-[14px] font-black text-slate-600 dark:text-slate-400">Masz czysty grafik.</p>
              <p className="text-[12px] font-bold text-slate-400 mt-1">Brak wydarzeń zaplanowanych na dzisiaj.</p>
            </div>
          )}
        </div>
      </div>
    )
  },

  'smartflow-inventory': {
    title: 'Stan i zdatność magazynu',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => {
      const total = data?.inventory?.total || 0;
      const inService = data?.inventory?.inService || 0;
      const ok = total - inService;
      const percent = total > 0 ? Math.round((ok / total) * 100) : 100;
      
      return (
        <div className="h-full flex flex-col rounded-[32px] bg-white dark:bg-slate-900 p-7 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg transition-all cursor-pointer" onClick={() => router.push('/dashboard/warehouse/items')}>
          <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
            <ArchiveRestore size={16} className="text-purple-500"/> Kondycja Sprzętu
          </h2>
          <div className="flex-1 flex flex-col justify-center items-center relative py-4">
             <svg viewBox="0 0 100 100" className="w-36 h-36 drop-shadow-sm">
               <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="12" />
               <circle cx="50" cy="50" r="40" fill="none" stroke="url(#donut-gradient)" strokeWidth="12" strokeDasharray={`${percent * 2.51} 251`} strokeLinecap="round" transform="rotate(-90 50 50)" />
               <text x="50" y="47" textAnchor="middle" dy="6" className="text-[24px] font-black fill-slate-800 dark:fill-white">{percent}%</text>
               <text x="50" y="65" textAnchor="middle" className="text-[9px] font-black uppercase tracking-wider fill-slate-400">zdatne</text>
               <defs>
                 <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                   <stop offset="0%" stopColor="#04e0ff" />
                   <stop offset="100%" stopColor="#8b5cf6" />
                 </linearGradient>
               </defs>
             </svg>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 border-t border-slate-100 dark:border-white/5 pt-4">
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase">Ewidencja</p>
              <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{total}</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl text-center border border-rose-100 dark:border-rose-500/20">
              <p className="text-[10px] font-black text-rose-400 uppercase">Usterki</p>
              <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">{inService}</p>
            </div>
          </div>
        </div>
      );
    }
  },

  'pending-offers': {
    title: 'Oczekujące Oferty',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => (
      <div className="h-full flex flex-col p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText size={16} className="text-emerald-500"/> Oczekujące
          </h2>
          <button onClick={() => router.push('/dashboard/offers')} className="text-[11px] font-black tracking-wider text-[#04e0ff] hover:text-cyan-600 transition-colors flex items-center gap-1 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1.5 rounded-lg">
            Więcej <ArrowRight size={12}/>
          </button>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {(data?.pendingOffers || []).map((o: any) => (
            <div key={o.id} onClick={() => router.push(`/dashboard/offers/${o.id}`)} className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer transition-colors flex justify-between items-center group">
              <div className="min-w-0 pr-3">
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{o.nazwa}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1 truncate">{o.kontrahent?.nazwa_skrocona || o.kontrahent?.nazwa || 'Brak klienta'}</p>
              </div>
              <span className="text-[12px] font-black text-emerald-600 whitespace-nowrap bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-100 dark:border-white/5">{formatMoney(o.suma_netto)}</span>
            </div>
          ))}
          {(!data?.pendingOffers || data.pendingOffers.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 p-6 text-center bg-slate-50/50 dark:bg-transparent">
              <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Brak ofert w toku.</p>
            </div>
          )}
        </div>
      </div>
    )
  },

  'fleet-alerts': {
    title: 'Alerty operacyjne systemu',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => {
      const alertsList = [];
      if (data?.unreturned?.length > 0) {
        alertsList.push({ icon: Truck, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', title: 'Zaległe zwroty', desc: `${data.unreturned.length} wynajmów po terminie`, href: '/dashboard/warehouse/unreturned' });
      }
      if (data?.alerts && data.alerts.length > 0) {
        alertsList.push({ icon: Wrench, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', title: 'Awarie i Serwis', desc: `${data.alerts.length} urządzeń zgłoszonych`, href: '/dashboard/service' });
      }

      return (
        <div className="h-full flex flex-col p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
            <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500"/> System
            </h2>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 pt-2">
            {alertsList.map((a, i) => (
              <div key={i} onClick={() => router.push(a.href)} className="p-4 rounded-[20px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 cursor-pointer transition-all flex items-center gap-4 group">
                 <div className={`p-3 rounded-2xl ${a.bg} ${a.color} shrink-0 group-hover:scale-110 transition-transform`}><a.icon size={18} strokeWidth={2.5}/></div>
                 <div className="min-w-0 flex-1">
                   <p className="text-[13px] font-black text-slate-800 dark:text-slate-200 truncate">{a.title}</p>
                   <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">{a.desc}</p>
                 </div>
              </div>
            ))}
            {alertsList.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 p-6 text-center bg-slate-50/50 dark:bg-transparent">
                <CheckCircle2 size={28} className="text-emerald-400 mb-3" />
                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Wszystkie systemy w normie.</p>
              </div>
            )}
          </div>
        </div>
      );
    }
  },

  'tasks-todo': {
    title: 'Moje przypisane zadania',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data, router) => (
      <div className="h-full flex flex-col p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-500"/> Zadania
          </h2>
          <button onClick={() => router.push('/dashboard/tasks')} className="text-[11px] font-black tracking-wider text-[#04e0ff] hover:text-cyan-600 transition-colors flex items-center gap-1 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1.5 rounded-lg">
            Tablica <ArrowRight size={12}/>
          </button>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {(data?.tasks || []).map((t: any) => (
            <div key={t.id} onClick={() => router.push(`/dashboard/tasks/${t.id}`)} className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors flex items-start gap-3 group rounded-xl border border-slate-100 dark:border-white/5">
              <div className="w-4 h-4 mt-0.5 rounded border-2 border-slate-300 dark:border-slate-600 shrink-0 group-hover:border-blue-500 transition-colors"></div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-slate-800 dark:text-slate-200 leading-snug group-hover:text-[#04e0ff] transition-colors truncate">{t.tytul}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1.5">{formatTaskTime(t.data_koniec)}</p>
              </div>
            </div>
          ))}
          {(!data?.tasks || data.tasks.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 p-6 text-center bg-slate-50/50 dark:bg-transparent">
              <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Brak nowych zadań.</p>
            </div>
          )}
        </div>
      </div>
    )
  },

  'sales-funnel': {
    title: 'Analiza finansowa ofert (Lejek)',
    colSpan: 'md:col-span-1 xl:col-span-1',
    render: (data) => {
      const finanse = data?.finanse || { total: 0, accepted: 0, pending: 0, rejected: 0 };
      const acceptedValue = finanse.accepted || 0;
      const pendingValue = finanse.pending || 0;
      const totalValue = finanse.total || 0;

      return (
        <div className="h-full flex flex-col p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
            <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity size={16} className="text-emerald-500"/> Pipeline
            </h2>
          </div>
          
          <div className="flex-1 flex gap-6 mt-2 items-center">
             <div className="w-12 h-full flex flex-col items-center justify-center gap-1.5">
                <div className="w-full h-1/4 bg-blue-500 rounded-t-xl rounded-b-md shadow-inner" title="Wszystkie otwarte"></div>
                <div className="w-4/5 h-1/4 bg-purple-500 rounded-md shadow-inner" title="W trakcie analizy"></div>
                <div className="w-3/5 h-1/4 bg-teal-400 rounded-md shadow-inner" title="Po akceptacji wstępnej"></div>
                <div className="w-2/5 h-1/4 bg-emerald-500 rounded-t-md rounded-b-xl shadow-inner" title="Finalnie Zaakceptowane"></div>
             </div>
             
             <div className="flex flex-col justify-between py-2 shrink-0 text-left h-full w-full">
                <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-100 dark:border-white/5 mb-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Otwarte</p><p className="text-[13px] font-black text-slate-800 dark:text-white leading-none mt-1">{formatMoney(totalValue)}</p></div>
                <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-100 dark:border-white/5 mb-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">W procesie</p><p className="text-[13px] font-black text-slate-800 dark:text-white leading-none mt-1">{formatMoney(pendingValue)}</p></div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20"><p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Zaakceptowane</p><p className="text-[13px] font-black text-emerald-700 dark:text-emerald-400 leading-none mt-1">{formatMoney(acceptedValue)}</p></div>
             </div>
          </div>
        </div>
      );
    }
  }
};

const DEFAULT_LAYOUT = [
  'kpi-events', 'kpi-service', 'quick-actions', 
  'events-today', 'smartflow-insights', 
  'smartflow-inventory', 'pending-offers', 'fleet-alerts', 'tasks-todo', 'sales-funnel'
];

// ============================================================================
// GŁÓWNY KOMPONENT KOKPITU
// ============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [dict, setDict] = useState<any>({ typy: [], statusy: [], kontrahenci: [], miejsca: [], uzytkownicy: [] });
  const [errorMsg, setErrorMsg] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<string[]>(DEFAULT_LAYOUT);
  
  const user = useAuthStore((s) => s.user);

  const dzisiaj = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const dzisiejszaData = dzisiaj.charAt(0).toUpperCase() + dzisiaj.slice(1);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Ładujemy dane agregacyjne i słownikowe równolegle, w tym z wielu endpointów API aby nakarmić dashboard
      const [summaryRes, typy, statusy, kontrahenci, miejsca, uzytkownicy, ofertyRes, zadaniaRes, egzemplarzeRes, wynajmyRes] = await Promise.all([
        api.get('/api/dashboard/summary').catch(err => ({ data: null, error: err })),
        api.get('/api/slowniki/typy-wydarzen').catch(() => ({ data: [] })),
        api.get('/api/slowniki/statusy-wydarzenia').catch(() => ({ data: [] })),
        api.get('/api/slowniki/kontrahenci').catch(() => ({ data: [] })),
        api.get('/api/slowniki/miejsca').catch(() => ({ data: [] })),
        api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
        api.get('/api/oferty').catch(() => ({ data: [] })),
        api.get('/api/zadania?tab=moje').catch(() => ({ data: [] })),
        api.get('/api/magazyn/wszystkie-egzemplarze').catch(() => ({ data: [] })),
        api.get('/api/wynajmy').catch(() => ({ data: [] })),
      ]);

      setDict({ typy: typy.data || [], statusy: statusy.data || [], kontrahenci: kontrahenci.data || [], miejsca: miejsca.data || [], uzytkownicy: uzytkownicy.data || [] });

      // Przetwarzanie i mapowanie danych z różnych modułów do zasilania widgetów
      const summary = summaryRes.data || {};
      const oferty = ofertyRes.data || [];
      const zadania = (zadaniaRes.data || []).slice(0, 8);
      const egzemplarze = egzemplarzeRes.data || [];
      const wynajmy = wynajmyRes.data || [];

      // Ewidencja i usterki magazynowe
      const inventory = {
        total: egzemplarze.length,
        inService: egzemplarze.filter((e: any) => e.status_serwisowy !== 'Działa' && e.status_serwisowy !== 'naprawiony' && e.status_serwisowy !== '' && e.status_serwisowy !== null).length
      };

      // Niezwrócony sprzęt (po terminie planowanego zwrotu)
      const now = new Date();
      const unreturned = wynajmy.filter((w: any) => !w.data_zwrotu_rzeczywista && w.data_zwrotu_planowana && new Date(w.data_zwrotu_planowana) < now);

      // Oferty procesowane (bez finalnych statusów odrzucenia lub pełnej akceptacji)
      const pendingOffers = oferty.filter((o: any) => {
        const s = String(o.status?.nazwa || '').toLowerCase();
        return !s.includes('zaakceptowan') && !s.includes('odrzucon');
      }).slice(0, 8);

      // Lejek ofert - analiza
      const finanse = {
        total: oferty.reduce((sum: number, o: any) => sum + Number(o.suma_netto || 0), 0),
        accepted: oferty.filter((o: any) => String(o.status?.nazwa || '').toLowerCase().includes('zaakceptowan')).reduce((sum: number, o: any) => sum + Number(o.suma_netto || 0), 0),
        rejected: oferty.filter((o: any) => String(o.status?.nazwa || '').toLowerCase().includes('odrzucon')).reduce((sum: number, o: any) => sum + Number(o.suma_netto || 0), 0),
        pending: pendingOffers.reduce((sum: number, o: any) => sum + Number(o.suma_netto || 0), 0),
      };

      setData({
        ...summary,
        inventory,
        unreturned,
        pendingOffers,
        finanse,
        tasks: zadania,
        oferty
      });
      
      // Układ użytkownika z bazy, lub domyślny
      if (summary?.preferences?.layout && Array.isArray(summary.preferences.layout)) {
        const validLayout = summary.preferences.layout.filter((id: string) => WIDGETS[id]);
        if (validLayout.length > 0) setLayout(validLayout);
      }

    } catch (err) {
      console.error(err);
      setErrorMsg('Wystąpił nieoczekiwany błąd podczas ładowania kokpitu.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // --- DRAG & DROP WIDGETÓW ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!isEditing) return;
    e.dataTransfer.setData('widget-id', id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Zapisujemy referencję do node'a DOM, aby nie stracić go w asynchronicznym setTimeout
    const targetNode = e.currentTarget as HTMLElement;
    
    setTimeout(() => { 
      if (targetNode) targetNode.classList.add('opacity-40', 'scale-95'); 
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (isEditing) e.currentTarget.classList.add('ring-2', 'ring-[#04e0ff]');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('ring-2', 'ring-[#04e0ff]');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-[#04e0ff]');
    if (!isEditing) return;
    
    const sourceId = e.dataTransfer.getData('widget-id');
    if (sourceId && sourceId !== targetId) {
      const newLayout = [...layout];
      const srcIdx = newLayout.indexOf(sourceId);
      const tgtIdx = newLayout.indexOf(targetId);
      
      newLayout.splice(srcIdx, 1);
      newLayout.splice(tgtIdx, 0, sourceId);
      
      setLayout(newLayout);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-40', 'scale-95');
  };

  const saveLayout = async () => {
    setIsEditing(false);
    setShowWidgetPicker(false);
    try {
      await api.post('/api/dashboard/preferences', { layout });
    } catch (e) {
      console.error('Błąd zapisu preferencji', e);
    }
  };

  const removeWidget = (id: string) => setLayout(prev => prev.filter(w => w !== id));
  const addWidget = (id: string) => { if (!layout.includes(id)) setLayout(prev => [...prev, id]); };

  if (isLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#04e0ff]" /></div>;

  const unusedWidgets = Object.keys(WIDGETS).filter(id => !layout.includes(id));
  const firstName = user?.imie || 'Admin';

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-20 animate-fade-in-up">
      
      <style dangerouslySetInnerHTML={{ __html: `
        .is-editing-mode {
          animation: gentle-pulse 2.5s ease-in-out infinite alternate;
          cursor: grab;
          position: relative;
          z-index: 10;
        }
        .is-editing-mode:active { 
          cursor: grabbing; 
          transform: scale(0.96) !important;
          animation: none;
        }
        @keyframes gentle-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(4, 224, 255, 0); }
          100% { transform: scale(0.99); box-shadow: 0 0 20px rgba(4, 224, 255, 0.2); }
        }
      `}} />

      {/* NAGŁÓWEK */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#04e0ff] mb-1">{dzisiejszaData}</p>
          <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            {isEditing ? "Dostosowujesz wygląd kokpitu" : `Witaj ponownie, ${firstName}! 👋`}
          </h1>
          <p className="mt-1 max-w-2xl text-xs font-bold text-slate-500 dark:text-slate-400">
            {isEditing ? "Przeciągnij kafelki, aby zmienić układ. Kliknij minus, aby usunąć z widoku." : "Oto Twoje inteligentne podsumowanie pracy operacyjnej EventFlow ze wszystkich modułów."}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {isEditing && (
            <>
              <Button variant="secondary" onClick={() => setShowWidgetPicker(true)}>
                <Plus size={16} className="inline mr-1" /> Dodaj widget
              </Button>
              <button onClick={saveLayout} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
                Zakończ edycję
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {/* GRID WIDGETÓW */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-5 auto-rows-min">
        {layout.map((id) => {
          const widget = WIDGETS[id];
          if (!widget) return null;

          return (
            <div
              key={id}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              className={`
                ${widget.colSpan} transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isEditing ? 'is-editing-mode ring-2 ring-blue-400 dark:ring-blue-500 rounded-[32px] overflow-hidden shadow-lg transform-gpu scale-[0.98]' : ''}
              `}
            >
              <div className={`relative h-full pointer-events-auto ${isEditing ? 'pointer-events-none' : ''}`}>
                {isEditing && (
                  <div className="absolute inset-0 z-20 rounded-[32px] bg-slate-900/10 dark:bg-black/40 backdrop-blur-[2px]">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeWidget(id); }}
                      className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl hover:scale-110 hover:bg-rose-600 transition-transform pointer-events-auto"
                      title="Usuń widget z widoku"
                    >
                      <Minus size={20} strokeWidth={3} />
                    </button>
                  </div>
                )}
                
                {widget.render(data, router)}
              </div>
            </div>
          );
        })}

        {layout.length === 0 && !isEditing && (
          <div className="md:col-span-2 xl:col-span-5 py-24 text-center rounded-[32px] border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
            <LayoutGrid size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-black text-slate-600 dark:text-slate-300">Twój obszar roboczy jest pusty.</p>
            <p className="text-sm font-bold text-slate-400 mt-2">Włącz tryb edycji, aby przypiąć dynamiczne kafelki.</p>
            <Button className="mt-6" onClick={() => setIsEditing(true)}>Dostosuj Kokpit</Button>
          </div>
        )}
      </div>

      {!isEditing && layout.length > 0 && (
         <div className="flex justify-center pt-8 opacity-50 hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
              <Settings size={14} /> Przeorganizuj kokpit główny
            </button>
         </div>
      )}

      {/* MODAL Z NIEAKTYWNYMI WIDGETAMI */}
      {showWidgetPicker && (
        <SimpleModal title="Katalog widgetów" onClose={() => setShowWidgetPicker(false)} className="max-w-4xl">
          <div className="grid gap-3 md:grid-cols-2">
            {unusedWidgets.map(id => (
              <div key={`pick-${id}`} className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4 flex items-center justify-between border border-transparent hover:border-cyan-500/30 transition-colors">
                <span className="text-sm font-bold text-slate-800 dark:text-white">{WIDGETS[id].title}</span>
                <button 
                  onClick={() => addWidget(id)}
                  className="w-10 h-10 rounded-full bg-white dark:bg-black/20 text-[#04e0ff] flex items-center justify-center shadow-sm hover:bg-gradient-to-r hover:from-[#04e0ff] hover:to-blue-600 hover:text-white transition-colors"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {unusedWidgets.length === 0 && (
              <div className="md:col-span-2 text-center py-10 text-sm font-bold text-slate-400">
                Wszystkie dostępne widgety operacyjne są już przypięte na Twoim kokpicie.
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-end">
            <Button onClick={() => setShowWidgetPicker(false)}>Zamknij dodawanie</Button>
          </div>
        </SimpleModal>
      )}

      {showAdd && <QuickAddCalendarModal dict={dict} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}
