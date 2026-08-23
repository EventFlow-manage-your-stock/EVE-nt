'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Wystąpił błąd komunikacji z serwerem.');
      setStatus('error');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 transition-colors duration-500 dark:bg-slate-950">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-[800px] w-[800px] rounded-full bg-blue-500/10 blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 h-[800px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white/60 p-10 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white mb-8 transition-colors">
          <ArrowLeft size={16} /> Powrót do logowania
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Odzyskaj dostęp</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            Podaj swój adres e-mail powiązany z kontem. Wyślemy Ci bezpieczny link umożliwiający zresetowanie hasła.
          </p>
        </div>

        {status === 'success' ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 text-center dark:bg-emerald-500/10 dark:border-emerald-500/20">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
            <p className="text-sm font-black text-emerald-800 dark:text-emerald-400">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block pl-1 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Adres e-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full rounded-2xl border border-slate-200 bg-white/50 py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-blue-500/50"
                  placeholder="kontakt@twojafirma.pl"
                />
              </div>
            </div>
            
            {status === 'error' && <p className="text-sm font-bold text-red-600 pl-1">{message}</p>}

            <button type="submit" disabled={status === 'loading'} className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg transition-all hover:bg-slate-800 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none flex justify-center items-center gap-2">
              {status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Wyślij link resetujący'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}