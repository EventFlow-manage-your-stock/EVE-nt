'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Mail, UserCircle, Phone, KeyRound, Clock, Plane, ShieldCheck, Loader2, ImagePlus } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPass, setSendingPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  async function loadProfile() {
    try {
      const res = await api.get('/api/ustawienia/profil');
      const data = res.data;
      setProfile(data);
      setForm({
        imie: data.imie || '',
        nazwisko: data.nazwisko || '',
        telefon: data.telefon || ''
      });

      // Zoptymalizowany backend zwraca teraz gotowy, podpisany URL do obrazu na S3 (wygasajacy)
      setAvatarUrl(data.avatarUrl || null);
    } catch (err: any) {
      setError('Nie udało się wczytać profilu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Lokalny render dla natychmiastowego efektu przed zapisem
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function submit(e: any) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const formData = new FormData();
      formData.append('imie', form.imie);
      formData.append('nazwisko', form.nazwisko);
      formData.append('telefon', form.telefon || '');
      
      // Jeśli użytkownik wybrał nowy plik, dołączamy go do paczki
      if (file) {
        formData.append('avatar', file);
      }

      // KLUCZOWA ZMIANA: Wymuszenie nagłówka multipart/form-data
      await api.put('/api/ustawienia/profil', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setSuccess('Twój profil został pomyślnie zaktualizowany.');
      
      // Czyścimy stany pliku, aby odświeżenie załadowało nowy wygasający URL S3 z serwera
      setFile(null);
      setPreview('');
      
      await loadProfile(); 
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!confirm('Na adres e-mail przypisany do konta zostanie wysłany link umożliwiający zresetowanie hasła. Czy na pewno kontynuować?')) return;
    setSendingPass(true);
    setError(''); setSuccess('');
    try {
      await api.post('/api/auth/reset-password-request', { email: profile?.email });
      setSuccess('Wysłano dyspozycję zmiany hasła. Sprawdź swoją skrzynkę e-mail.');
    } catch (err: any) {
      setError('Ten moduł e-mail nie został jeszcze uruchomiony z powodu ustawień SMTP (DevMode)');
    } finally {
      setSendingPass(false);
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-cyan-600 w-10 h-10" /></div>;
  if (!profile) return <div className="text-center p-12 text-slate-400 font-bold">Konto niedostępne.</div>;

  const userRoles = profile.role?.map((r: any) => r.rola?.nazwa) || [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageTitle 
        eyebrow="Ustawienia / Twój Profil" 
        title="Ustawienia Twojego Konta" 
        description="Tutaj możesz zmienić swoje dane kontaktowe, dostosować avatar oraz zweryfikować swoje uprawnienia dostępowe." 
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.6fr]">
        <Card className="flex flex-col h-full">
          <form onSubmit={submit} className="flex-1 flex flex-col">
            <div className="mb-6 flex items-start gap-5 border-b border-slate-100 dark:border-white/5 pb-6">
               <label className="relative group cursor-pointer block shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 dark:border-white/10 shadow-sm bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300">
                    {preview || avatarUrl ? (
                       <img src={preview || avatarUrl || ''} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                       <UserCircle size={48} strokeWidth={1} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-slate-900/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                     <ImagePlus size={20} className="mb-1"/>
                     <span className="text-[9px] font-black uppercase">Zmień</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
               </label>
               <div className="pt-2 min-w-0">
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white truncate">{profile.imie} {profile.nazwisko}</h2>
                 <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mt-1 truncate">{profile.stanowisko || 'Pracownik platformy'}</p>
                 <p className="text-xs font-bold text-slate-500 mt-0.5 truncate">{profile.email}</p>
               </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 flex-1">
              <Field label="Imię">
                <input className={inputClass} required value={form.imie} onChange={(e) => setForm({...form, imie: e.target.value})} />
              </Field>
              <Field label="Nazwisko">
                <input className={inputClass} required value={form.nazwisko} onChange={(e) => setForm({...form, nazwisko: e.target.value})} />
              </Field>
              <Field label="Numer telefonu">
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="tel" className={`${inputClass} pl-10`} value={form.telefon || ''} onChange={(e) => setForm({...form, telefon: e.target.value})} placeholder="Opcjonalny..." />
                </div>
              </Field>
              <Field label="Adres e-mail konta (Tylko do odczytu)">
                <div className="relative opacity-60 pointer-events-none">
                  <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="email" className={`${inputClass} pl-10`} readOnly value={profile.email} />
                </div>
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
               <Button type="submit" disabled={saving}>
                 <Save size={16} className="inline mr-2" />
                 {saving ? 'Zapisywanie profilu...' : 'Zapisz moje dane'}
               </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="font-black text-lg text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">Organizacja i Uprawnienia</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Twoje środowisko pracy</p>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black">
                     {profile.organizacja?.nazwa?.charAt(0) || 'O'}
                   </div>
                   <div>
                     <p className="text-sm font-black text-slate-900 dark:text-white">{profile.organizacja?.nazwa}</p>
                     <p className="text-[11px] font-bold text-slate-500">Abonament: {profile.organizacja?.plan_abonamentu || 'Pro'}</p>
                   </div>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Role i uprawnienia z grupy</p>
                <div className="flex flex-wrap gap-2">
                  {userRoles.length > 0 ? userRoles.map((rola: string, i: number) => (
                    <span key={i} className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck size={14}/> {rola}
                    </span>
                  )) : (
                    <span className="text-xs font-bold text-slate-500">Brak określonej roli (Widok Domyślny)</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-black text-lg text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">Bezpieczeństwo i Sesja</h3>
            <div className="space-y-4">
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Ostatnie pomyślne logowanie</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {profile.data_ostatniego_logowania 
                      ? new Date(profile.data_ostatniego_logowania).toLocaleString('pl-PL') 
                      : 'To jest pierwsze logowanie!'}
                  </p>
               </div>
               <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                  <Button variant="secondary" onClick={sendPasswordReset} disabled={sendingPass}>
                    {sendingPass ? <Loader2 size={16} className="animate-spin inline mr-1"/> : <KeyRound size={16} className="inline mr-2 text-cyan-600"/>} 
                    Wyślij link do resetowania hasła
                  </Button>
               </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-transparent">
             <div className="flex items-center gap-3 mb-3">
               <Plane size={24} className="opacity-80"/>
               <h3 className="font-black text-lg">Potrzebujesz urlopu?</h3>
             </div>
             <p className="text-sm font-medium text-white/80 leading-relaxed mb-4">
               Szybko zgłoś swoje dni niedostępności, aby omijać Cię w procesie planowania logistyki wydarzeń.
             </p>
             <button onClick={() => router.push('/dashboard/leaves')} className="w-full bg-white text-indigo-700 font-black text-sm px-4 py-3 rounded-xl hover:bg-slate-50 transition shadow-sm">
               Przejdź do kalendarza nieobecności
             </button>
          </Card>
        </div>
      </div>
    </div>
  );
}