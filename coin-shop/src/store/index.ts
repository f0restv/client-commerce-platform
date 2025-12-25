import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, CartItem, MetalPrices, User, FilterOptions } from '@/types';

// ==========================================
// CART STORE
// ==========================================

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        const items = get().items;
        const existingItem = items.find((item) => item.product.id === product.id);

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          set({ items: [...items, { product, quantity }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.product.id !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);

// ==========================================
// METAL PRICES STORE
// ==========================================

interface MetalPricesState {
  prices: MetalPrices | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  setPrices: (prices: MetalPrices) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchPrices: () => Promise<void>;
}

export const useMetalPricesStore = create<MetalPricesState>((set) => ({
  prices: null,
  loading: false,
  error: null,
  lastUpdated: null,

  setPrices: (prices) =>
    set({ prices, lastUpdated: new Date().toISOString(), error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  fetchPrices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/metals');
      if (!response.ok) throw new Error('Failed to fetch prices');
      const data = await response.json();
      set({
        prices: data,
        lastUpdated: new Date().toISOString(),
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },
}));

// ==========================================
// AUTH STORE
// ==========================================

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// ==========================================
// FILTER STORE
// ==========================================

interface FilterState {
  filters: FilterOptions;
  setFilter: <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => void;
  setFilters: (filters: Partial<FilterOptions>) => void;
  clearFilters: () => void;
}

const defaultFilters: FilterOptions = {
  sortBy: 'newest',
  listingType: 'all',
};

export const useFilterStore = create<FilterState>((set) => ({
  filters: defaultFilters,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  clearFilters: () => set({ filters: defaultFilters }),
}));

// ==========================================
// UI STORE
// ==========================================

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  cartOpen: boolean;
  searchOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  toggleCart: () => void;
  toggleSearch: () => void;
  closeAll: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  cartOpen: false,
  searchOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  toggleCart: () => set((state) => ({ cartOpen: !state.cartOpen })),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
  closeAll: () =>
    set({ mobileMenuOpen: false, cartOpen: false, searchOpen: false }),
}));
