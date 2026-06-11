// lib/api.ts — todas las consultas a Supabase
import { createClient } from './supabase/client'
import type {
  Transaction, TransactionFormData, TransactionFull,
  Account, Category, Budget, PaymentMethod, Investment,
  MonthSummary, CategoryExpense, MonthlyEvolution, SearchFilters
} from '@/types'

const sb = () => createClient()

// ============================================================
// TRANSACCIONES
// ============================================================

export async function getTransactions(filters?: SearchFilters, limit = 50, offset = 0) {
  let q = sb()
    .from('transactions_full')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters?.type && filters.type !== 'all') q = q.eq('type', filters.type)
  if (filters?.account_id) q = q.eq('account_id', filters.account_id)
  if (filters?.category_id) q = q.eq('category_id', filters.category_id)
  if (filters?.payment_method_id) q = q.eq('payment_method_id', filters.payment_method_id)
  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters?.date_from) q = q.gte('date', filters.date_from)
  if (filters?.date_to) q = q.lte('date', filters.date_to)
  if (filters?.amount_min) q = q.gte('amount', filters.amount_min)
  if (filters?.amount_max) q = q.lte('amount', filters.amount_max)
  if (filters?.query) q = q.ilike('description', `%${filters.query}%`)

  const { data, error, count } = await q
  if (error) throw error
  return { data: data as TransactionFull[], count }
}

export async function getTransactionById(id: string) {
  const { data, error } = await sb()
    .from('transactions_full')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as TransactionFull
}

export async function createTransaction(form: TransactionFormData, userId: string) {
  // Si tiene cuotas, usar la función SQL
  if (form.has_installments && form.installments_total && form.installments_total > 1) {
    const { data, error } = await sb().rpc('create_installments', {
      p_user_id: userId,
      p_account_id: form.account_id,
      p_category_id: form.category_id || null,
      p_subcategory_id: form.subcategory_id || null,
      p_payment_method_id: form.payment_method_id || null,
      p_description: form.description,
      p_total_amount: parseFloat(form.amount),
      p_installments: form.installments_total,
      p_start_date: form.date,
      p_notes: form.notes || null,
    })
    if (error) throw error
    return data
  }

  const { data, error } = await sb()
    .from('transactions')
    .insert({
      account_id: form.account_id,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      payment_method_id: form.payment_method_id || null,
      type: form.type,
      amount: parseFloat(form.amount),
      date: form.date,
      description: form.description,
      notes: form.notes || null,
      transfer_to_account_id: form.transfer_to_account_id || null,
      is_recurring: form.is_recurring || false,
      recurrence_rule: form.recurrence_rule || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  const { data, error } = await sb()
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id: string) {
  const { error } = await sb()
    .from('transactions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function deleteInstallmentGroup(parentId: string) {
  // Eliminar cuota padre + todas las cuotas hijas
  const { error } = await sb()
    .from('transactions')
    .delete()
    .or(`id.eq.${parentId},parent_transaction_id.eq.${parentId}`)
  if (error) throw error
}

// ============================================================
// DASHBOARD
// ============================================================

export async function getMonthSummary(year: number, month: number) {
  const { data, error } = await sb().rpc('get_month_summary', {
    p_year: year,
    p_month: month,
  })
  if (error) throw error
  return data?.[0] as MonthSummary | undefined
}

export async function getExpensesByCategory(startDate: string, endDate: string) {
  const { data, error } = await sb().rpc('get_expenses_by_category', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw error
  return data as CategoryExpense[]
}

export async function getMonthlyEvolution(months = 12) {
  const { data, error } = await sb().rpc('get_monthly_evolution', {
    p_months: months,
  })
  if (error) throw error
  return data as MonthlyEvolution[]
}

// ============================================================
// CUENTAS
// ============================================================

export async function getAccounts() {
  const { data, error } = await sb()
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data as Account[]
}

export async function upsertAccount(account: Partial<Account>) {
  const { data, error } = await sb()
    .from('accounts')
    .upsert(account)
    .select()
    .single()
  if (error) throw error
  return data as Account
}

export async function deleteAccount(id: string) {
  const { error } = await sb()
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
// CATEGORÍAS
// ============================================================

export async function getCategories() {
  const { data, error } = await sb()
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data as Category[]
}

export async function upsertCategory(category: Partial<Category>) {
  const { data, error } = await sb()
    .from('categories')
    .upsert(category)
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string) {
  const { error } = await sb()
    .from('categories')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function reorderCategories(ids: string[]) {
  const updates = ids.map((id, index) => ({ id, sort_order: index }))
  const { error } = await sb().from('categories').upsert(updates)
  if (error) throw error
}

// ============================================================
// PRESUPUESTOS
// ============================================================

export async function getBudgets() {
  const { data, error } = await sb()
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .order('created_at')
  if (error) throw error
  return data as Budget[]
}

export async function upsertBudget(budget: Partial<Budget>) {
  const { data, error } = await sb()
    .from('budgets')
    .upsert(budget)
    .select()
    .single()
  if (error) throw error
  return data as Budget
}

export async function deleteBudget(id: string) {
  const { error } = await sb()
    .from('budgets')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
// MEDIOS DE PAGO
// ============================================================

export async function getPaymentMethods() {
  const { data, error } = await sb()
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data as PaymentMethod[]
}

export async function upsertPaymentMethod(pm: Partial<PaymentMethod>) {
  const { data, error } = await sb()
    .from('payment_methods')
    .upsert(pm)
    .select()
    .single()
  if (error) throw error
  return data as PaymentMethod
}

// ============================================================
// INVERSIONES
// ============================================================

export async function getInvestments() {
  const { data, error } = await sb()
    .from('investments')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Investment[]).map(inv => ({
    ...inv,
    current_value: inv.current_price != null ? inv.quantity * inv.current_price : null,
    profit_loss: inv.current_price != null
      ? (inv.current_price - inv.buy_price) * inv.quantity
      : null,
    profit_loss_pct: inv.current_price != null
      ? ((inv.current_price - inv.buy_price) / inv.buy_price) * 100
      : null,
  }))
}

export async function upsertInvestment(inv: Partial<Investment>) {
  const { data, error } = await sb()
    .from('investments')
    .upsert(inv)
    .select()
    .single()
  if (error) throw error
  return data as Investment
}

// ============================================================
// EXPORTACIÓN
// ============================================================

export async function getAllTransactionsForExport(dateFrom?: string, dateTo?: string) {
  let q = sb()
    .from('transactions_full')
    .select('*')
    .order('date', { ascending: false })
  if (dateFrom) q = q.gte('date', dateFrom)
  if (dateTo) q = q.lte('date', dateTo)
  const { data, error } = await q
  if (error) throw error
  return data as TransactionFull[]
}
