import { create } from 'zustand';
import { api } from '../lib/api';

interface ServiceState {
  tickets: any[];
  statuses: any[];
  isLoading: boolean;
  fetchTickets: () => Promise<void>;
  fetchStatuses: () => Promise<void>;
}

export const useServiceStore = create<ServiceState>((set) => ({
  tickets: [],
  statuses: [],
  isLoading: false,

  fetchTickets: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/api/serwis');
      set({ tickets: res.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch service tickets', error);
      set({ isLoading: false });
    }
  },

  fetchStatuses: async () => {
    try {
      const res = await api.get('/api/serwis/statusy');
      set({ statuses: res.data });
    } catch (error) {
      console.error('Failed to fetch service statuses', error);
    }
  }
}));