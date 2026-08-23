'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, Rocket, Sparkles, Star, Zap, Sun, Moon, ShieldCheck, Box, Users } from 'lucide-react';

// --- KOMPONENT TILT CARD DLA EFEKTU 3D ---
function TiltCard({ children, highlighted = false, isDark }: { children: React.ReactNode, highlighted?: boolean, isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7.5deg", "-7.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7.5deg", "7.5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Ustalanie klas na podstawie motywu i podświetlenia
  const cardClasses = isDark 
    ? (highlighted 
        ? 'bg-white/10 border-cyan-400/50 shadow-[0_0_50px_rgba(6,182,212,0.15)] hover:shadow-[0_0_80px_rgba(6,182,212,0.3)]' 
        : 'bg-white/5 border-white/10 shadow-xl hover:bg-white/10')
    : (highlighted 
        ? 'bg-cyan-50/80 border-cyan-300 shadow-2xl hover:shadow-[0_0_40px_rgba(6,182,212,0.2)]' 
        : 'bg-white/90 border-slate-200 shadow-xl hover:bg-white hover:shadow-2xl hover:border-slate-300');

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`relative h-full w-full rounded-[2.5rem] border backdrop-blur-2xl p-8 lg:p-10 flex flex-col transition-shadow duration-500 ${cardClasses}`}
    >
      <div className="absolute inset-0 z-0 pointer-events-none rounded-[2.5rem] overflow-hidden">
        <motion.div 
          style={{ 
            translateX: useTransform(mouseXSpring, [-0.5, 0.5], ["-50%", "50%"]),
            translateY: useTransform(mouseYSpring, [-0.5, 0.5], ["-50%", "50%"]),
            opacity: useTransform(x, [-0.5, 0, 0.5], [0, 0.15, 0]) 
          }}
          className={`w-full h-full blur-3xl ${isDark ? 'bg-gradient-to-tr from-white to-transparent' : 'bg-gradient-to-tr from-slate-400 to-transparent'}`}
        />
      </div>
      <div style={{ transform: "translateZ(50px)" }} className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}

export default function PricingPage() {
  const [scrolled, setScrolled] = useState(false);
  
  // Stan motywu (Dark/Light)
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  if (!mounted) return null;

  return (
    <div className={`${isDark ? 'dark' : ''} selection:bg-cyan-500 selection:text-white`}>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-700 dark:bg-[#030712] dark:text-slate-50 font-sans overflow-x-hidden">
        
        {/* TŁO LIQUID GLASS */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[150px] animate-pulse-slow transition-colors duration-1000 ${isDark ? 'bg-cyan-600/20 mix-blend-screen' : 'bg-cyan-400/30 mix-blend-multiply'}`} />
          <div className={`absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] transition-colors duration-1000 ${isDark ? 'bg-blue-700/20 mix-blend-screen' : 'bg-blue-400/20 mix-blend-multiply'}`} />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
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
            <Link href="/" className="flex items-center gap-3">
              <img src="/eventflow-mark.svg" alt="EventFlow" className="h-8 w-8 drop-shadow-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Event<span className="text-cyan-600 dark:text-cyan-500">Flow</span></span>
            </Link>
            <div className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-600 dark:text-slate-300">
              <Link href="/#rozwiazania" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Rozwiązania</Link>
              <Link href="/#funkcje" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Funkcje</Link>
              <Link href="/#bezpieczenstwo" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Bezpieczeństwo</Link>
              <Link href="/cennik" className="text-cyan-600 dark:text-cyan-400">Cennik</Link>
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
        <section className="relative z-10 pt-40 pb-16 lg:pt-52 lg:pb-24">
          <div className="max-w-[1200px] mx-auto px-6 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-8 text-slate-900 dark:text-white"
            >
              Zainwestuj w system,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400">
                który zarabia na siebie.
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6 leading-relaxed font-medium"
            >
              Proste i przejrzyste plany bez ukrytych opłat. Oszczędności z odzyskanego sprzętu i czasu pracy pokryją koszt subskrypcji w pierwszym miesiącu.
            </motion.p>
          </div>
        </section>

        {/* PRICING CARDS (3D BENTO) */}
        <section className="relative z-10 pb-32 perspective-[2000px]">
          <div className="max-w-[1400px] mx-auto px-6">
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* PLAN START */}
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                <TiltCard isDark={isDark}>
                  <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 text-xs font-black dark:text-slate-300 mb-6 uppercase tracking-wider">
                      <Rocket size={14} /> Start
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-2">249 zł</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">/ miesiąc netto</p>
                  </div>
                  <div className="mb-8 flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-6">Idealny dla DJ'ów i małych firm:</p>
                    <ul className="space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Do 3 użytkowników</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Do 100 modeli sprzętu</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Nielimitowane egzemplarze</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> CRM (Kontrahenci + Kontakty)</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Moduł Ofert</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Magazyn (WZ/PZ)</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-500 shrink-0"/> Kalendarz Operacyjny</li>
                    </ul>
                  </div>
                  <Link href="/login" className="block w-full py-4 text-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-black hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:border-white/5 dark:hover:bg-white/20 transition-colors">
                    Wybieram START
                  </Link>
                </TiltCard>
              </motion.div>

              {/* PLAN PRO */}
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="relative z-10 lg:-mt-8 lg:mb-8">
                <TiltCard highlighted isDark={isDark}>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white dark:from-cyan-400 dark:to-blue-500 dark:text-slate-950 text-xs font-black uppercase tracking-wider py-1.5 px-4 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                    Wybiera 80% klientów
                  </div>
                  <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-100 border border-cyan-200 text-cyan-700 dark:bg-cyan-500/20 dark:border-cyan-500/30 text-xs font-black dark:text-cyan-300 mb-6 uppercase tracking-wider shadow-inner">
                      <Star size={14} /> PRO
                    </div>
                    <h3 className="text-5xl font-black text-slate-900 dark:text-white mb-2">599 zł</h3>
                    <p className="text-cyan-700/80 dark:text-cyan-100/60 font-medium text-sm">/ miesiąc netto</p>
                  </div>
                  <div className="mb-8 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-6">Pełna automatyzacja dla techniki scenicznej:</p>
                    <ul className="space-y-4 text-sm font-semibold text-slate-700 dark:text-white/90">
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Do 10 użytkowników</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Nielimitowany magazyn i modele</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Moduł Serwisu (Usterki)</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Wynajmy cross-rental</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Budżetowanie wydarzeń</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Zaawansowany Harmonogram</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Dostęp do Aplikacji Mobilnej</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Pełny dostęp do API</li>
                      <li className="flex gap-3 items-center"><CheckCircle2 size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0"/> Eksporty Danych</li>
                    </ul>
                  </div>
                  <Link href="/login" className="block w-full py-4 text-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white dark:from-cyan-500 dark:to-blue-500 font-black shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition-all">
                    Wybieram PRO
                  </Link>
                </TiltCard>
              </motion.div>

              {/* PLAN ENTERPRISE */}
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
                <TiltCard isDark={isDark}>
                  <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-white/10 text-xs font-black dark:text-amber-400 mb-6 uppercase tracking-wider">
                      <Zap size={14} /> Enterprise
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-2">999 zł</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">/ miesiąc netto</p>
                  </div>
                  <div className="mb-8 flex-1">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-200/80 mb-6">Dla korporacji bez limitów:</p>
                    <ul className="space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> <strong>Bez limitu</strong> użytkowników</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Wiele oddziałów</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Wiele magazynów fizycznych</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Logowanie SSO (SAML/OAuth)</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Indywidualne integracje</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Gwarancja SLA 99.9%</li>
                      <li className="flex gap-3"><CheckCircle2 size={18} className="text-amber-600 dark:text-amber-500 shrink-0"/> Dedykowany support 24/7</li>
                    </ul>
                  </div>
                  <Link href="/login" className="block w-full py-4 text-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-black hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:border-white/5 dark:hover:bg-white/20 transition-colors">
                    Wybieram ENTERPRISE
                  </Link>
                </TiltCard>
              </motion.div>

            </div>
          </div>
        </section>

        {/* IMPLEMENTATION / WDROŻENIE */}
        <section className="relative z-10 py-24 bg-white border-y border-slate-200 dark:bg-black/40 dark:border-white/5 dark:backdrop-blur-xl">
          <div className="max-w-[1000px] mx-auto px-6">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="flex items-center gap-3 mb-6 justify-center lg:justify-start">
                <ShieldCheck className="text-cyan-600 dark:text-cyan-500" size={32} />
                <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Opcjonalne Ceny Wdrożenia</h2>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 font-medium mb-12 text-center lg:text-left">
                Tego większość firm IT nie robi. My tak. Wierzymy w transparentność. Chcesz wdrożyć system samemu? Proszę bardzo. Potrzebujesz, abyśmy przepisali Twoje Excele za Ciebie? Oto cennik:
              </p>

              <div className="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-3xl overflow-hidden shadow-lg dark:shadow-2xl">
                <div className="divide-y divide-slate-200 dark:divide-white/5">
                  
                  {/* Wiersz */}
                  <div className="flex items-center justify-between p-6 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 flex items-center justify-center dark:text-cyan-400"><Box size={20}/></div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Import sprzętu i bazy magazynowej</p>
                        <p className="text-sm text-slate-500">Przeniesiemy Twoje arkusze i zmapujemy modele z egzemplarzami.</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white whitespace-nowrap">500 zł</div>
                  </div>

                  <div className="flex items-center justify-between p-6 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 flex items-center justify-center dark:text-cyan-400"><Users size={20}/></div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Import bazy kontrahentów</p>
                        <p className="text-sm text-slate-500">Oczyszczenie i import bazy CRM do EventFlow.</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white whitespace-nowrap">300 zł</div>
                  </div>

                  <div className="flex items-center justify-between p-6 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 flex items-center justify-center dark:text-cyan-400"><Info size={20}/></div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Szkolenie zespołu Online</p>
                        <p className="text-sm text-slate-500">Do 4 godzin dedykowanego warsztatu na Teams / Zoom.</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white whitespace-nowrap">500 zł</div>
                  </div>

                  <div className="flex items-center justify-between p-6 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 flex items-center justify-center dark:text-cyan-400"><Sparkles size={20}/></div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Szkolenie stacjonarne u Klienta</p>
                        <p className="text-sm text-slate-500">Nasz ekspert spędzi z Wami cały dzień w Waszym magazynie.</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white whitespace-nowrap">800 zł <span className="text-sm text-slate-500 font-medium">+ dojazd</span></div>
                  </div>

                  <div className="flex items-center justify-between p-6 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/20 flex items-center justify-center dark:text-purple-400"><Rocket size={20}/></div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Dedykowana integracja lub konfiguracja</p>
                        <p className="text-sm text-slate-500">Skontaktuj się z nami w celu integracji z Twoim programem księgowym.</p>
                      </div>
                    </div>
                    <div className="text-lg font-black text-purple-600 dark:text-purple-400 whitespace-nowrap">Wycena indywidualna</div>
                  </div>

                </div>
              </div>
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
          <div className="max-w-[1400px] mx-auto px-6 text-center text-xs text-slate-500 font-semibold pt-8 border-t border-slate-200 dark:border-white/5">
            &copy; {new Date().getFullYear()} EventFlow. Wszelkie prawa zastrzeżone.
          </div>
        </footer>
      </div>
    </div>
  );
}