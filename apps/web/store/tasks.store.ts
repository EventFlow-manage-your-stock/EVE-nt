import { create } from 'zustand';
import { api } from '../lib/api';

interface TasksState {
  tasks: any[];
  dictionaries: any;
  isLoading: boolean;
  filters: {
    tab: string;
    search: string;
    type: string;
    status: string;
    overdue: boolean;
    eventId: string;
    userId: string;
    sortBy: string;
  };
  fetchTasks: () => Promise<void>;
  fetchDictionaries: () => Promise<void>;
  setFilter: (key: string, value: any) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  dictionaries: { uzytkownicy: [], wydarzenia: [], kontrahenci: [], egzemplarze: [], pojazdy: [] },
  isLoading: false,
  filters: {
    tab: 'moje',
    search: '',
    type: '',
    status: '',
    overdue: false,
    eventId: '',
    userId: '',
    sortBy: 'date_desc'
  },

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const res = await api.get(`/api/zadania?${params.toString()}`);
      set({ tasks: res.data, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  fetchDictionaries: async () => {
    try {
      const res = await api.get('/api/zadania/slowniki');
      set({ dictionaries: res.data });
    } catch (error) {
      console.error(error);
    }
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    get().fetchTasks();
  },
}));