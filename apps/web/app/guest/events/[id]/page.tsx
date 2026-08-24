'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Phone, Mail, User, AlertTriangle, LogIn, Loader2, Sun, Moon, Building2, UserCircle } from 'lucide-react';
import Image from 'next/image';
import { api } from '../../../../lib/api';

function dateTime(v: any) { 
  return v ? new Date(v).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; 
}

function GuestEventContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Stan odpowiadający za tryb ciemny
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Automatyczne wykrycie trybu ciemnego systemu użytkownika przy pierwszym załadowaniu
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
    
    const token = searchParams?.get('token');
    if (!token) {
      setError('Brak bezpiecznego tokenu w adresie. Użyj oryginalnego linku z e-maila.');
      setLoading(false);
      return;
    }

    api.get(`/api/wydarzenia/guest/${params.id}?token=${encodeURIComponent(token)}`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Brak dostępu lub wydarzenie nie istnieje.'))
      .finally(() => setLoading(false));
  }, [params.id, searchParams]);

  // Efekt wymuszający klasę dark na poziomie tagu HTML,
  // by upewnić się, że Tailwind prawidłowo załaduje style pomimo braku głównego layout.tsx
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (loading) return (
     <div className={`flex h-screen items-center justify-center transition-colors duration-300 ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
       <Loader2 className="animate-spin text-cyan-600 w-12 h-12" />
     </div>
  );

  if (error) return (
    <div className={isDark ? 'dark' : ''}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-[#02080a] p-6 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 p-8 rounded-3xl max-w-md text-center shadow-xl">
           <AlertTriangle className="text-red-500 w-16 h-16 mx-auto mb-4" />
           <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Odmowa dostępu</h1>
           <p className="text-slate-500 dark:text-slate-400 mb-8">{error}</p>
           <button onClick={() => router.push('/login')} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-6 py-3.5 rounded-xl w-full hover:scale-[1.02] transition">Przejdź do logowania</button>
        </div>
      </div>
    </div>
  );

  const event = data.wydarzenie;
  const user = data.uzytkownik;
  const role = data.rola;
  const mapsLink = event.adres ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.adres)}` : null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#02080a] text-slate-900 dark:text-slate-100 font-sans pb-24 transition-colors duration-300">
         {/* Górna Belka (Topbar) */}
         <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors duration-300">
           <div className="flex items-center gap-3">
             <Image src="/eve_nt_with_symbol_transparent.png" alt="Logo" width={120} height={32} className="dark:hidden" />
             <Image src="/eve_nt_primary_with_symbol_reverse_transparent.png" alt="Logo" width={120} height={32} className="hidden dark:block" />
           </div>
           
           <div className="flex items-center gap-3">
             {/* Przełącznik Dark Mode */}
             <button 
               onClick={() => setIsDark(!isDark)} 
               className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
               title="Zmień motyw"
             >
               {isDark ? <Sun size={18} /> : <Moon size={18} />}
             </button>
             
             {/* Przycisk przejścia do edytora */}
             <button onClick={() => router.push(`/dashboard/events/${event.id}`)} className="flex items-center gap-2 text-sm font-bold bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-4 py-2.5 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition">
               <LogIn size={16} /> <span className="hidden sm:block">Zaloguj i przejdź do systemu</span> <span className="sm:hidden">System</span>
             </button>
           </div>
         </header>

         <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
           {/* Przywitanie */}
           <div className="mb-8">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Informacje dla ekipy</p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Witaj, {user?.imie}!</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300 text-lg font-medium leading-relaxed">Poniżej znajdziesz podsumowanie wydarzenia, do którego zostałeś przypisany.</p>
           </div>

           {/* Rola Card */}
           <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-cyan-900/20">
              <p className="text-cyan-100 text-xs font-black uppercase tracking-widest mb-1.5">Twoja funkcja na wyjeździe</p>
              <div className="flex items-center gap-3">
                <User className="w-8 h-8 text-cyan-200" />
                <p className="text-2xl font-black">{role || 'Obsługa techniczna'}</p>
              </div>
           </div>

           {/* Karta Wydarzenia */}
           <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 sm:p-8 shadow-sm">
              <div className="inline-block px-3 py-1.5 rounded-full text-[11px] font-black text-white mb-4 uppercase tracking-widest" style={{ backgroundColor: event.kolor }}>
                {event.typ || 'Wydarzenie'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-8 leading-tight">{event.nazwa}</h2>

              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                 <div className="flex items-start gap-4">
                   <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-2xl text-cyan-600 dark:text-cyan-400 shrink-0"><Calendar size={20} /></div>
                   <div>
                     <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Ramy czasowe</p>
                     <p className="font-bold text-sm text-slate-900 dark:text-white">{dateTime(event.data_start)}</p>
                     <p className="font-bold text-sm text-slate-500 dark:text-slate-400">do {dateTime(event.data_koniec)}</p>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-2xl text-cyan-600 dark:text-cyan-400 shrink-0"><Building2 size={20} /></div>
                   <div className="min-w-0">
                     <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Dla kogo (Klient)</p>
                     <p className="font-bold text-sm text-slate-900 dark:text-white ">{event.klient || 'Zlecenie wewnętrzne / Brak'}</p>
                     {event.osoba_kontaktowa && (
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          <p className="font-bold flex items-center gap-1.5 truncate"><UserCircle size={12} className="shrink-0"/> {event.osoba_kontaktowa.imie_nazwisko}</p>
                          {event.osoba_kontaktowa.telefon && <p className="mt-0.5"><a href={`tel:${event.osoba_kontaktowa.telefon}`} className="hover:text-cyan-500 transition">{event.osoba_kontaktowa.telefon}</a></p>}
                        </div>
                     )}
                   </div>
                 </div>
              </div>

              {/* LOKALIZACJA Z MAPĄ GOOGLE */}
              <div className="border-t border-slate-100 dark:border-white/10 pt-6">
                <div className="flex items-start gap-4 mb-4">
                   <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-2xl text-cyan-600 dark:text-cyan-400 shrink-0"><MapPin size={20} /></div>
                   <div>
                     <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Lokalizacja zlecenia</p>
                     <p className="font-bold text-sm text-slate-900 dark:text-white">{event.miejsce || 'Brak lokalizacji'}</p>
                     {event.adres && <p className="text-xs font-semibold text-slate-500 mt-0.5">{event.adres}</p>}
                     {mapsLink && <a href={mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 mt-2 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-1.5 rounded-lg transition">Pokaż trasę i nawigację &rarr;</a>}
                   </div>
                </div>

                {/* Mapa (IFrame) */}
                {event.adresMapy && (
                  <div className="w-full h-64 sm:h-80 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner mt-4 relative">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ 
                        border: 0, 
                        // Trick z invertowaniem kolorów mapy Google dla fajnego efektu w Dark Mode
                        filter: isDark ? 'invert(90%) hue-rotate(180deg) brightness(85%) contrast(85%)' : 'none' 
                      }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(event.adresMapy)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                  </div>
                )}
              </div>

              {event.opis && (
                <div className="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5 mt-6">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Wytyczne i Brief Eventowy</p>
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{event.opis}</p>
                </div>
              )}
           </div>

           {/* Oś Czasu / Etapy (Timeline) */}
           <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 sm:p-8 shadow-sm">
              <h3 className="text-xl font-black mb-6">Twój Harmonogram prac</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Niebieskim kolorem zaznaczono etapy, w których przypisano Cię do ekipy. Zwróć uwagę na dokładne godziny operacyjne.</p>
              
              {event.etapy && event.etapy.length > 0 ? (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6 pb-2">
                  {event.etapy.map((etap: any) => (
                    <div key={etap.id} className="relative pl-6">
                      {/* Wskaźnik osi czasu */}
                      <div className={`absolute -left-[11px] top-1.5 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 ${etap.przypisany ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                      
                      <div className={`p-5 rounded-2xl border transition-all duration-300 ${etap.przypisany ? 'border-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 shadow-md ring-1 ring-cyan-100 dark:ring-transparent' : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 opacity-80'}`}>
                         <div className="flex items-center justify-between mb-1.5">
                           <h4 className={`font-black text-base ${etap.przypisany ? 'text-cyan-900 dark:text-cyan-100' : 'text-slate-700 dark:text-slate-300'}`}>{etap.nazwa}</h4>
                           {etap.przypisany && <span className="bg-cyan-600 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest shadow-sm">Oczekiwana obecność</span>}
                         </div>
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-2">
                           <Clock size={13} className={etap.przypisany ? 'text-cyan-600' : ''} /> {dateTime(etap.data_start)} &rarr; {dateTime(etap.data_koniec)}
                         </p>
                         {etap.opis && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{etap.opis}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-400 text-center py-6 border border-dashed rounded-2xl border-slate-200 dark:border-white/10">Brak zdefiniowanych etapów harmonogramu.</p>
              )}
           </div>

           {/* Kontakty */}
           {event.managerowie && event.managerowie.length > 0 && (
             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 sm:p-8 shadow-sm">
               <h3 className="text-xl font-black mb-5">Nadzór i Kontakt na miejscu</h3>
               <div className="grid sm:grid-cols-2 gap-4">
                 {event.managerowie.map((m: any, idx: number) => (
                   <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <div className="w-12 h-12 bg-white dark:bg-white/10 border border-slate-200 dark:border-transparent rounded-full flex items-center justify-center font-black text-slate-600 dark:text-white shrink-0 shadow-sm">
                        {m.imie?.[0]}{m.nazwisko?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-slate-900 dark:text-white truncate">{m.imie} {m.nazwisko}</p>
                        <div className="mt-1 space-y-1">
                          {m.telefon && <a href={`tel:${m.telefon}`} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-cyan-600"><Phone size={12} /> {m.telefon}</a>}
                          {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-cyan-600 truncate"><Mail size={12} /> {m.email}</a>}
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
         </main>
      </div>
    </div>
  );
}

// Wrapper Suspense to wymóg Next.js przy używaniu hooków pobierających dane z Query stringa
export default function GuestPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-cyan-600 w-12 h-12" /></div>}>
      <GuestEventContent />
    </Suspense>
  );
}