'use client';

import Link from 'next/link';
import { EntityEditorPage } from '../../../../../components/EntityEditorPage';
import { Building2, Users, Calendar, Truck, UserCircle, ArrowRight, History } from 'lucide-react';

const renderPowiazania = (record: any) => {
  if (!record) return null;
  const kontrahent = record.kontrahent;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {kontrahent ? (
        <>
          {/* Sekcja firmy głównej */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-4">
              <div className="rounded-xl bg-cyan-50 p-3 text-cyan-600"><Building2 size={24} /></div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Przypisana firma (Kontrahent)</p>
                <h3 className="text-xl font-black text-slate-900">{kontrahent.nazwa}</h3>
              </div>
              <Link href={`/dashboard/crm/${kontrahent.id}`} className="ml-auto flex items-center gap-2 text-sm font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-4 py-2 rounded-xl transition">
                Profil firmy <ArrowRight size={16}/>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-3"><span className="block text-xs font-bold text-slate-400">NIP</span><span className="font-black text-slate-700">{kontrahent.nip || '-'}</span></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="block text-xs font-bold text-slate-400">E-mail</span><span className="font-black text-slate-700">{kontrahent.email || '-'}</span></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="block text-xs font-bold text-slate-400">Telefon</span><span className="font-black text-slate-700">{kontrahent.telefon || '-'}</span></div>
            </div>
          </div>

          {/* Sekcja współpracowników */}
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-3 px-1">
              <Users size={16} className="text-slate-400"/> Inni współpracownicy z tej samej firmy
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {kontrahent.kontakty?.length > 0 ? kontrahent.kontakty.map((k: any) => (
                <Link key={k.id} href={`/dashboard/crm/contacts/${k.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-cyan-300 hover:shadow-md transition group">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-slate-100 p-3 text-slate-500 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition"><UserCircle size={22} /></div>
                    <div>
                      <p className="font-black text-slate-900 group-hover:text-cyan-700 transition">{k.imie} {k.nazwisko}</p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">{k.stanowisko || 'Brak stanowiska'}</p>
                      {k.glowny && <span className="inline-block mt-2 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Kontakt Główny</span>}
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400 bg-slate-50">
                  Brak innych zarejestrowanych kontaktów u tego kontrahenta.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400 bg-slate-50">
          Ten kontakt nie jest przypisany do żadnego kontrahenta w bazie. <br/>Możesz to zmienić w zakładce "Szczegóły".
        </div>
      )}
    </div>
  );
};

const renderHistoria = (record: any) => {
  if (!record) return null;
  const wydarzenia = record.wydarzenia || [];
  const wynajmy = record.wynajmy || [];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Wydarzenia */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-500"/> Projekty i Wydarzenia ({wydarzenia.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {wydarzenia.length > 0 ? wydarzenia.map((ev: any) => (
            <Link key={ev.id} href={`/dashboard/events/${ev.id}`} className="flex items-center justify-between p-4 hover:bg-emerald-50/50 transition group">
              <div>
                <p className="font-black text-slate-900 group-hover:text-emerald-700 transition">{ev.nazwa}</p>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{ev.numer || `#${ev.id}`}</p>
              </div>
              <div className="text-right">
                {ev.status && <span className="inline-block px-3 py-1 rounded-md text-[10px] font-black text-white mb-1" style={{ backgroundColor: ev.status.kolor || '#0891B2' }}>{ev.status.nazwa}</span>}
                <p className="text-xs font-bold text-slate-500 block mt-1">{ev.data_start ? new Date(ev.data_start).toLocaleDateString('pl-PL') : '-'}</p>
              </div>
            </Link>
          )) : (
            <div className="p-8 text-center text-sm font-bold text-slate-400 bg-white">Ten kontakt nie brał udziału w żadnych wydarzeniach.</div>
          )}
        </div>
      </div>

      {/* Wypożyczenia */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Truck size={18} className="text-orange-500"/> Zlecenia wynajmu sprzętu ({wynajmy.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {wynajmy.length > 0 ? wynajmy.map((wyn: any) => (
            <Link key={wyn.id} href={`/dashboard/rentals/${wyn.id}`} className="flex items-center justify-between p-4 hover:bg-orange-50/50 transition group">
              <div>
                <p className="font-black text-slate-900 group-hover:text-orange-700 transition">{wyn.numer || `Wynajem #${wyn.id}`}</p>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{wyn.nazwa || 'Wynajem standardowy'}</p>
              </div>
              <div className="text-right">
                {wyn.status && <span className="inline-block px-3 py-1 rounded-md text-[10px] font-black text-white mb-1" style={{ backgroundColor: wyn.status.kolor || '#F97316' }}>{wyn.status.nazwa}</span>}
                <p className="text-xs font-bold text-slate-500 block mt-1">{wyn.data_wydania ? new Date(wyn.data_wydania).toLocaleDateString('pl-PL') : '-'}</p>
              </div>
            </Link>
          )) : (
            <div className="p-8 text-center text-sm font-bold text-slate-400 bg-white">Ten kontakt nie był odpowiedzialny za żadne wypożyczenia.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ContactEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Kontakty CRM',
    title: 'Karta osoby kontaktowej',
    listHref: '/dashboard/crm/contacts',
    getEndpoint: (id) => `/api/crm/kontakty/${id}`,
    updateEndpoint: (id) => `/api/crm/kontakty/${id}`,
    deleteEndpoint: (id) => `/api/crm/kontakty/${id}`,
    dictionaries: { id_kontrahenta: '/api/crm/kontrahenci' },
    tabs: [
      { id: 'powiazania', label: 'Firma / Współpracownicy', icon: Building2, render: renderPowiazania },
      { id: 'historia', label: 'Historia Projektów', icon: History, render: renderHistoria },
    ],
    titleFromRecord: (r) => [r.imie, r.nazwisko].filter(Boolean).join(' ') || r.email || `Kontakt #${r.id}`,
    subtitleFromRecord: (r) => r.kontrahent?.nazwa || r.stanowisko || 'Niezależny kontakt',
    fields: [
      { key: 'id_kontrahenta', label: 'Przypisz do firmy (Kontrahent)', type: 'select' },
      { key: 'glowny', label: 'Ustaw jako kontakt główny dla firmy', type: 'checkbox' },
      { key: 'imie', label: 'Imię' },
      { key: 'nazwisko', label: 'Nazwisko' },
      { key: 'stanowisko', label: 'Stanowisko / Rola' },
      { key: 'email', label: 'Adres E-mail' },
      { key: 'telefon', label: 'Telefon główny' },
      { key: 'telefon_2', label: 'Telefon dodatkowy' },
      { key: 'notatki_wewnetrzne', label: 'Wewnętrzne notatki logistyczne', type: 'textarea' },
    ],
  }} />;
}