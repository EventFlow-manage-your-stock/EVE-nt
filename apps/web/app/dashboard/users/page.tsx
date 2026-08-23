'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield, Search, Mail, Phone, Briefcase, Lock } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, PageTitle, inputClass } from '../../../components/ProductUI';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/uzytkownicy').then((res) => {
      setUsers(res.data);
      setLoading(false);
    });
  }, []);

  const filtered = users.filter(u => 
    `${u.imie} ${u.nazwisko} ${u.stanowisko} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle 
        eyebrow="Ustawienia / HR" 
        title="Użytkownicy i Zespół" 
        description="Zarządzanie kontami pracowników, dostępami, stanowiskami oraz wyjątkami w dostępie."
        action={<Button onClick={() => router.push('/dashboard/users/new')}><Plus size={16} className="inline mr-1" /> Dodaj pracownika</Button>}
      />

      <Card className="!p-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-4 top-3 text-slate-400" />
          <input className={`${inputClass} pl-11 py-3`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj po nazwisku, emailu lub stanowisku..." />
        </div>
      </Card>

      {loading ? <p className="p-8 text-center font-bold text-slate-400">Ładowanie zespołu...</p> : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(u => (
            <div key={u.id} onClick={() => router.push(`/dashboard/users/${u.id}`)} className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:border-cyan-200 transition-all cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex items-start gap-4 relative z-10">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-slate-100 text-xl font-black text-slate-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  {u.imie.charAt(0)}{u.nazwisko.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 truncate group-hover:text-cyan-800 transition-colors">{u.imie} {u.nazwisko}</h3>
                  <p className="text-sm font-bold text-cyan-600 flex items-center gap-1 mt-0.5"><Briefcase size={14}/> {u.stanowisko || 'Brak stanowiska'}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Mail size={16} className="text-slate-400"/> {u.email}</div>
                {u.telefon && <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Phone size={16} className="text-slate-400"/> {u.telefon}</div>}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 relative z-10 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-slate-400"/>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Uprawnienia systemu</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.role?.map((r: any) => (
                      <span key={r.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{r.rola.nazwa}</span>
                    ))}
                    {(!u.role || u.role.length === 0) && <span className="text-xs font-bold text-rose-500">Brak przypisanych ról</span>}
                  </div>
                </div>
                {u.zablokowane_uprawnienia?.length > 0 && (
                  <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-lg shrink-0 border border-red-100" title="Użytkownik posiada ręczne blokady wyjątków do modułów">
                    <Lock size={12}/>
                    <span className="text-[10px] font-black">Wykluczeń: {u.zablokowane_uprawnienia.length}</span>
                  </div>
                )}
              </div>

              {u.umiejetnosci && (
                <div className="mt-4 pt-4 border-t border-slate-100 relative z-10">
                  <p className="text-xs font-bold text-slate-500 line-clamp-2 leading-relaxed">
                    <b className="text-slate-700">Skille:</b> {u.umiejetnosci}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}