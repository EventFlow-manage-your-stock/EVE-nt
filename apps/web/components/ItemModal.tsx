'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Save, Loader2, Bold, Italic, Strikethrough, Link as LinkIcon, List, ListOrdered, AlertTriangle, Box, Info, Tag, Wrench, FileText } from 'lucide-react';
import { api } from '../lib/api';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  modelId: number;
  modelName: string;
  initialData?: any | null; 
}

export default function ItemModal({ isOpen, onClose, onSuccess, modelId, modelName, initialData }: ItemModalProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm();
  const [magazyny, setMagazyny] = useState<any[]>([]);
  const [dostepneCase, setDostepneCase] = useState<any[]>([]);
  const [statusySerwisowe, setStatusySerwisowe] = useState<any[]>([]);
  const isEdit = !!initialData;

  const watchStatus = watch('status_serwisowy');
  const watchTworzZgloszenie = watch('tworz_zgloszenie');

  useEffect(() => {
    if (isOpen) {
      fetchDictionaries();
      if (initialData) {
        reset({
          ...initialData,
          data_produkcji: initialData.data_produkcji ? initialData.data_produkcji.split('T')[0] : '',
          tworz_zgloszenie: false // Domyślnie wyłączone przy edycji
        });
      } else {
        reset({ nazwa: modelName, status_serwisowy: 'Działa', pakowany_pojedynczo: false, tworz_zgloszenie: false });
      }
    }
  }, [isOpen, initialData, modelName]);

  // Automatyczne włączenie checkboxa "Utwórz zgłoszenie", gdy psujemy sprzęt
  useEffect(() => {
    const isBadStatus = !['Działa', 'Naprawiony', ''].includes(watchStatus);
    const wasBadStatus = !['Działa', 'Naprawiony', ''].includes(initialData?.status_serwisowy || 'Działa');
    
    // Zaznacz automatycznie tylko, jeśli wcześniej sprzęt działał, a teraz nie działa
    if (isBadStatus && !wasBadStatus) {
      setValue('tworz_zgloszenie', true);
    } else if (!isBadStatus) {
      setValue('tworz_zgloszenie', false);
    }
  }, [watchStatus]);

  const fetchDictionaries = async () => {
    try {
      const [magazynyRes, casesRes, statusyRes] = await Promise.all([
        api.get('/api/magazyn/slowniki/magazyny'),
        api.get('/api/magazyn/slowniki/cases'),
        api.get('/api/serwis/statusy') 
      ]);
      setMagazyny(magazynyRes.data);
      setDostepneCase(casesRes.data);
      setStatusySerwisowe(statusyRes.data);
    } catch (error) {
      console.error('Błąd pobierania słowników:', error);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      const cleanNumber = (val: any) => (val === "" || val === undefined || val === null) ? null : Number(val);
      const cleanString = (val: any) => (val === "" || val === undefined || val === null) ? null : String(val);

      const payload = {
        ...data,
        id_magazynu: cleanNumber(data.id_magazynu),
        id_case: cleanNumber(data.id_case),
        cena_zakupu: cleanNumber(data.cena_zakupu),
        wartosc: cleanNumber(data.wartosc),
        szerokosc: cleanNumber(data.szerokosc),
        wysokosc: cleanNumber(data.wysokosc),
        glebokosc: cleanNumber(data.glebokosc),
        objetosc: cleanNumber(data.objetosc),
        waga: cleanNumber(data.waga),
        data_produkcji: data.data_produkcji ? new Date(data.data_produkcji).toISOString() : null,
        pakowany_pojedynczo: !!data.pakowany_pojedynczo,
        nazwa: cleanString(data.nazwa) || modelName,
        numer_urzadzenia: cleanString(data.numer_urzadzenia),
        sn: cleanString(data.sn),
        miejsce_w_mag: cleanString(data.miejsce_w_mag),
        opis: cleanString(data.opis),
        notatki_wewnetrzne: cleanString(data.notatki_wewnetrzne),
        status_serwisowy: cleanString(data.status_serwisowy) || 'Działa',
        kod_kreskowy: cleanString(data.kod_kreskowy),
        qr_kod: cleanString(data.qr_kod),
        
        tworz_zgloszenie: !!data.tworz_zgloszenie,
        tytul_usterki: cleanString(data.tytul_usterki),
        id_statusu_serwisu: cleanNumber(data.id_statusu_serwisu),
        opis_usterki: cleanString(data.opis_usterki)
      };

      if (isEdit) {
        await api.put(`/api/magazyn/egzemplarze/${initialData.id}`, payload);
      } else {
        await api.post(`/api/magazyn/modele/${modelId}/egzemplarze`, payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Błąd zapisu egzemplarza:', error);
      alert('Nie udało się zapisać egzemplarza. Upewnij się, że poprawnie wypełniono wszystkie pola.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-slate-50 flex flex-col rounded-2xl shadow-2xl z-10 animate-fade-in-up overflow-hidden">
        
        {/* HEADER MODALA */}
        <div className="flex shrink-0 items-center justify-between p-5 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {isEdit ? 'Edycja egzemplarza' : 'Dodaj nowy egzemplarz'}
            </h2>
            <p className="text-sm font-semibold text-slate-400 mt-0.5">{modelName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* BODY (SCROLLOWANE) */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* KOLUMNA 1: PODSTAWY */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <Info size={16} className="text-sky-500"/> Identyfikacja
                </h3>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Nazwa własna (opcjonalnie)</label>
                  <input type="text" {...register('nazwa')} placeholder={modelName} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-sky-500 outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Numer urządzenia (np. 1, A)</label>
                  <input type="text" {...register('numer_urzadzenia')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-sky-500 outline-none text-sm bg-sky-50/30 font-bold" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Numer seryjny (SN)</label>
                  <input type="text" {...register('sn')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-sky-500 outline-none text-sm font-mono bg-sky-50/30" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Data produkcji</label>
                  <input type="date" {...register('data_produkcji')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-sky-500 outline-none text-sm text-slate-700 bg-white" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <Tag size={16} className="text-emerald-500"/> Znakowanie i Wycena
                </h3>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Zewnętrzny Kod Kreskowy</label>
                  <input type="text" {...register('kod_kreskowy')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none text-sm font-mono bg-white" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Zewnętrzny QR Kod</label>
                  <input type="text" {...register('qr_kod')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none text-sm font-mono bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Cena zakupu</label>
                    <input type="number" step="0.01" {...register('cena_zakupu')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Wartość obecna</label>
                    <input type="number" step="0.01" {...register('wartosc')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* KOLUMNA 2: LOKALIZACJA I WYMIARY */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <Box size={16} className="text-indigo-500"/> Logistyka i Magazyn
                </h3>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Magazyn docelowy</label>
                  <select {...register('id_magazynu')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none text-sm bg-white cursor-pointer">
                    <option value="">Wybierz magazyn...</option>
                    {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Miejsce w magazynie</label>
                  <input type="text" {...register('miejsce_w_mag')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none text-sm bg-white uppercase" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-indigo-600 mb-1.5">Przypisz Case / Zestaw</label>
                  <select {...register('id_case')} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none text-sm bg-indigo-50/30 cursor-pointer font-medium">
                    <option value="">Luzem (Brak skrzyni)</option>
                    {dostepneCase.filter(c => c.id !== initialData?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.model?.nazwa} {c.numer_urzadzenia ? `[#${c.numer_urzadzenia}]` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <input type="checkbox" id="pakowany" {...register('pakowany_pojedynczo')} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  <label htmlFor="pakowany" className="text-[13px] font-bold text-slate-700 cursor-pointer select-none">Pakowany pojedynczo na regale</label>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  Wymiary własne (Opcjonalne)
                </h3>
                <p className="text-[10px] text-slate-400 mb-2 leading-tight">Wypełnij tylko wtedy, gdy ten konkretny egzemplarz różni się gabarytami od domyślnych wymiarów modelu głównego.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Szerokość [cm]</label>
                    <input type="number" step="0.01" {...register('szerokosc')} className="w-full px-3 py-1.5 border border-slate-300 rounded-md outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Wysokość [cm]</label>
                    <input type="number" step="0.01" {...register('wysokosc')} className="w-full px-3 py-1.5 border border-slate-300 rounded-md outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Głębokość [cm]</label>
                    <input type="number" step="0.01" {...register('glebokosc')} className="w-full px-3 py-1.5 border border-slate-300 rounded-md outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Objętość [m³]</label>
                    <input type="number" step="0.01" {...register('objetosc')} className="w-full px-3 py-1.5 border border-slate-300 rounded-md outline-none text-sm bg-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Waga całkowita [kg]</label>
                    <input type="number" step="0.01" {...register('waga')} className="w-full px-3 py-1.5 border border-slate-300 rounded-md outline-none text-sm bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* KOLUMNA 3: NOTATKI I SERWIS */}
            <div className="space-y-6 flex flex-col">
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex-1">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                  <FileText size={16} className="text-amber-500"/> Notatki i Uwagi
                </h3>
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex-1">
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Opis zewnętrzny (usterkowy, widoczny w WMS)</label>
                    <textarea {...register('opis')} rows={3} placeholder="np. Rysa na matrycy" className="w-full p-3 text-sm border border-slate-300 rounded-lg outline-none focus:border-amber-500 resize-none bg-white" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Notatki wewnętrzne (ukryte)</label>
                    <textarea {...register('notatki_wewnetrzne')} rows={3} placeholder="Twoje tajne uwagi do sprzętu..." className="w-full p-3 text-sm border border-slate-300 rounded-lg outline-none focus:border-amber-500 resize-none bg-slate-50" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* DEDYKOWANY, SZEROKI BLOK SERWISOWY NA DOLE */}
          <div className={`mt-6 border-2 rounded-xl p-6 transition-all duration-300 shadow-sm ${watchStatus !== 'Działa' && watchStatus !== 'Naprawiony' ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-200'}`}>
             <h3 className="text-[15px] font-black text-slate-800 flex items-center gap-2 mb-4">
                <Wrench size={18} className={watchStatus !== 'Działa' && watchStatus !== 'Naprawiony' ? 'text-red-500' : 'text-slate-400'}/> 
                Status i Serwis
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="md:col-span-1">
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Obecna kondycja sprzętu</label>
                  <select {...register('status_serwisowy')} className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg focus:border-red-500 outline-none text-sm bg-white cursor-pointer font-bold shadow-sm">
                    <option value="Działa" className="text-emerald-700">🟢 Działa</option>
                    <option value="Wymaga serwisu (działa)" className="text-amber-600">🟡 Wymaga serwisu (działa)</option>
                    <option value="Wymaga serwisu (nie działa)" className="text-red-600">🔴 Wymaga serwisu (nie działa)</option>
                    <option value="W serwisie" className="text-sky-600">🔵 W serwisie</option>
                    <option value="Naprawiony" className="text-emerald-600">🟢 Naprawiony</option>
                  </select>
                </div>
                
                <div className="md:col-span-3 flex items-center h-full pb-2">
                  <label className="flex items-center gap-3 cursor-pointer group bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
                    <input type="checkbox" {...register('tworz_zgloszenie')} className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                    <span className="text-[13px] font-bold text-slate-700 group-hover:text-red-700 select-none">
                      Wygeneruj od razu formalne zgłoszenie do modułu Serwisu
                    </span>
                  </label>
                </div>
             </div>

             {/* ROZWIJANY FORMULARZ ZGŁOSZENIA */}
             {watchTworzZgloszenie && (
               <div className="mt-5 pt-5 border-t border-red-200/50 grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in-up">
                 <div className="md:col-span-1">
                   <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Kolejka / Priorytet *</label>
                   <select {...register('id_statusu_serwisu')} required={watchTworzZgloszenie} className="w-full px-3 py-2 border border-red-300 rounded-lg focus:border-red-500 outline-none text-sm bg-white cursor-pointer font-semibold shadow-sm">
                     <option value="">Wybierz priorytet...</option>
                     {statusySerwisowe.length > 0 ? (
                       statusySerwisowe.map(s => <option key={s.id} value={s.id}>{s.nazwa}</option>)
                     ) : (
                       <option value="" disabled>Brak zdefiniowanych statusów w bazie!</option>
                     )}
                   </select>
                   {statusySerwisowe.length === 0 && <p className="text-[10px] text-red-500 mt-1 font-bold">Zgłoś to administratorowi.</p>}
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Krótki tytuł usterki *</label>
                   <input type="text" {...register('tytul_usterki')} required={watchTworzZgloszenie} placeholder="np. Przepalona dioda LED" className="w-full px-3 py-2 border border-red-300 rounded-lg focus:border-red-500 outline-none text-sm bg-white shadow-sm" />
                 </div>
                 <div className="md:col-span-3">
                   <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Wiadomość dla serwisanta (okoliczności powstania) *</label>
                   <textarea {...register('opis_usterki')} required={watchTworzZgloszenie} rows={2} placeholder="Opisz dokładnie, w którym momencie sprzęt przestał działać..." className="w-full px-3 py-2 border border-red-300 rounded-lg focus:border-red-500 outline-none text-sm bg-white resize-none shadow-sm" />
                 </div>
               </div>
             )}
          </div>
        </form>

        {/* FOOTER */}
        <div className="shrink-0 flex justify-end gap-3 p-5 border-t border-slate-200 bg-white">
          <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition shadow-sm">
            Anuluj
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-8 py-2.5 text-[13px] font-bold text-white bg-[#00B5B5] border border-teal-500 rounded-lg hover:bg-teal-400 transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16}/>}
            {isEdit ? 'Zapisz zmiany egzemplarza' : 'Utwórz nowy egzemplarz'}
          </button>
        </div>
      </div>
    </div>
  );
}