'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight, Save, Loader2, X, ArrowLeft, Type, AlignLeft, Bold, Italic, Link as LinkIcon, Image as ImageIcon, List, ListOrdered } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useTasksStore } from '../../../../store/tasks.store';

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';
  
  const { dictionaries, fetchDictionaries } = useTasksStore();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  
  const [isLoading, setIsLoading] = useState(!isNew);

  useEffect(() => {
    fetchDictionaries();
    if (!isNew) {
      fetchTask();
    }
  }, [params.id]);

  const fetchTask = async () => {
    try {
      const res = await api.get(`/api/zadania/${params.id}`);
      const data = res.data;
      reset({
        ...data,
        data_start: data.data_start ? data.data_start.slice(0, 16) : '',
        data_koniec: data.data_koniec ? data.data_koniec.slice(0, 16) : '',
        przypisani: data.przypisani_uzytkownicy?.map((u: any) => u.id_uzytkownika.toString()) || []
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // Przygotowanie multi-selectów jeśli to konieczne
      if (!Array.isArray(data.przypisani)) {
        data.przypisani = data.przypisani ? [data.przypisani] : [];
      }

      if (isNew) {
        await api.post('/api/zadania', data);
      } else {
        await api.put(`/api/zadania/${params.id}`, data);
      }
      router.push('/dashboard/tasks');
    } catch (error) {
      console.error('Błąd zapisu zadania', error);
      alert('Wystąpił błąd podczas zapisywania.');
    }
  };

  if (isLoading) return <div className="p-12 flex justify-center text-[#00B5B5]"><Loader2 className="animate-spin w-8 h-8"/></div>;

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
      
      <div className="flex items-center px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push('/dashboard/tasks')} className="mr-4 text-slate-400 hover:text-[#00B5B5] transition">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center text-sm text-slate-500 gap-2 flex-1">
          <span className="cursor-pointer hover:text-[#00B5B5]" onClick={() => router.push('/dashboard')}>Kokpit</span> <ChevronRight size={14} />
          <span className="cursor-pointer hover:text-[#00B5B5]" onClick={() => router.push('/dashboard/tasks')}>Zadania</span> <ChevronRight size={14} />
          <span className="font-bold text-[#00B5B5] border-b-2 border-[#00B5B5] pb-0.5">{isNew ? 'Dodaj zadanie' : 'Edycja zadania'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* LEWA KOLUMNA */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nazwa</label>
              <input type="text" {...register('tytul', {required: true})} placeholder="Nazwa" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:border-[#00B5B5] outline-none text-sm font-semibold shadow-sm bg-white" />
            </div>

            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm bg-white">
              {/* Fake Rich Text Toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-3 text-slate-500">
                <Type size={16} className="cursor-pointer hover:text-slate-800" />
                <div className="w-px h-4 bg-slate-300"></div>
                <Bold size={16} className="cursor-pointer hover:text-slate-800" />
                <Italic size={16} className="cursor-pointer hover:text-slate-800" />
                <div className="w-px h-4 bg-slate-300"></div>
                <LinkIcon size={16} className="cursor-pointer hover:text-slate-800" />
                <ImageIcon size={16} className="cursor-pointer hover:text-slate-800" />
                <div className="w-px h-4 bg-slate-300"></div>
                <List size={16} className="cursor-pointer hover:text-slate-800" />
                <ListOrdered size={16} className="cursor-pointer hover:text-slate-800" />
                <AlignLeft size={16} className="cursor-pointer hover:text-slate-800" />
              </div>
              <textarea {...register('opis')} rows={6} className="w-full p-4 outline-none text-sm resize-none"></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Typ</label>
              <select {...register('typ_zadania')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer focus:border-[#00B5B5]">
                <option value="">Wybierz typ...</option>
                <option value="przygotowanie">Przygotowanie sprzętu</option>
                <option value="transport">Transport</option>
                <option value="montaz">Montaż / Demontaż</option>
                <option value="inne">Inne</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Szacowana potrzeba liczba osób</label>
                <input type="number" {...register('szacowana_liczba_osob')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Szacowany czas realizacji (h)</label>
                <input type="number" step="0.5" {...register('szacowany_czas_h')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Użytkownicy przypisani do zadania</label>
              {/* Uproszczony multiselect systemowy dla dema */}
              <select multiple {...register('przypisani')} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm min-h-[100px]">
                {dictionaries?.uzytkownicy?.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>{u.imie} {u.nazwisko}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Przytrzymaj CTRL (lub CMD), aby zaznaczyć wiele.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
              <select {...register('status')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                <option value="nowe">Nowe</option>
                <option value="w trakcie">W trakcie</option>
                <option value="zakończone">Zakończone</option>
              </select>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 bg-[#00B5B5] text-white px-8 py-3 rounded-lg text-sm font-bold shadow-md hover:bg-teal-400 transition w-full disabled:opacity-50">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} />} Zapisz
              </button>
            </div>
          </div>

          {/* PRAWA KOLUMNA */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Cyclic Type</label>
              <select {...register('cykl')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                <option value="">Zadanie jednorazowe...</option>
                <option value="codziennie">Codziennie</option>
                <option value="cotydzien">Co tydzień</option>
                <option value="comiesiac">Co miesiąc</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Wydarzenie</label>
                <select {...register('id_wydarzenia')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                  <option value="">Wybierz wydarzenie</option>
                  {dictionaries?.wydarzenia?.map((w: any) => <option key={w.id} value={w.id}>{w.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Klient</label>
                <select {...register('id_kontrahenta')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                  <option value="">Wybierz klienta</option>
                  {dictionaries?.kontrahenci?.map((k: any) => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Sprzęt (Egzemplarz)</label>
                <select {...register('id_egzemplarza')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                  <option value="">Wybierz sprzęt</option>
                  {dictionaries?.egzemplarze?.map((e: any) => <option key={e.id} value={e.id}>{e.nazwa} ({e.sn})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Samochód</label>
                <select {...register('id_pojazdu')} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm cursor-pointer">
                  <option value="">Wybierz samochód</option>
                  {dictionaries?.pojazdy?.map((p: any) => <option key={p.id} value={p.id}>{p.nazwa} ({p.nr_rejestracyjny})</option>)}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm mt-6">
               <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Czas trwania (Widoczne w kalendarzu)</h3>
               <div className="grid grid-cols-2 gap-5">
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1.5">Data i czas startu</label>
                   <input type="datetime-local" {...register('data_start')} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm focus:border-[#00B5B5]" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1.5">Data i czas zakończenia</label>
                   <input type="datetime-local" {...register('data_koniec')} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white shadow-sm focus:border-[#00B5B5]" />
                 </div>
               </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}