'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Calendar, CheckSquare, Home, Users, Box, Wrench, Truck, Settings, FileText, 
  ChevronDown, LogOut, Star, Phone, Tags, Shield, Car, Palmtree, Palette, 
  ShieldAlert, Menu, Bell, Search, Sun, Moon, PanelLeftClose, PanelLeftOpen, Plus, Layers, Loader2, ArrowRight
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
  { icon: Settings, label: 'Ustawienia', requiredPermission: 'settings:view', children: [
    { label: 'Personalizacja systemu', href: '/dashboard/settings', icon: Settings },
    { label: 'Typy wydarzeń', href: '/dashboard/settings/event-types', icon: Palette },
    { label: 'Statusy operacyjne', href: '/dashboard/settings/statuses', icon: Tags },
    { label: 'Role i Uprawnienia', href: '/dashboard/settings/permissions', icon: Shield, requiredPermission: 'users:manage' }, 
  ]},
  { icon: Users, label: 'Użytkownicy', requiredPermission: 'users:manage', href: '/dashboard/users' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ Magazyn: true, Wydarzenia: true });
  const [isMounted, setIsMounted] = useState(false);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // WYSZUKIWARKA I POWIADOMIENIA
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);

  // TOP BAR (Ukrywanie)
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

    // Pobranie powiadomień startowych
    api.get('/api/dashboard/notifications').then(res => {
      setNotifications(res.data || []);
      if (res.data?.length > 0) setHasUnreadNotif(true);
    }).catch(console.error);

  }, [user, router]);

  // Wyszukiwarka bazy (Zastosowano Debounce by nie przeciążać bazy na każdą literę)
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
    }, 400); // 400ms opóźnienia
    
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

  // Lokalne filtrowanie nawigacji dla wyszukiwarki
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
        
        {/* TOP BAR WYSPA - CHOWAJĄCA SIĘ PRZY SCROLLU */}
        <header className={`sticky z-30 mx-4 lg:mx-8 mb-8 flex h-16 shrink-0 items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/80 sm:px-6 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isTopBarVisible ? 'top-4 translate-y-0 opacity-100' : 'top-4 -translate-y-[150%] opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-4">
            {/* Przycisk Menu Mobilnego */}
            <button className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* GLOBALNA WYSZUKIWARKA */}
            <div className="hidden sm:flex items-center relative group" ref={searchRef}>
              <Search size={16} className="absolute left-4 text-slate-400 group-focus-within:text-[#04e0ff] transition-colors" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Szukaj danych w systemie..." 
                className="pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-[#02080a] border border-transparent rounded-full text-sm font-semibold outline-none focus:bg-white focus:border-[#04e0ff]/50 focus:ring-4 focus:ring-[#04e0ff]/10 dark:focus:bg-[#02080a] dark:focus:border-[#04e0ff]/30 transition-all w-48 xl:w-[360px]" 
              />
              
              {/* Otwarty panel z wynikami */}
              {isSearchFocused && searchQuery.length >= 2 && (
                <div className="absolute top-full right-0 lg:left-0 mt-3 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden py-3 z-50 animate-fade-in-up flex flex-col max-h-[70vh]">
                  
                  {isSearchingDb && <div className="flex justify-center p-3"><Loader2 className="w-5 h-5 animate-spin text-[#04e0ff]"/></div>}
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                    
                    {/* Wyniki Nawigacyjne */}
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

                    {/* Wyniki z Bazy Danych */}
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

            {/* Motyw (Dark/Light) */}
            <button onClick={toggleTheme} className="p-2.5 text-slate-500 hover:text-[#04e0ff] transition-colors rounded-full hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-amber-400">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Powiadomienia Dropdown */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setIsNotifOpen(!isNotifOpen); setHasUnreadNotif(false); }} className={`relative p-2.5 transition-colors rounded-full ${isNotifOpen ? 'bg-cyan-50 text-[#04e0ff] dark:bg-white/5' : 'text-slate-500 hover:text-[#04e0ff] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                <Bell size={20} />
                {hasUnreadNotif && <span className="absolute top-2.5 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900"></span>}
              </button>
              
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-3 w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden z-50 animate-fade-in-up origin-top-right">
                  <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-transparent">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">Powiadomienia operacyjne</h3>
                  </div>
                  <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? notifications.map((n: any) => (
                      <div key={n.id} onClick={() => { router.push(n.url); setIsNotifOpen(false); }} className="p-4 rounded-2xl hover:bg-cyan-50 dark:hover:bg-white/5 transition cursor-pointer mb-1 group">
                        <div className="flex items-start gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.type === 'alert' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-[#04e0ff] shadow-[0_0_8px_#04e0ff]'}`}></div>
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug group-hover:text-cyan-600 transition-colors">{n.title}</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-wider">{getTimeAgo(n.time)}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-8 text-center">
                        <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
                        <p className="text-sm font-bold text-slate-500">Brak nowych powiadomień. Możesz spokojnie pracować!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Szybki Wpis do Kalendarza */}
            <Button className="hidden sm:flex ml-1 shadow-md shadow-[#04e0ff]/20" onClick={() => router.push('/dashboard/calendar')}>
              <Plus size={16} className="mr-1 inline" /> Szybki wpis
            </Button>
          </div>
        </header>

        {/* MAIN PAGE CONTENT */}
        <main className="px-4 lg:px-8 pb-8 flex-1 overflow-x-hidden">
          {!isAllowedToAccessCurrentRoute ? (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in-up">
               <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20">
                 <ShieldAlert size={48} strokeWidth={2.5}/>
               </div>
               <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">Dostęp zabroniony</h2>
               <p className="text-base font-bold text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                 Twoje konto, nałożone blokady lub przypisana rola nie posiada wystarczających uprawnień, aby uzyskać dostęp do tego modułu. Jeśli to błąd, skontaktuj się z administratorem.
               </p>
               <Button onClick={() => router.push('/dashboard')}>Wróć na Bezpieczny Kokpit</Button>
            </div>
          ) : (
            children
          )}
        </main>

      </div>
    </div>
  );
}