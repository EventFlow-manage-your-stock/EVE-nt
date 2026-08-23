'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Search, Calendar, User, Eye, Edit2, CheckCircle2, Clock, PlayCircle, Video, ListTodo, Loader2 } from 'lucide-react';
import { useTasksStore } from '../../../store/tasks.store';
import { api } from '../../../lib/api';

export default function TasksListPage() {
  const router = useRouter();
  const { tasks, dictionaries, filters, setFilter, fetchTasks, fetchDictionaries, isLoading } = useTasksStore();

  useEffect(() => {
    fetchDictionaries();
    fetchTasks();
  }, []);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/api/zadania/${id}/status`, { status: newStatus });
      fetchTasks();
    } catch (error) {
      console.error('Błąd zmiany statusu', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'nowe': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'w trakcie': return 'bg-amber-50 text-amber-600 border-amber-300';
      case 'zakończone': return 'bg-emerald-50 text-emerald-600 border-emerald-300';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const tabs = [
    { id: 'moje', label: 'Moje', count: tasks.filter(t => filters.tab === 'moje').length },
    { id: 'zlecone', label: 'Zlecone', count: 0 },
    { id: 'wg_eventow', label: 'Wg eventów' },
    { id: 'pozostale', label: 'Pozostałe' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in-up">
      
      <div className="flex items-center text-sm text-slate-500 gap-2 mb-2 mt-4">
        <span className="cursor-pointer hover:text-[#00B5B5] font-semibold" onClick={() => router.push('/dashboard')}>Kokpit</span> 
        <ChevronRight size={14} />
        <span className="font-bold text-[#00B5B5] border-b-2 border-[#00B5B5] pb-0.5">Zadania</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* TABS & TOP TOOLBAR */}
        <div className="flex items-center justify-between border-b border-slate-100 px-2 bg-slate-50/50">
          <div className="flex">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setFilter('tab', tab.id)}
                className={`px-5 py-4 text-sm font-bold transition flex items-center gap-2 border-b-2 ${filters.tab === tab.id ? 'border-[#00B5B5] text-[#00B5B5]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {tab.label} {tab.count !== undefined && <span className={`px-2 py-0.5 rounded-full text-[10px] ${filters.tab === tab.id ? 'bg-[#00B5B5]/10' : 'bg-slate-200'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-emerald-500 text-emerald-600 bg-emerald-50 font-bold rounded-lg text-sm shadow-sm hover:bg-emerald-100 transition mr-4">
            <Video size={16} /> Zobacz jak działają zadania
          </button>
        </div>

        {/* FILTERS ROW */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 bg-white items-center">
          <button onClick={() => router.push('/dashboard/tasks/new')} className="flex items-center gap-2 bg-[#00B5B5] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-teal-400 transition">
            <Plus size={16} /> Dodaj
          </button>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Wyszukaj..." 
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#00B5B5] outline-none" 
            />
          </div>

          <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} className="border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-[#00B5B5]">
            <option value="">Typ zadania</option>
            <option value="przygotowanie">Przygotowanie sprzętu</option>
            <option value="spotkanie">Spotkanie</option>
          </select>

          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-[#00B5B5]">
            <option value="">Status</option>
            <option value="nowe">Nowe</option>
            <option value="w trakcie">W trakcie</option>
            <option value="zakończone">Zakończone</option>
          </select>

          <label className="flex items-center gap-2 border border-slate-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilter('overdue', e.target.checked)} className="rounded text-[#00B5B5]" />
            <span className="text-sm font-medium text-slate-600">Po terminie</span>
          </label>

          <select value={filters.eventId} onChange={(e) => setFilter('eventId', e.target.value)} className="border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-[#00B5B5]">
            <option value="">Wydarzenie</option>
            {dictionaries.wydarzenia.map((w: any) => <option key={w.id} value={w.id}>{w.nazwa}</option>)}
          </select>

          <select value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} className="border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-[#00B5B5]">
            <option value="">Użytkownik</option>
            {dictionaries.uzytkownicy.map((u: any) => <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>)}
          </select>
        </div>

        {/* LISTA ZADAŃ (Kafelki jak na obrazku) */}
        <div className="p-4 bg-slate-50/50 min-h-[500px]">
          {isLoading ? (
            <div className="flex justify-center p-12 text-[#00B5B5]"><Loader2 className="animate-spin w-8 h-8" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center p-12 text-slate-400 font-medium bg-white rounded-xl border border-slate-200 border-dashed">Brak zadań w wybranym widoku.</div>
          ) : (
            <div className="space-y-3">
              
              {/* Nagłówki kolumn nad listą */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-1"></div>
                <div className="col-span-4">Nazwa</div>
                <div className="col-span-2">Typ</div>
                <div className="col-span-2">Os. przypisane</div>
                <div className="col-span-1">Powiązane</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-1 text-right">Data utworzenia</div>
              </div>

              {tasks.map(task => (
                <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#00B5B5]/50 transition flex items-center gap-4">
                  
                  <div className="flex items-center gap-3 pl-2 shrink-0">
                    <input type="checkbox" className="rounded border-slate-300 text-[#00B5B5]" />
                    <div className="w-8 h-8 rounded-full border border-sky-200 text-sky-500 bg-sky-50 flex items-center justify-center font-bold text-lg leading-none pb-0.5">
                      +
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center flex-1">
                    
                    {/* NAZWA */}
                    <div className="col-span-4 flex items-center gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-sky-600 hover:underline cursor-pointer" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>{task.tytul}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                          <Calendar size={12} /> {task.data_start ? new Date(task.data_start).toLocaleDateString() : 'Brak'} - {task.data_koniec ? new Date(task.data_koniec).toLocaleDateString() : 'Brak'}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-auto shrink-0">
                         <button onClick={() => router.push(`/dashboard/tasks/${task.id}`)} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-md"><Eye size={14}/></button>
                         <button onClick={() => router.push(`/dashboard/tasks/${task.id}`)} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-md"><Edit2 size={14}/></button>
                      </div>
                    </div>

                    {/* TYP */}
                    <div className="col-span-2">
                       <span className="px-3 py-1 border border-slate-200 rounded-md text-xs font-semibold text-slate-500">{task.typ_zadania || 'Nie określono'}</span>
                    </div>

                    {/* OS. PRZYPISANE */}
                    <div className="col-span-2 flex items-center gap-1">
                       <button className="w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-[#00B5B5] transition"><Plus size={12}/></button>
                       <div className="flex -space-x-2">
                         {task.przypisani_uzytkownicy.slice(0, 3).map((u: any, i: number) => (
                           <div key={i} className="w-6 h-6 rounded-full bg-[#11282D] border-2 border-white text-white flex items-center justify-center text-[9px] font-bold" title={`${u.uzytkownik.imie} ${u.uzytkownik.nazwisko}`}>
                             {u.uzytkownik.imie.charAt(0)}{u.uzytkownik.nazwisko.charAt(0)}
                           </div>
                         ))}
                       </div>
                    </div>

                    {/* POWIĄZANE */}
                    <div className="col-span-1 text-xs text-slate-500 font-medium truncate">
                      {task.wydarzenie?.nazwa || task.kontrahent?.nazwa || '-'}
                    </div>

                    {/* STATUS */}
                    <div className="col-span-1 flex justify-center">
                       <select 
                        value={task.status} 
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${getStatusColor(task.status)}`}
                       >
                         <option value="nowe">Nowe</option>
                         <option value="w trakcie">W trakcie</option>
                         <option value="zakończone">Zakończone</option>
                       </select>
                    </div>

                    {/* DATA UTWORZENIA */}
                    <div className="col-span-1 text-right text-xs font-medium text-slate-500">
                      {new Date(task.data_utworzenia).toLocaleDateString()}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}