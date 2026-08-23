import { create } from 'zustand';
import { api } from '../lib/api';

interface ZapytaniaState {
  items: any[];
  archivedItems: any[];
  isLoading: boolean;
  fetchItems: () => Promise<void>;
  fetchArchivedItems: () => Promise<void>;
  updateStatus: (id: number, status: string) => Promise<void>;
  archiveItem: (id: number) => Promise<void>;
}

export const useZapytaniaStore = create<ZapytaniaState>((set, get) => ({
  items: [],
  archivedItems: [],
  isLoading: false,

  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/api/zapytania');
      set({ items: res.data, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  fetchArchivedItems: async () => {
    try {
      const res = await api.get('/api/zapytania/archiwum');
      set({ archivedItems: res.data });
    } catch (error) {
      console.error(error);
    }
  },

  updateStatus: async (id: number, status: string) => {
    // Optymistyczna aktualizacja UI
    const previousItems = get().items;
    set({ items: previousItems.map(item => item.id === id ? { ...item, status } : item) });

    try {
      await api.patch(`/api/zapytania/${id}/status`, { status });
    } catch (error) {
      set({ items: previousItems }); // Rollback w przypadku błędu
      console.error(error);
    }
  },

  archiveItem: async (id: number) => {
    try {
      await api.put(`/api/zapytania/${id}/archiwizuj`, {});
      // Odświeżamy obie listy, by ukryć z aktywnych i pokazać w archiwum
      get().fetchItems();
      get().fetchArchivedItems();
    } catch (error) {
      console.error(error);
    }
  }
}));