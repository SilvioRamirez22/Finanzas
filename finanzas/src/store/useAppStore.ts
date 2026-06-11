// store/useAppStore.ts
import { create } from 'zustand'
import { Account, Category, PaymentMethod, Budget, Profile } from '@/types'

interface AppState {
  // Datos del usuario
  profile: Profile | null
  accounts: Account[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  budgets: Budget[]

  // UI state
  isLoading: boolean
  sidebarOpen: boolean
  quickAddOpen: boolean

  // Setters
  setProfile: (profile: Profile | null) => void
  setAccounts: (accounts: Account[]) => void
  setCategories: (categories: Category[]) => void
  setPaymentMethods: (methods: PaymentMethod[]) => void
  setBudgets: (budgets: Budget[]) => void
  setLoading: (loading: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void

  // Derived
  totalBalance: () => number
  expenseCategories: () => Category[]
  incomeCategories: () => Category[]
  rootCategories: () => Category[]
  categoriesWithSubs: () => Category[]
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  accounts: [],
  categories: [],
  paymentMethods: [],
  budgets: [],
  isLoading: false,
  sidebarOpen: false,
  quickAddOpen: false,

  setProfile: (profile) => set({ profile }),
  setAccounts: (accounts) => set({ accounts }),
  setCategories: (categories) => set({ categories }),
  setPaymentMethods: (paymentMethods) => set({ paymentMethods }),
  setBudgets: (budgets) => set({ budgets }),
  setLoading: (isLoading) => set({ isLoading }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),

  totalBalance: () => {
    const { accounts } = get()
    return accounts
      .filter(a => a.is_active && !a.exclude_from_totals)
      .reduce((sum, a) => sum + a.current_balance, 0)
  },

  expenseCategories: () => {
    const { categories } = get()
    return categories.filter(c => c.type !== 'income' && !c.parent_id && c.is_active)
  },

  incomeCategories: () => {
    const { categories } = get()
    return categories.filter(c => c.type !== 'expense' && !c.parent_id && c.is_active)
  },

  rootCategories: () => {
    const { categories } = get()
    return categories.filter(c => !c.parent_id && c.is_active)
  },

  categoriesWithSubs: () => {
    const { categories } = get()
    const roots = categories.filter(c => !c.parent_id && c.is_active)
    return roots.map(root => ({
      ...root,
      subcategories: categories.filter(c => c.parent_id === root.id && c.is_active)
    }))
  },
}))
