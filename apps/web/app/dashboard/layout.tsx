'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Calendar, CheckSquare, Home, Users, Box, Wrench, Truck, Settings, FileText, 
  ChevronDown, LogOut, Star, Phone, Tags, Shield, Car, Palmtree, Palette, 
  ShieldAlert, Menu, Bell, Search, Sun, Moon, PanelLeftClose, PanelLeftOpen, Plus, Layers, Loader2, ArrowRight,
  FileArchive, UserCircle, AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ProductUI';
import { api } from '../../lib/api';

type MenuItem = {
  icon: any;
  label: string;
  href?: string;
  requiredPermission?: string;
  children?: MenuItem[];
};

// Mapowanie linków do wymaganych uprawnień (ACL z permissions.enum.ts)
const menuConfig: MenuItem[] = [
  { icon: UserCircle, label: 'Profil', href: '/dashboard/settings/profile' },
  { icon: Home, label: 'Kokpit', href: '/dashboard' },
  { icon: Calendar, label: 'Kalendarz', href: '/dashboard/calendar' },
  { icon: Star, label: 'Wydarzenia', requiredPermission: 'events:view', children: [
    { label: 'Lista wydarzeń', href: '/dashboard/events', icon: Star },
    { label: 'Wypożyczenia', href: '/dashboard/rentals', icon: Truck },
    { label: 'Urlopy', href: '/dashboard/leaves', icon: Palmtree },
    { label: 'Przeniesienia', href: '/dashboard/warehouse/transfers', icon: ArrowRight, requiredPermission: 'events:manage' },
  ]},
  { icon: Users, label: 'Kontrahenci', requiredPermission: 'crm:view', children: [
    { label: 'Lista kontrahentów', href: '/dashboard/crm', icon: Users },
    { label: 'Kontakty', href: '/dashboard/crm/contacts', icon: Phone },
  ]},
  { icon: Box, label: 'Magazyn', requiredPermission: 'warehouse:view', children: [
    { label: 'Magazyn wewnętrzny', href: '/dashboard/warehouse', icon: Box },
    { label: 'Modele', href: '/dashboard/warehouse/models', icon: Box },
    { label: 'Egzemplarze', href: '/dashboard/warehouse/items', icon: Box },
    { label: 'Opakowania', href: '/dashboard/warehouse/packages', icon: Box },
    { label: 'Pakiety Ofertowe', href: '/dashboard/warehouse/bundles', icon: Layers },
    { label: 'Ceny', href: '/dashboard/warehouse/pricing', icon: Tags, requiredPermission: 'warehouse:manage' },
    { label: 'Wydania i przyjęcia', href: '/dashboard/warehouse/receiving', icon: Truck },
    { label: 'Niezwrócony sprzęt', href: '/dashboard/warehouse/unreturned', icon: Truck },
    { label: 'Kategorie', href: '/dashboard/warehouse/categories', icon: Tags },
  ]},
  { icon: CheckSquare, label: 'Zadania', href: '/dashboard/tasks' },
  { icon: Wrench, label: 'Serwis', requiredPermission: 'service:view', children: [
    { label: 'Zgłoszenia', href: '/dashboard/service', icon: Wrench },
    { label: 'Statusy serwisowe', href: '/dashboard/service/statuses', icon: Tags, requiredPermission: 'settings:view' },
  ]},
  { icon: Truck, label: 'Flota', requiredPermission: 'fleet:view', children: [
    { label: 'Pojazdy', href: '/dashboard/fleet', icon: Car },
  ]},
  { icon: FileText, label: 'Oferty', requiredPermission: 'offers:view', href: '/dashboard/offers' },
  { icon: FileText, label: 'Zapytanie ofertowe', requiredPermission: 'offers:view', href: '/dashboard/zapytania' },
  { label: 'Powiadomienia i Komunikaty', href: '/dashboard/notifications', icon: Bell },
  { label: 'Globalne Załączniki', href: '/dashboard/attachments', icon: FileArchive },
  { icon: Settings, label: 'Ustawienia', requiredPermission: 'settings:view', children: [
    { label: 'Personalizacja systemu', href: '/dashboard/settings', icon: Settings },
    { label: 'Typy wydarzeń', href: '/dashboard/settings/event-types', icon: Palette },
    { label: 'Statusy operacyjne', href: '/dashboard/settings/statuses', icon: Tags },
    { label: 'Role i Uprawnienia', href: '/dashboard/settings/permissions', icon: Shield, requiredPermission: 'users:manage' }, 
  ]},
  { icon: Users, label: 'Użytkownicy', requiredPermission: 'users:manage', href: '/dashboard/users' },
];

// Generator subtelnego dźwięku powiadomienia (Web Audio API)
function playNotificationChime(priority: string = 'normalny') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const isHigh = priority === 'wysoki' || priority === 'krytyczny';
    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(isHigh ? 880 : 587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(isHigh ? 1318.51 : 880, now + 0.15);

    osc2.frequency.setValueAtTime(isHigh ? 440 : 293.66, now);
    osc2.frequency.exponentialRampToValueAtTime(isHigh ? 659.25 : 440, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  } catch {
    // Brak zgody użytkownika na autoplay audio
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ Magazyn: true, Wydarzenia: true });
  const [isMounted, setIsMounted] = useState(false);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // WYSZUKIWARKA
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // POWIADOMIENIA
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<any | null>(null);
  const seenNotifIdsRef = useRef<Set<number>>(new Set());

  // TOP BAR
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const displayName = useMemo(() => {
    const u: any = user || {};
    return [u.imie, u.nazwisko].filter(Boolean).join(' ') || u.name || u.email || 'Użytkownik';
  }, [user]);

  const role = useMemo(() => {
    const u: any = user || {};
    return u.rola?.nazwa || u.role || u.rola || u.role_name || 'Użytkownik';
  }, [user]);

  const fetchNotifications = useCallback(async (isInitial = false) => {
    try {
      const res = await api.get('/api/powiadomienia?limit=15');
      const data = res.data?.items || [];
      const count = res.data?.unreadCount || 0;
      setNotifications(data);
      setUnreadCount(count);

      // Wykrywanie nowego powiadomienia i odtworzenie dźwięku
      if (!isInitial && data.length > 0) {
        const newest = data[0];
        if (!newest.przeczytane && !seenNotifIdsRef.current.has(newest.id)) {
          seenNotifIdsRef.current.add(newest.id);
          setToastNotification(newest);
          playNotificationChime(newest.priorytet);
        }
      }

      data.forEach((n: any) => seenNotifIdsRef.current.add(n.id));
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => { 
    setIsMounted(true); 
    if (!user) {
      router.push('/login'); 
      return;
    }
    
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('ef-theme');
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (storedTheme === 'dark' || (!storedTheme && isSystemDark)) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
      } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
      }
    }

    fetchNotifications(true);
    const interval = setInterval(() => fetchNotifications(false), 20000);
    return () => clearInterval(interval);
  }, [user, router, fetchNotifications]);

  // Automatyczne zamykanie toastu po 6 sekundach
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => setToastNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Globalna wyszukiwarka z obsługą tagów (Debounce 400ms)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setDbSearchResults([]);
      setIsSearchingDb(false);
      return;
    }
    setIsSearchingDb(true);
    const timeoutId = setTimeout(() => {
      api.get(`/api/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(res => setDbSearchResults(res.data || []))
        .catch(console.error)
        .finally(() => setIsSearchingDb(false));
    }, 400);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 60) {
        setIsTopBarVisible(true);
      } else if (currentScrollY > lastScrollY.current && isTopBarVisible) {
        setIsTopBarVisible(false);
      } else if (currentScrollY < lastScrollY.current && !isTopBarVisible) {
        setIsTopBarVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTopBarVisible]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsSearchFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('ef-theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const userPermissions = user?.permissions || [];
  const hasPermission = (reqPerm?: string) => {
    if (!reqPerm) return true;
    return userPermissions.includes(reqPerm);
  };

  const visibleMenu = useMemo(() => menuConfig
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((sub) => hasPermission(sub.requiredPermission || item.requiredPermission));
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter((item) => {
      if (!hasPermission(item.requiredPermission)) return false;
      if (item.children && item.children.length === 0) return false;
      return true;
    }), [userPermissions]);

  const menuSearchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const results: { label: string; href: string; icon: any }[] = [];
    const q = searchQuery.toLowerCase();
    visibleMenu.forEach(item => {
      if (item.label.toLowerCase().includes(q) && item.href) results.push({ label: item.label, href: item.href, icon: item.icon });
      item.children?.forEach(child => {
        if (child.label.toLowerCase().includes(q)) results.push({ label: `${item.label} > ${child.label}`, href: child.href!, icon: child.icon });
      });
    });
    return results;
  }, [searchQuery, visibleMenu]);

  const getRequiredPermissionForPath = (path: string) => {
    if (path.startsWith('/dashboard/settings/permissions')) return 'users:manage';
    if (path.startsWith('/dashboard/service/statuses')) return 'settings:view';
    if (path.startsWith('/dashboard/warehouse/pricing')) return 'warehouse:manage';
    if (path.startsWith('/dashboard/events') || path.startsWith('/dashboard/rentals') || path.startsWith('/dashboard/leaves')) return 'events:view';
    if (path.startsWith('/dashboard/crm')) return 'crm:view';
    if (path.startsWith('/dashboard/warehouse')) return 'warehouse:view';
    if (path.startsWith('/dashboard/service')) return 'service:view';
    if (path.startsWith('/dashboard/fleet')) return 'fleet:view';
    if (path.startsWith('/dashboard/offers')) return 'offers:view';
    if (path.startsWith('/dashboard/settings')) return 'settings:view';
    if (path.startsWith('/dashboard/users')) return 'users:manage';
    return null; 
  };

  const isAllowedToAccessCurrentRoute = hasPermission(getRequiredPermissionForPath(pathname));

  const handleMenuClick = (item: MenuItem) => {
    if (isCollapsed) setIsCollapsed(false);
    if (item.children) {
      setOpenMenus((p) => ({...p, [item.label]: !p[item.label]}));
    } else {
      router.push(item.href!);
      setIsMobileOpen(false);
    }
  };

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.przeczytane) {
        await api.patch(`/api/powiadomienia/${n.id}/read`);
        fetchNotifications(true);
      }
    } catch {}
    setIsNotifOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/powiadomienia/read-all');
      fetchNotifications(true);
    } catch {}
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} godz. temu`;
    return `${Math.floor(hours / 24)} dni temu`;
  };

  if (!isMounted || !user) return <div className="h-screen bg-slate-50 dark:bg-[#02080a]" />;
  if (pathname?.includes('/pdf') || pathname?.includes('/labels')) return <div className="min-h-screen bg-white text-slate-900 print:bg-white">{children}</div>;

  return (
    <div className="flex min-h-screen bg-slate-100/50 text-slate-900 dark:bg-[#02080a] dark:text-slate-100 transition-colors duration-300">
      
      {/* OVERLAY NA MOBILE */}
      <div 
        onClick={() => setIsMobileOpen(false)} 
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      />

      {/* SIDEBAR WYSPA */}
      <aside 
        className={`fixed inset-y-4 left-4 z-50 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[32px] shadow-xl lg:shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? 'w-[88px]' : 'w-[280px]'} ${isMobileOpen ? 'translate-x-0' : '-translate-x-[150%] lg:translate-x-0'}`}
      >
        <div className={`flex items-center justify-between h-24 shrink-0 ${isCollapsed ? 'px-0 justify-center' : 'px-7'}`}>
          {!isCollapsed && <Image src={theme === 'dark' ? "/eve_nt_primary_with_symbol_reverse_transparent.png" : "/eve_nt_with_symbol_transparent.png"} alt="EventFlow" width={160} height={38} priority />}
          {isCollapsed && <Image src="/symbol_turquoise_transparent.png" alt="EF" width={40} height={40} priority />}
          
          {!isCollapsed && (
             <button onClick={() => setIsCollapsed(true)} className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-[#04e0ff] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
               <PanelLeftClose size={20} />
             </button>
          )}
        </div>

        {isCollapsed && (
          <button onClick={() => setIsCollapsed(false)} className="mx-auto mb-4 p-2 rounded-xl text-slate-400 hover:text-[#04e0ff] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
             <PanelLeftOpen size={20} />
          </button>
        )}

        <div className={`mb-4 shrink-0 ${isCollapsed ? 'px-3' : 'px-5'}`}>
          <div className={`rounded-2xl flex items-center bg-slate-50 dark:bg-[#0b1c24] border border-slate-100 dark:border-white/5 p-2 transition-all ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-[#04e0ff]/20 to-blue-500/20 text-[#04e0ff] flex items-center justify-center font-black text-sm border border-[#04e0ff]/30">
              {displayName.charAt(0)}{displayName.split(' ')[1]?.charAt(0) || ''}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-800 dark:text-white leading-tight">{displayName}</p>
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">{role}</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto custom-scrollbar space-y-1 ${isCollapsed ? 'px-3' : 'px-4'}`}>
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const active = item.href === pathname || item.children?.some((c) => c.href === pathname);
            
            return <div key={item.label}>
              <button 
                onClick={() => handleMenuClick(item)} 
                className={`flex w-full items-center ${isCollapsed ? 'justify-center py-3.5' : 'justify-between py-3 px-3'} rounded-xl text-sm font-black transition-all group ${active ? 'bg-gradient-to-r from-[#04e0ff] to-blue-600 text-white shadow-lg shadow-[#04e0ff]/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-[#04e0ff] dark:group-hover:text-white'} transition-colors`}/>
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && item.children && <ChevronDown size={15} className={`transition-transform duration-200 ${openMenus[item.label] ? 'rotate-180' : ''}`}/>} 
              </button>
              
              {!isCollapsed && item.children && openMenus[item.label] && (
                <div className="mt-1.5 mb-3 space-y-1 pl-4 relative before:absolute before:left-[21px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                  {item.children.map((sub) => { 
                    const SIcon = sub.icon; 
                    const subActive = sub.href === pathname; 
                    return (
                      <Link 
                        key={sub.href} 
                        href={sub.href!} 
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-all relative ${subActive ? 'text-[#04e0ff] dark:text-[#04e0ff] bg-cyan-50 dark:bg-[#04e0ff]/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                      >
                        <SIcon size={14}/>{sub.label}
                      </Link>
                    ); 
                  })}
                </div>
              )}
            </div>;
          })}
        </nav>

        <div className={`p-5 shrink-0 border-t border-slate-100 dark:border-white/5 mt-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
           <button onClick={() => { logout(); router.push('/login'); }} className={`flex items-center gap-3 rounded-xl text-sm font-black text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 transition-colors ${isCollapsed ? 'justify-center p-3' : 'w-full px-3 py-2.5'}`} title={isCollapsed ? "Wyloguj" : undefined}>
             <LogOut size={18}/>
             {!isCollapsed && <span>Wyloguj się</span>}
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? 'lg:ml-[112px]' : 'lg:ml-[312px]'}`}>
        
        {/* TOP BAR WYSPA */}
        <header className={`sticky z-30 mx-4 lg:mx-8 mb-8 flex h-16 shrink-0 items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/80 sm:px-6 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isTopBarVisible ? 'top-4 translate-y-0 opacity-100' : 'top-4 -translate-y-[150%] opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* GLOBALNA WYSZUKIWARKA (NAZWA, KOD, TAGI) */}
            <div className="hidden sm:flex items-center relative group" ref={searchRef}>
              <Search size={16} className="absolute left-4 text-slate-400 group-focus-within:text-[#04e0ff] transition-colors" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Szukaj danych, kodów lub #tagów..." 
                className="pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-[#02080a] border border-transparent rounded-full text-sm font-semibold outline-none focus:bg-white focus:border-[#04e0ff]/50 focus:ring-4 focus:ring-[#04e0ff]/10 dark:focus:bg-[#02080a] dark:focus:border-[#04e0ff]/30 transition-all w-48 xl:w-[360px]" 
              />
              
              {isSearchFocused && searchQuery.length >= 2 && (
                <div className="absolute top-full right-0 lg:left-0 mt-3 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden py-3 z-50 animate-fade-in-up flex flex-col max-h-[70vh]">
                  {isSearchingDb && <div className="flex justify-center p-3"><Loader2 className="w-5 h-5 animate-spin text-[#04e0ff]"/></div>}
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                    {menuSearchResults.length > 0 && (
                      <div className="mb-4">
                        <p className="px-3 mb-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">Zakładki Systemowe</p>
                        {menuSearchResults.map((r, i) => (
                          <Link key={i} href={r.href} onClick={() => { setIsSearchFocused(false); setSearchQuery(''); }} className="flex items-center gap-3 px-3 py-2 hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition text-sm font-bold text-slate-700 dark:text-slate-300 group">
                            <r.icon size={16} className="text-slate-400 group-hover:text-[#04e0ff] transition-colors"/> {r.label}
                          </Link>
                        ))}
                      </div>
                    )}

                    {dbSearchResults.length > 0 && (
                      <div>
                        <p className="px-3 mb-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">Wyniki z bazy</p>
                        {dbSearchResults.map((res: any) => (
                          <Link key={res.id} href={res.url} onClick={() => { setIsSearchFocused(false); setSearchQuery(''); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-cyan-50 dark:hover:bg-white/5 rounded-xl transition group">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-black/30 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/5 group-hover:border-[#04e0ff]/50 transition-colors">
                              {res.group === 'Wydarzenia' && <Calendar size={14} className="text-blue-500" />}
                              {res.group === 'Oferty' && <FileText size={14} className="text-purple-500" />}
                              {res.group === 'Wynajmy' && <Truck size={14} className="text-orange-500" />}
                              {res.group === 'Modele' && <Box size={14} className="text-cyan-500" />}
                              {res.group === 'Egzemplarze' && <Search size={14} className="text-teal-500" />}
                              {res.group === 'Kontrahenci' && <Users size={14} className="text-rose-500" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-[#04e0ff] transition-colors">{res.title}</p>
                              <p className="text-[11px] font-bold text-slate-500 truncate">{res.group} · {res.subtitle}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {!isSearchingDb && menuSearchResults.length === 0 && dbSearchResults.length === 0 && (
                      <p className="p-6 text-center text-sm font-bold text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl mx-2">Brak wyników w systemie.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block"></div>

            <button onClick={toggleTheme} className="p-2.5 text-slate-500 hover:text-[#04e0ff] transition-colors rounded-full hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-amber-400">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* DROPDOWN POWIADOMIEŃ */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { setIsNotifOpen(!isNotifOpen); }} 
                className={`relative p-2.5 transition-colors rounded-full ${isNotifOpen ? 'bg-cyan-50 text-[#04e0ff] dark:bg-white/5' : 'text-slate-500 hover:text-[#04e0ff] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white border-2 border-white dark:border-slate-900 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-3 w-[390px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden z-50 animate-fade-in-up origin-top-right">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-transparent">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-sm">Powiadomienia operacyjne</h3>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-[#04e0ff] px-2 py-0.5 text-[10px] font-black">
                          {unreadCount} nowe
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-[11px] font-bold text-cyan-600 hover:underline">
                        Oznacz przeczytane
                      </button>
                    )}
                  </div>

                  <div className="p-2 max-h-[380px] overflow-y-auto custom-scrollbar space-y-1">
                    {notifications.length > 0 ? notifications.map((n: any) => {
                      const isCritical = n.priorytet === 'krytyczny' || n.priorytet === 'wysoki';
                      return (
                        <div 
                          key={n.id} 
                          onClick={() => handleNotificationClick(n)} 
                          className={`p-3.5 rounded-2xl transition cursor-pointer flex items-start gap-3 group ${
                            !n.przeczytane 
                              ? 'bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-800/40' 
                              : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                            isCritical ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-[#04e0ff]'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-cyan-600 transition-colors">
                                {n.tytul}
                              </p>
                              <span className="text-[9px] font-bold text-slate-400 shrink-0">
                                {getTimeAgo(n.data_utworzenia)}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {n.tresc}
                            </p>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="p-8 text-center">
                        <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                        <p className="text-xs font-bold text-slate-500">Brak nowych powiadomień.</p>
                      </div>
                    )}
                  </div>

                  {/* PRZEJŚCIE DO PEŁNEGO CENTRUM POWIADOMIEŃ */}
                  <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-slate-950/50">
                    <button
                      onClick={() => { setIsNotifOpen(false); router.push('/dashboard/notifications'); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black text-slate-800 dark:text-white transition shadow-sm"
                    >
                      <Bell size={14} className="text-[#04e0ff]" />
                      Wszystkie powiadomienia i historia
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button className="hidden sm:flex ml-1 shadow-md shadow-[#04e0ff]/20" onClick={() => router.push('/dashboard/calendar')}>
              <Plus size={16} className="mr-1 inline" /> Szybki wpis
            </Button>
          </div>
        </header>

        {/* GŁÓWNA ZAWARTOŚĆ STRONY Z OBSŁUGĄ ACL */}
        <main className="px-4 lg:px-8 pb-8 flex-1 overflow-x-hidden">
          {!isAllowedToAccessCurrentRoute ? (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in-up">
               <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20">
                 <ShieldAlert size={48} strokeWidth={2.5}/>
               </div>
               <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">Dostęp zabroniony</h2>
               <p className="text-base font-bold text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                 Twoje konto lub przypisana rola nie posiada wystarczających uprawnień, aby uzyskać dostęp do tego modułu. Jeśli to błąd, skontaktuj się z administratorem.
               </p>
               <Button onClick={() => router.push('/dashboard')}>Wróć na Bezpieczny Kokpit</Button>
            </div>
          ) : (
            children
          )}
        </main>

        {/* ANIMOWANY TOAST POPUP (DOLNY PRAWY RÓG) */}
        {toastNotification && (
          <aside 
            aria-label="Powiadomienie systemowe"
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-500/30 rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-fade-in-up flex items-start gap-3"
          >
            <div className={`p-2 rounded-xl shrink-0 ${
              toastNotification.priorytet === 'krytyczny' || toastNotification.priorytet === 'wysoki'
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-[#04e0ff]'
            }`}>
              {toastNotification.priorytet === 'krytyczny' ? <AlertTriangle size={18} /> : <Bell size={18} />}
            </div>

            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleNotificationClick(toastNotification)}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                  toastNotification.priorytet === 'krytyczny' ? 'bg-rose-600 text-white' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-[#04e0ff]'
                }`}>
                  {toastNotification.priorytet}
                </span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {toastNotification.tytul}
                </p>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {toastNotification.tresc}
              </p>
              <span className="text-[9px] font-bold text-cyan-600 dark:text-[#04e0ff] mt-1 inline-block">
                Kliknij, aby otworzyć →
              </span>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setToastNotification(null); }} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X size={14} />
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}