import { create } from 'zustand';
import { api } from '../lib/api';

interface CrmState {
  clients: any[];
  isLoading: boolean;
  fetchClients: (search?: string) => Promise<void>;
}

export const useCrmStore = create<CrmState>((set) => ({
  clients: [],
  isLoading: false,

  fetchClients: async (search = '') => {
    set({ isLoading: true });
    try {
      const url = search ? `/api/crm/kontrahenci?search=${search}` : '/api/crm/kontrahenci';
      const res = await api.get(url);
      set({ clients: res.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch clients', error);
      set({ isLoading: false });
    }
  }
}));