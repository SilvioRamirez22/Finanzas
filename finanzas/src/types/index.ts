// ============================================================
// TIPOS TYPESCRIPT — Finanzas Personales
// ============================================================

export type Currency = 'ARS' | 'USD' | 'EUR' | 'BRL'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'confirmed' | 'pending' | 'cancelled'
export type AccountType = 'cash' | 'bank' | 'digital_wallet' | 'credit_card' | 'investment' | 'savings' | 'other'
export type CategoryType = 'expense' | 'income' | 'both'
export type PaymentMethodType = 'cash' | 'debit_card' | 'credit_card' | 'transfer' | 'digital_wallet' | 'other'
export type InvestmentType = 'stock' | 'cedear' | 'mutual_fund' | 'crypto' | 'bond' | 'other'
export type BudgetPeriod = 'monthly' | 'yearly'

// ---- Perfil ----
export interface Profile {
  id: string
  email: string
  full_name: string | null
  currency: Currency
  locale: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ---- Cuenta ----
export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: Currency
  initial_balance: number
  current_balance: number
  credit_limit: number | null
  closing_day: number | null
  due_day: number | null
  color: string
  icon: string
  is_active: boolean
  exclude_from_totals: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ---- Categoría ----
export interface Category {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  icon: string
  color: string
  type: CategoryType
  sort_order: number
  is_active: boolean
  created_at: string
  subcategories?: Category[]
}

// ---- Medio de pago ----
export interface PaymentMethod {
  id: string
  user_id: string
  name: string
  type: PaymentMethodType
  sort_order: number
  is_active: boolean
  created_at: string
}

// ---- Presupuesto ----
export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: BudgetPeriod
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  // Joined
  category?: Category
  spent?: number
  percentage?: number
}

// ---- Transacción ----
export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  type: TransactionType
  amount: number
  date: string
  description: string
  notes: string | null
  installments_total: number
  installment_number: number
  parent_transaction_id: string | null
  transfer_to_account_id: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_end_date: string | null
  status: TransactionStatus
  created_at: string
  updated_at: string
}

// Transacción con joins
export interface TransactionFull extends Transaction {
  account_name: string
  account_color: string
  account_icon: string
  account_type: AccountType
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  subcategory_name: string | null
  payment_method_name: string | null
  payment_method_type: PaymentMethodType | null
  transfer_to_account_name: string | null
}

// ---- Form: nueva transacción ----
export interface TransactionFormData {
  type: TransactionType
  amount: string
  date: string
  description: string
  account_id: string
  category_id: string
  subcategory_id?: string
  payment_method_id?: string
  notes?: string
  // Cuotas
  has_installments: boolean
  installments_total?: number
  // Transferencia
  transfer_to_account_id?: string
  // Recurrencia
  is_recurring?: boolean
  recurrence_rule?: string
}

// ---- Inversión ----
export interface Investment {
  id: string
  user_id: string
  account_id: string | null
  ticker: string
  name: string | null
  type: InvestmentType
  quantity: number
  buy_price: number
  buy_date: string
  current_price: number | null
  current_price_updated_at: string | null
  currency: Currency
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Calculados
  current_value?: number
  profit_loss?: number
  profit_loss_pct?: number
}

// ---- Dashboard ----
export interface MonthSummary {
  total_income: number
  total_expenses: number
  net_balance: number
  transaction_count: number
}

export interface CategoryExpense {
  category_id: string
  category_name: string
  category_color: string
  category_icon: string
  total: number
  transaction_count: number
  budget_amount: number | null
  budget_percentage: number | null
}

export interface MonthlyEvolution {
  year: number
  month: number
  month_label: string
  total_income: number
  total_expenses: number
  net_balance: number
}

// ---- Filtros de búsqueda ----
export interface SearchFilters {
  query?: string
  type?: TransactionType | 'all'
  account_id?: string
  category_id?: string
  payment_method_id?: string
  status?: TransactionStatus | 'all'
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
}

// ---- Snapshot mensual ----
export interface MonthSnapshot {
  id: string
  user_id: string
  year: number
  month: number
  total_income: number
  total_expenses: number
  net_balance: number
  balances_by_account: Record<string, number>
  expenses_by_category: Record<string, number>
  created_at: string
}

// ---- UI helpers ----
export interface SelectOption {
  value: string
  label: string
  color?: string
  icon?: string
}

export type DateRange = '1m' | '3m' | '6m' | '12m' | 'ytd' | 'all'
