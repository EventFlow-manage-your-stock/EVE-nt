export const PERMISSIONS_LIST = [
  { id: 'dashboard:view', label: 'Dostęp do Kokpitu / Dashboardu', group: 'Ogólne' },
  { id: 'events:view', label: 'Przeglądanie listy wydarzeń', group: 'Wydarzenia' },
  { id: 'events:manage', label: 'Tworzenie, edycja i usuwanie wydarzeń', group: 'Wydarzenia' },
  { id: 'crm:view', label: 'Przeglądanie bazy klientów CRM', group: 'CRM' },
  { id: 'crm:manage', label: 'Zarządzanie bazą klientów CRM', group: 'CRM' },
  { id: 'warehouse:view', label: 'Podgląd stanów magazynowych i modeli', group: 'Magazyn' },
  { id: 'warehouse:manage', label: 'Generowanie WZ/PZ, edycja bazy sprzętu', group: 'Magazyn' },
  { id: 'service:view', label: 'Przeglądanie zgłoszeń serwisowych', group: 'Serwis' },
  { id: 'service:manage', label: 'Zarządzanie usterkami i serwisem', group: 'Serwis' },
  { id: 'fleet:view', label: 'Podgląd pojazdów w flocie', group: 'Flota' },
  { id: 'fleet:manage', label: 'Zarządzanie flotą (przeglądy, OC)', group: 'Flota' },
  { id: 'offers:view', label: 'Przeglądanie ofert (dostępne wyceny)', group: 'Oferty' },
  { id: 'offers:manage', label: 'Tworzenie, edycja i wysyłanie ofert', group: 'Oferty' },
  { id: 'settings:view', label: 'Podgląd ustawień systemu', group: 'Ustawienia i System' },
  { id: 'settings:manage', label: 'Pełne zarządzanie konfiguracją systemu', group: 'Ustawienia i System' },
  { id: 'users:manage', label: 'Dostęp do bazy pracowników i ról (HR)', group: 'Ustawienia i System' },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS_LIST.map(p => p.group)));