import { create } from 'zustand';
import { api } from '../lib/api';

interface ItemsState {
  items: any[];
  isLoading: boolean;
  filters: {
    searchItem: string;
    searchModel: string;
    searchCategory: string;
  };
  fetchItems: () => Promise<void>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  deleteItem: (id: number) => Promise<void>;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  isLoading: false,
  filters: {
    searchItem: '',
    searchModel: '',
    searchCategory: '',
  },

  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.searchItem) params.append('searchItem', filters.searchItem);
      if (filters.searchModel) params.append('searchModel', filters.searchModel);
      if (filters.searchCategory) params.append('searchCategory', filters.searchCategory);

      const res = await api.get(`/api/magazyn/wszystkie-egzemplarze?${params.toString()}`);
      set({ items: res.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch items', error);
      set({ isLoading: false });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
    get().fetchItems();
  },

  resetFilters: () => {
    set({ filters: { searchItem: '', searchModel: '', searchCategory: '' } });
    get().fetchItems();
  },

  deleteItem: async (id: number) => {
    try {
      await api.delete(`/api/magazyn/egzemplarze/${id}`);
      get().fetchItems();
    } catch (error) {
      console.error('Failed to delete item', error);
    }
  }
}));