import { create } from 'zustand';
import { api } from '../lib/api';

interface ModelsState {
  models: any[];
  categories: any[];
  isLoading: boolean;
  filters: {
    search: string;
    widocznyWMag: string;
    widocznyWOfercie: string;
    kategoriaId: string;
  };
  fetchModels: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  deleteModel: (id: number) => Promise<void>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  categories: [],
  isLoading: false,
  filters: {
    search: '',
    widocznyWMag: '',
    widocznyWOfercie: '',
    kategoriaId: '',
  },

  fetchModels: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.widocznyWMag) params.append('widocznyWMag', filters.widocznyWMag);
      if (filters.widocznyWOfercie) params.append('widocznyWOfercie', filters.widocznyWOfercie);
      if (filters.kategoriaId) params.append('kategoriaId', filters.kategoriaId);

      const res = await api.get(`/api/magazyn/modele?${params.toString()}`);
      set({ models: res.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch models', error);
      set({ isLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const res = await api.get('/api/magazyn/kategorie');
      // Rozpłaszczamy drzewo kategorii, jeśli są zagnieżdżone
      const flattened = res.data.flatMap((kat: any) => [kat, ...(kat.dzieci || [])]);
      set({ categories: flattened });
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
    get().fetchModels(); // Automatyczne przeładowanie po zmianie filtru
  },

  resetFilters: () => {
    set({ filters: { search: '', widocznyWMag: '', widocznyWOfercie: '', kategoriaId: '' } });
    get().fetchModels();
  },

  deleteModel: async (id: number) => {
    try {
      await api.delete(`/api/magazyn/modele/${id}`);
      get().fetchModels();
    } catch (error) {
      console.error('Failed to delete model', error);
    }
  }
}));