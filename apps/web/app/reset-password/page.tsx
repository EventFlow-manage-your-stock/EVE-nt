'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { ArrowLeft, Loader2, CheckCircle2, Lock } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Wprowadzone hasła nie są identyczne.');
      setStatus('error');
      return;
    }
    
    if (!token) {
      setMessage('Brak bezpiecznego tokenu w adresie URL. Skopiuj pełny link z e-maila.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const res = await api.post('/auth/reset-password', { token, passwordRaw: password });
      setMessage(res.data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Wystąpił błąd komunikacji z serwerem.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-8 text-center dark:bg-emerald-500/10 dark:border-emerald-500/20">
        <CheckCircle2 size={56} className="text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-emerald-800 dark:text-emerald-400 mb-2">Hasło ustawione!</h2>
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-8">{message}</p>
        <Link href="/login" className="inline-flex w-full justify-center rounded-xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg transition-all hover:bg-emerald-700 hover:-translate-y-0.5">
          Zaloguj się do systemu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block pl-1 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nowe hasło</label>
        <div className="relative">
          <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="block w-full rounded-2xl border border-slate-200 bg-white/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-cyan-500/50"
            placeholder="Minimum 8 znaków"
          />
        </div>
      </div>

      <div>
        <label className="block pl-1 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Powtórz nowe hasło</label>
        <div className="relative">
          <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="block w-full rounded-2xl border border-slate-200 bg-white/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-cyan-500/50"
            placeholder="Muszą być identyczne"
          />
        </div>
      </div>

      {status === 'error' && <p className="text-sm font-bold text-red-600 pl-1">{message}</p>}

      <button type="submit" disabled={status === 'loading'} className="w-full rounded-2xl bg-cyan-600 py-4 text-sm font-black text-white shadow-lg shadow-cyan-600/30 transition-all hover:bg-cyan-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none flex justify-center items-center gap-2">
        {status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Zapisz i aktywuj hasło'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-slate-950">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-[800px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 h-[800px] w-[800px] rounded-full bg-blue-500/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white/60 p-10 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mb-8 transition-colors">
          <ArrowLeft size={16} /> Powrót do logowania
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Utwórz nowe hasło</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            Wprowadź swoje nowe hasło poniżej. Wymagane jest wprowadzenie go dwukrotnie, aby zapobiec literówkom.
          </p>
        </div>

        <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}