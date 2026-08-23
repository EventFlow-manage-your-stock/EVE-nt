import { create } from 'zustand';
import { api } from '../lib/api';

interface EventsState {
  events: any[];
  clients: any[];
  managers: any[];
  isLoading: boolean;
  filters: {
    search: string;
    clientId: string;
    managerId: string;
    miesiacKsiegowania: string;
  };
  fetchEvents: () => Promise<void>;
  fetchDictionaries: () => Promise<void>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  clients: [],
  managers: [],
  isLoading: false,
  filters: {
    search: '',
    clientId: '',
    managerId: '',
    miesiacKsiegowania: '',
  },

  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.clientId) params.append('clientId', filters.clientId);
      if (filters.managerId) params.append('managerId', filters.managerId);
      if (filters.miesiacKsiegowania) params.append('miesiacKsiegowania', filters.miesiacKsiegowania);

      const res = await api.get(`/api/wydarzenia?${params.toString()}`);
      set({ events: res.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch events', error);
      set({ isLoading: false });
    }
  },

  fetchDictionaries: async () => {
    try {
      const res = await api.get('/api/wydarzenia/slowniki-filtrow');
      set({ clients: res.data.klienci, managers: res.data.managerowie });
    } catch (error) {
      console.error('Failed to fetch dictionaries', error);
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
    get().fetchEvents(); // Automatyczne przeładowanie po zmianie filtru
  },

  resetFilters: () => {
    set({ filters: { search: '', clientId: '', managerId: '', miesiacKsiegowania: '' } });
    get().fetchEvents();
  }
}));