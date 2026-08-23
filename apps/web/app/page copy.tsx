'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { ArrowRight, Box, CalendarCheck, ShieldCheck, Sparkles, Truck, LayoutGrid, CheckCircle2, ChevronRight, Zap, Sun, Moon } from 'lucide-react';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  // Stan motywu (Dark/Light) z odczytem z przeglądarki
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Odczyt domyślnego motywu systemu/przeglądarki
    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(matchMedia.matches);
    
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    matchMedia.addEventListener('change', listener);
    
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      matchMedia.removeEventListener('change', listener);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const smoothProgress = useSpring(scrollYProgress, { mass: 0.1, stiffness: 100, damping: 20 });

  const rotateX = useTransform(smoothProgress, [0, 0.5], [20, 0]);
  const rotateY = useTransform(smoothProgress, [0, 0.5], [-15, 0]);
  const scale = useTransform(smoothProgress, [0, 0.5], [0.8, 1]);
  const opacity = useTransform(smoothProgress, [0, 0.3], [0.5, 1]);
  const translateY = useTransform(smoothProgress, [0, 0.5], [100, 0]);

  const y1 = useTransform(smoothProgress, [0, 1], [0, -300]);
  const y2 = useTransform(smoothProgress, [0, 1], [0, 400]);

  if (!mounted) return null;

  return (
    <div className={`${isDark ? 'dark' : ''} selection:bg-cyan-500 selection:text-white`}>
      <div ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-700 dark:bg-[#030712] dark:text-slate-50 font-sans overflow-hidden perspective-[1000px]">
        
        {/* BACKGROUND LIQUID GLASS ORBS */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div style={{ y: y1 }} className={`absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] animate-pulse-slow transition-colors duration-1000 ${isDark ? 'bg-cyan-600/20 mix-blend-screen' : 'bg-cyan-400/30 mix-blend-multiply'}`} />
          <motion.div style={{ y: y2 }} className={`absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[150px] transition-colors duration-1000 ${isDark ? 'bg-blue-700/20 mix-blend-screen' : 'bg-blue-500/20 mix-blend-multiply'}`} />
          <div className={`absolute top-[20%] left-[60%] w-[30vw] h-[30vw] rounded-full blur-[100px] transition-colors duration-1000 ${isDark ? 'bg-indigo-600/20 mix-blend-screen' : 'bg-indigo-400/20 mix-blend-multiply'}`} />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
        </div>

        {/* NAVBAR */}
        <motion.nav 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
            scrolled 
              ? 'bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 py-4 shadow-xl dark:bg-[#030712]/60 dark:border-white/5 dark:shadow-2xl' 
              : 'bg-transparent py-6'
          }`}
        >
          <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/eventflow-mark.svg" alt="EventFlow" className="h-8 w-8 drop-shadow-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Event<span className="text-cyan-600 dark:text-cyan-500">Flow</span></span>
            </div>
            <div className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-600 dark:text-slate-300">
              <Link href="#rozwiazania" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Rozwiązania</Link>
              <Link href="#funkcje" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Funkcje</Link>
              <Link href="#bezpieczenstwo" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Bezpieczeństwo</Link>
              <Link href="/cennik" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Cennik</Link>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsDark(!isDark)} 
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 ${
                  isDark 
                    ? 'bg-slate-800/50 text-slate-400 border border-white/10 hover:bg-slate-700 hover:text-amber-400' 
                    : 'bg-white/80 text-slate-500 border border-slate-200/50 hover:bg-white hover:text-slate-900'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={isDark ? 'dark' : 'light'} initial={{ opacity: 0, rotate: -90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.5 }} transition={{ duration: 0.2 }}>
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  </motion.div>
                </AnimatePresence>
              </button>
              <Link href="/login" className="hidden sm:block text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">Zaloguj się</Link>
              <Link href="/login" className="relative group overflow-hidden bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-6 py-2.5 rounded-full text-sm font-black shadow-lg transition-all hover:scale-105 hover:shadow-cyan-500/30">
                <span className="relative z-10">Rozpocznij za darmo</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* HERO SECTION */}
        <section className="relative z-10 pt-40 pb-20 lg:pt-52 lg:pb-32 flex flex-col items-center justify-center min-h-[90vh]">
          <div className="max-w-[1200px] mx-auto px-6 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-slate-200 text-xs font-black tracking-widest text-cyan-700 mb-8 backdrop-blur-xl shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-cyan-400 dark:shadow-cyan-900/20"
            >
              <Sparkles size={14} /> KONTROLA NAD KAŻDYM SPRZĘTEM, WYDARZENIEM I PRACOWNIKIEM
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="text-5xl lg:text-7xl xl:text-[5.5rem] font-black tracking-tighter leading-[1.05] mb-8 text-slate-900 dark:text-white"
            >
              Koniec z chaosem.<br />
              Czas na <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400">Płynność.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
            >
              EventFlow to zaawansowany system WMS i ERP, który zamienia stres branży eventowej w czysty, zorganizowany proces.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/login" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 px-8 py-4 rounded-full text-base font-black shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)] dark:shadow-[0_0_40px_-10px_rgba(6,182,212,0.8)] hover:scale-105 transition-all duration-300 hover:bg-cyan-500 dark:hover:bg-cyan-400">
                Przetestuj system za darmo <ArrowRight size={18} />
              </Link>
              <Link href="/cennik" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/60 text-slate-700 border border-slate-200 px-8 py-4 rounded-full text-base font-bold hover:bg-white transition-all backdrop-blur-md dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10">
                Zobacz plany i cennik
              </Link>
            </motion.div>
          </div>

          {/* 3D SCROLL ANIMATION ELEMENT */}
          <div className="w-full max-w-[1200px] mx-auto mt-24 px-6 perspective-[1200px]">
            <motion.div 
              style={{ rotateX, rotateY, scale, opacity, y: translateY }}
              className="relative rounded-[2rem] border overflow-hidden bg-white/70 border-slate-200 shadow-2xl backdrop-blur-2xl dark:bg-white/5 dark:border-white/10 dark:shadow-[0_0_100px_rgba(6,182,212,0.15)]"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-20"></div>
              <div className="p-4 bg-slate-100/50 border-b border-slate-200 flex items-center gap-2 backdrop-blur-3xl dark:bg-white/5 dark:border-white/5">
                <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div></div>
                <div className="mx-auto bg-white rounded-md px-3 py-1 text-[10px] font-bold text-slate-500 border border-slate-200 shadow-sm dark:bg-black/20 dark:text-slate-400 dark:border-white/5">www.event-flow.pl</div>
              </div>
              <div className="grid grid-cols-4 h-[400px] lg:h-[600px] p-6 gap-6 bg-slate-50 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-[#030712]/90">
                <div className="col-span-1 border border-slate-200 rounded-2xl bg-white shadow-sm hidden md:block p-4 space-y-4 dark:border-white/5 dark:bg-black/20 dark:shadow-none">
                  <div className="h-8 rounded-lg bg-slate-100 w-full dark:bg-white/5"></div>
                  <div className="h-8 rounded-lg bg-cyan-50 w-3/4 border border-cyan-100 dark:bg-cyan-500/20 dark:border-cyan-500/30"></div>
                  <div className="h-8 rounded-lg bg-slate-100 w-5/6 dark:bg-white/5"></div>
                </div>
                <div className="col-span-4 md:col-span-3 space-y-6">
                  <div className="flex gap-4">
                    <div className="h-32 flex-1 rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-end shadow-sm dark:bg-white/5 dark:border-white/5 dark:shadow-none">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">12</span>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Wydarzeń w tym tygodniu</span>
                    </div>
                    <div className="h-32 flex-1 rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-end shadow-sm dark:bg-white/5 dark:border-white/5 dark:shadow-none">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">45</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Skanów WZ na dziś</span>
                    </div>
                  </div>
                  <div className="h-64 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/5 dark:shadow-none">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-500/20"></div>
                      <div className="space-y-2"><div className="h-3 w-48 bg-slate-200 rounded-full dark:bg-white/20"></div><div className="h-2 w-32 bg-slate-100 rounded-full dark:bg-white/10"></div></div>
                    </div>
                    <div className="space-y-3"><div className="h-10 rounded-xl bg-slate-50 w-full dark:bg-white/5"></div><div className="h-10 rounded-xl bg-slate-50 w-full dark:bg-white/5"></div></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* SOCIAL PROOF (Logos) */}
        <section className="relative z-10 py-12 border-y bg-white/60 border-slate-200 backdrop-blur-lg dark:bg-white/5 dark:border-white/5">
          <div className="max-w-[1400px] mx-auto px-6">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-8">System, któremu ufają liderzy techniki scenicznej i AV</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
              <span className="text-xl font-black flex items-center gap-2"><div className="w-6 h-6 bg-cyan-500 rounded-md rotate-45 blur-[2px]"></div> STAGE TECH</span>
              <span className="text-xl font-black flex items-center gap-2"><Zap size={24} className="text-amber-500"/> LIGHTING PRO</span>
              <span className="text-xl font-black flex items-center gap-2"><LayoutGrid size={24} className="text-blue-500"/> RENTAL HOUSE</span>
              <span className="text-xl font-black flex items-center gap-2"><div className="w-6 h-6 rounded-full border-4 border-emerald-500"></div> SOUND VISION</span>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES */}
        <section id="funkcje" className="relative z-10 py-32">
          <div className="max-w-[1400px] mx-auto px-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
              <h2 className="text-4xl lg:text-6xl font-black tracking-tight mb-6 text-slate-900 dark:text-white">Zaprojektowany, by zachwycać.<br />Zbudowany, by działać.</h2>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Intuicyjny interfejs kryje potężne narzędzia automatyzujące Twoją firmę.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 auto-rows-fr">
              {/* Duża karta - Magazyn */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="md:col-span-2 bg-white border-slate-200 shadow-xl shadow-slate-200/50 hover:bg-slate-50 dark:bg-white/5 dark:backdrop-blur-2xl dark:border-white/10 rounded-[2.5rem] p-10 lg:p-14 overflow-hidden relative group transition-all dark:hover:bg-white/10 dark:shadow-none">
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-cyan-100 text-cyan-600 border border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-6 dark:border-cyan-500/30">
                    <Box size={28} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-3xl font-black mb-4 text-slate-900 dark:text-white">Bezbłędny Magazyn.</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium max-w-md leading-relaxed text-lg">
                    Skanuj kody QR, wydawaj sprzęt na eventy i twórz dokumenty WZ/PZ. System sam poinformuje Cię o brakach i opóźnieniach.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-96 h-96 bg-cyan-100/50 blur-[100px] rounded-full group-hover:bg-cyan-200/50 transition-colors dark:bg-cyan-500/20 dark:group-hover:bg-cyan-500/30"></div>
              </motion.div>

              {/* Mniejsza karta - Kalendarz */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white border-slate-200 shadow-xl hover:bg-slate-50 dark:bg-white/5 dark:backdrop-blur-2xl dark:border-white/10 rounded-[2.5rem] p-10 flex flex-col group transition-all dark:hover:bg-white/10 dark:shadow-none relative overflow-hidden">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 dark:border-blue-500/30">
                  <CalendarCheck size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">Grafik bez kolizji.</h3>
                <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Planuj wydarzenia, przypisuj ekipy i rezerwuj pojazdy z wyprzedzeniem. Zapomnij o overbookingu.</p>
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-blue-100/50 blur-[80px] rounded-full group-hover:bg-blue-200/50 transition-colors dark:bg-blue-500/10 dark:group-hover:bg-blue-500/20"></div>
              </motion.div>

              {/* Mniejsza karta - Oferty */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-xl shadow-cyan-600/20 dark:from-cyan-600/20 dark:to-blue-700/20 dark:backdrop-blur-2xl border border-transparent dark:border-cyan-500/30 rounded-[2.5rem] p-10 flex flex-col transition-all dark:hover:border-cyan-400/50 dark:shadow-none hover:-translate-y-1">
                <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-6 border border-white/30 dark:bg-white/10 dark:border-white/20">
                  <CheckCircle2 size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black mb-4 text-white">Błyskawiczne Oferty.</h3>
                <p className="text-cyan-50 font-medium leading-relaxed dark:text-cyan-100/70">Twórz profesjonalne wyceny (PDF) w kilka kliknięć. Inteligentny algorytm sam dopasuje ceny do budżetu klienta.</p>
              </motion.div>

              {/* Mniejsza karta - Serwis i Flota */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="md:col-span-2 bg-white border-slate-200 shadow-xl shadow-slate-200/50 hover:bg-slate-50 dark:bg-white/5 dark:backdrop-blur-2xl dark:border-white/10 rounded-[2.5rem] p-10 lg:p-14 overflow-hidden relative group transition-all dark:hover:bg-white/10 dark:shadow-none">
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-orange-100 text-orange-600 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6 dark:border-orange-500/30">
                    <Truck size={28} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-3xl font-black mb-4 text-slate-900 dark:text-white">Flota i Serwis pod kontrolą.</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium max-w-lg leading-relaxed text-lg mb-8">Koniec z niespodziewanymi awariami na eventach. Śledź usterki sprzętu, terminy ubezpieczeń OC oraz przeglądy samochodów w jednym pulpicie.</p>
                  <Link href="/login" className="inline-flex items-center gap-2 text-sm font-black text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors">Odkryj wszystkie funkcje <ChevronRight size={16} /></Link>
                </div>
                <div className="absolute right-0 bottom-0 w-96 h-96 bg-orange-100/50 blur-[100px] rounded-full group-hover:bg-orange-200/50 transition-colors dark:bg-orange-500/10 dark:group-hover:bg-orange-500/20"></div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ACCREDITATIONS / SECURITY */}
        <section id="bezpieczenstwo" className="relative z-10 py-32 bg-slate-100 border-y border-slate-200 dark:bg-black/40 dark:backdrop-blur-xl dark:border-white/5">
          <div className="max-w-[1000px] mx-auto px-6 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
              <ShieldCheck size={56} className="mx-auto text-cyan-600 dark:text-cyan-500 mb-8" />
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-8 text-slate-900 dark:text-white">Bezpieczeństwo na poziomie Enterprise</h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium mb-12 leading-relaxed">Twoja baza klientów, stawki rabatowe i tajemnice handlowe są u nas nietykalne. Stosujemy restrykcyjną izolację danych (Multi-Tenancy) i szyfrowanie, któremu ufają największe instytucje.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl dark:bg-white/5 dark:border-white/10 dark:shadow-none"><div className="text-cyan-600 dark:text-cyan-400 font-black mb-1">Szyfrowanie</div><div className="text-xs font-bold text-slate-500">AES-256 / TLS 1.3</div></div>
                <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl dark:bg-white/5 dark:border-white/10 dark:shadow-none"><div className="text-cyan-600 dark:text-cyan-400 font-black mb-1">Izolacja</div><div className="text-xs font-bold text-slate-500">Logiczne bazy danych</div></div>
                <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl dark:bg-white/5 dark:border-white/10 dark:shadow-none"><div className="text-cyan-600 dark:text-cyan-400 font-black mb-1">Backupy</div><div className="text-xs font-bold text-slate-500">Codzienne, rozproszone</div></div>
                <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl dark:bg-white/5 dark:border-white/10 dark:shadow-none"><div className="text-cyan-600 dark:text-cyan-400 font-black mb-1">Logowanie</div><div className="text-xs font-bold text-slate-500">Audyt logów 24/7</div></div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative z-10 py-32">
          <div className="max-w-[1000px] mx-auto px-6 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 p-12 md:p-20 rounded-[3rem] shadow-xl dark:from-cyan-900/40 dark:to-blue-900/40 dark:border-cyan-500/20 dark:backdrop-blur-xl dark:shadow-none relative overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
              <h2 className="text-4xl lg:text-6xl font-black tracking-tight mb-6 text-slate-900 dark:text-white">Zyskaj przewagę technologiczną.</h2>
              <p className="text-xl text-slate-600 dark:text-cyan-100/70 font-medium mb-10 max-w-2xl mx-auto">Dołącz do nowoczesnych firm, które zautomatyzowały swoją pracę. Załóż konto i zobacz, jak EventFlow odmieni Twój biznes.</p>
              <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-10 py-5 rounded-full text-lg font-black shadow-xl hover:scale-105 transition-all duration-300 dark:shadow-[0_0_30px_rgba(255,255,255,0.2)] dark:hover:bg-cyan-50 hover:bg-slate-800">
                Załóż darmowe konto <ArrowRight size={20} />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative z-10 bg-white border-t border-slate-200 pt-16 pb-8 dark:bg-black/50 dark:border-white/5 dark:backdrop-blur-3xl">
          <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img src="/eventflow-mark.svg" alt="EventFlow" className="h-6 w-6 opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Event<span className="text-cyan-600 dark:text-cyan-500">Flow</span></span>
              </div>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Stworzone przez eventowców dla eventowców. Upraszczamy zarządzanie technologią sceniczną, abyś Ty mógł skupić się na tworzeniu niezwykłych widowisk.</p>
            </div>
            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-6">Produkt</h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
                <li><Link href="/#funkcje" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Magazyn WMS</Link></li>
                <li><Link href="/#funkcje" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Oferty i Budżety</Link></li>
                <li><Link href="/#funkcje" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Flota i Serwis</Link></li>
                <li><Link href="/cennik" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Cennik</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-6">Firma</h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">O nas</a></li>
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Kontakt</a></li>
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Zostań partnerem</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-6">Wsparcie</h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Centrum pomocy</a></li>
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Polityka prywatności</a></li>
                <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Regulamin</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-[1400px] mx-auto px-6 text-center text-xs text-slate-500 font-semibold pt-8 border-t border-slate-200 dark:text-slate-600 dark:border-white/5">
            &copy; {new Date().getFullYear()} EventFlow. Wszelkie prawa zastrzeżone.
          </div>
        </footer>
      </div>
    </div>
  );
}