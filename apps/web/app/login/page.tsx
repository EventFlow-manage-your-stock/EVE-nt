'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Lock, ArrowRight, Loader2, ShieldCheck, Sparkles, User, Building, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

export default function LoginPage() {
  // Stany logiki
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDark, setIsDark] = useState(true); 
  const [mounted, setMounted] = useState(false);

  // Pola formularza
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => setMounted(true), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        passwordRaw: password,
      });
      const { access_token, user } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setAuth(response.data.access_token, response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Wystąpił błąd podczas logowania.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      // Endpoint /auth/register musi zostać odkomentowany w backendzie
      await api.post('/auth/register', {
        email,
        passwordRaw: password,
        companyName,
        firstName,
        lastName
      });
      setSuccessMsg('Konto zostało utworzone! Możesz się teraz zalogować.');
      setIsLogin(true);
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Wystąpił błąd podczas rejestracji (Upewnij się, że endpoint w API jest aktywny).');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className={`${isDark ? 'dark' : ''} selection:bg-cyan-500 selection:text-white`}>
      <div className={`relative flex flex-col min-h-screen transition-colors duration-700 overflow-hidden ${isDark ? 'bg-[#030712]' : 'bg-slate-50'}`}>
        
        {/* TŁO - Liquid Glass / Ambient Orbs */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
           <motion.div 
             animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
             transition={{ duration: 40, repeat: Infinity, ease: "linear" }} 
             className={`absolute -top-1/4 -left-1/4 h-[60vw] w-[60vw] rounded-full blur-[150px] transition-colors duration-1000 ${isDark ? 'bg-cyan-600/20 mix-blend-screen' : 'bg-cyan-400/20 mix-blend-multiply'}`}
           />
           <motion.div 
             animate={{ rotate: -360, scale: [1, 1.2, 1] }} 
             transition={{ duration: 50, repeat: Infinity, ease: "linear" }} 
             className={`absolute -bottom-1/4 -right-1/4 h-[50vw] w-[50vw] rounded-full blur-[120px] transition-colors duration-1000 ${isDark ? 'bg-blue-700/20 mix-blend-screen' : 'bg-blue-500/20 mix-blend-multiply'}`}
           />
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
        </div>

        {/* HEADER */}
        <header className="relative z-20 flex-shrink-0">
          <div className="max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <img src="/eventflow-mark.svg" alt="EventFlow" className="h-8 w-8 transition-transform group-hover:scale-110" onError={(e) => e.currentTarget.style.display = 'none'} />
              <span className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Event<span className="text-cyan-500">Flow</span></span>
            </Link>
            
            {/* Przełącznik motywu */}
            <button 
              onClick={() => setIsDark(!isDark)} 
              className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 ${
                isDark 
                  ? 'bg-slate-800/50 text-slate-400 border border-white/10 hover:bg-slate-700 hover:text-amber-400' 
                  : 'bg-white/80 text-slate-500 border border-slate-200/50 hover:bg-white hover:text-slate-900'
              }`}
              title="Przełącz motyw"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDark ? 'dark' : 'light'}
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </header>

        {/* GŁÓWNA ZAWARTOŚĆ */}
        <main className="relative z-10 flex-1 flex items-center justify-center p-6">
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`w-full max-w-md rounded-[2.5rem] border p-8 sm:p-10 shadow-2xl backdrop-blur-2xl transition-colors duration-500 overflow-hidden ${
              isDark 
                ? 'bg-slate-900/60 border-white/10 shadow-[0_0_80px_rgba(6,182,212,0.15)]' 
                : 'bg-white/70 border-slate-200/50 shadow-[0_0_80px_rgba(6,182,212,0.1)]'
            }`}
          >
            {/* Przełącznik Logowanie / Rejestracja */}
            <div className={`flex p-1 rounded-2xl mb-8 ${isDark ? 'bg-black/40' : 'bg-slate-200/50'}`}>
              <button 
                onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${isLogin ? (isDark ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-900 shadow-sm') : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
              >
                Logowanie
              </button>
              <button 
                onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${!isLogin ? (isDark ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-900 shadow-sm') : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
              >
                Rejestracja
              </button>
            </div>

            <div className="mb-8 text-center">
              <h1 className={`text-3xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isLogin ? 'Witaj z powrotem.' : 'Zacznij z EventFlow.'}
              </h1>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isLogin ? 'Zaloguj się, aby zarządzać wydarzeniami.' : 'Utwórz konto, aby rozpocząć darmowy test.'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.form 
                key={isLogin ? 'login' : 'register'}
                layout
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={isLogin ? handleLogin : handleRegister} 
                className="space-y-4"
              >
                {/* WSPÓLNE POLA - EMAIL I HASŁO */}
                <div className="space-y-4">
                  
                  {/* POLA TYLKO DLA REJESTRACJI */}
                  {!isLogin && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`block pl-1 text-[13px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Imię</label>
                          <div className="relative">
                            <User size={18} className={`absolute left-4 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              required
                              className={`block w-full rounded-2xl border p-3.5 pl-11 text-sm shadow-sm outline-none transition-all duration-300 ${isDark ? 'bg-black/20 border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50' : 'bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'}`}
                              placeholder="Jan"
                            />
                          </div>
                        </div>
                        <div>
                          <label className={`block pl-1 text-[13px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nazwisko</label>
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            className={`block w-full rounded-2xl border p-3.5 text-sm shadow-sm outline-none transition-all duration-300 ${isDark ? 'bg-black/20 border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50' : 'bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'}`}
                            placeholder="Kowalski"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`block pl-1 text-[13px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nazwa firmy</label>
                        <div className="relative">
                          <Building size={18} className={`absolute left-4 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            className={`block w-full rounded-2xl border p-3.5 pl-11 text-sm shadow-sm outline-none transition-all duration-300 ${isDark ? 'bg-black/20 border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50' : 'bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'}`}
                            placeholder="Stage Tech Sp. z o.o."
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className={`block pl-1 text-[13px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Adres e-mail
                    </label>
                    <div className="relative">
                      <Mail size={18} className={`absolute left-4 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={`block w-full rounded-2xl border p-3.5 pl-11 text-sm shadow-sm outline-none transition-all duration-300 ${
                          isDark 
                            ? 'bg-black/20 border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:bg-black/40' 
                            : 'bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:bg-white'
                        }`}
                        placeholder="kontakt@twojafirma.pl"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center pl-1 mb-1.5">
                      <label className={`text-[13px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Hasło
                      </label>
                      {isLogin && (
                        <a href="#" className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors">
                          Zapomniałeś?
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={18} className={`absolute left-4 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`block w-full rounded-2xl border p-3.5 pl-11 text-sm shadow-sm outline-none transition-all duration-300 ${
                          isDark 
                            ? 'bg-black/20 border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:bg-black/40' 
                            : 'bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:bg-white'
                        }`}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`overflow-hidden rounded-2xl border p-4 text-sm font-bold mt-4 ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}
                    >
                      {error}
                    </motion.div>
                  )}
                  {successMsg && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`overflow-hidden rounded-2xl border p-4 text-sm font-bold mt-4 ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}
                    >
                      {successMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 p-4 text-sm font-black text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <><Loader2 size={18} className="animate-spin" /> {isLogin ? 'Uwierzytelnianie...' : 'Tworzenie konta...'}</>
                    ) : (
                      <>{isLogin ? 'Zaloguj się' : 'Utwórz konto'} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>
                    )}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 bg-white mix-blend-overlay transition-opacity"></div>
                  </button>
                </div>
                <div className="mt-6 text-center">
                  <Link href="/forgot-password" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                    Zapomniałeś hasła?
                  </Link>
                </div>
              </motion.form>
            </AnimatePresence>

            {/* Informacje systemowe */}
            <motion.div layout className={`mt-10 pt-6 border-t flex flex-col items-center gap-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <ShieldCheck size={14} className="text-emerald-500" /> Połączenie szyfrowane i bezpieczne
              </div>
              <div className={`flex items-center gap-2 text-[11px] font-semibold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                <Sparkles size={12} className="text-cyan-600" /> Wersja 2.0 Enterprise
              </div>
            </motion.div>

          </motion.div>
        </main>

        {/* FOOTER */}
        <footer className="relative z-20 flex-shrink-0">
          <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              &copy; {new Date().getFullYear()} EventFlow. Wszelkie prawa zastrzeżone.
            </p>
            <div className={`flex items-center gap-6 text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <Link href="#" className="hover:text-cyan-500 transition-colors">Regulamin</Link>
              <Link href="#" className="hover:text-cyan-500 transition-colors">Polityka Prywatności</Link>
              <Link href="#" className="hover:text-cyan-500 transition-colors">Kontakt</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}