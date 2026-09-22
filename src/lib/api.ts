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

// Editar un movimiento ya cargado con los datos del formulario. No toca
// cuotas: eso pasa por updateInstallments.
export async function updateTransactionFromForm(id: string, form: TransactionFormData) {
  const isTransfer = form.type === 'transfer'
  return updateTransaction(id, {
    type: form.type,
    amount: parseFloat(form.amount),
    date: form.date,
    description: form.description,
    account_id: form.account_id,
    category_id: isTransfer ? null : form.category_id || null,
    subcategory_id: isTransfer ? null : form.subcategory_id || null,
    transfer_to_account_id: isTransfer ? form.transfer_to_account_id || null : null,
    is_recurring: isTransfer ? false : !!form.is_recurring,
    payment_method_id: form.payment_method_id || null,
    notes: form.notes || null,
  })
}

// ---- Cuotas ----

const pad2 = (n: number) => String(n).padStart(2, '0')

// Suma meses a "YYYY-MM-DD" igual que Postgres con INTERVAL '1 month':
// si el día no existe en el mes destino (31 de febrero), usa el último.
function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(ny, nm, 0).getDate()
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`
}

// "Heladera (3/12)" -> "Heladera"
function stripInstallmentSuffix(desc: string) {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, '')
}

// Cambia la cantidad de cuotas de un gasto (o pasa un gasto normal a cuotas).
// Borra las cuotas que sobran, crea las que faltan y renumera todas.
// applyToAll: monto, descripción, cuenta, categoría y fechas van a todas las
// cuotas; si no, solo a la cuota editada y a las nuevas.
export async function updateInstallments(
  edited: Transaction, form: TransactionFormData, newTotal: number, applyToAll: boolean
) {
  const k = edited.installments_total > 1 ? edited.installment_number : 1
  if (newTotal < k) {
    throw new Error(`Estás editando la cuota ${k}: no puede haber menos de ${k} cuotas`)
  }
  const parentId = edited.parent_transaction_id || edited.id

  const { data, error } = await sb()
    .from('transactions')
    .select('*')
    .or(`id.eq.${parentId},parent_transaction_id.eq.${parentId}`)
  if (error) throw error
  const rows = data as Transaction[]
  const byNumber = new Map(rows.map(r => [r.installment_number, r]))
  const parent = byNumber.get(1) || edited
  const base = stripInstallmentSuffix(form.description)
  const amount = parseFloat(form.amount)
  // Si no se tocó la fecha, cada cuota conserva la suya y las nuevas siguen a
  // la primera. Recalcular desde la cuota editada correría fechas ya ajustadas
  // a fin de mes (una compra del 31 tiene cuotas el 28 o el 30).
  const dateUnchanged = form.date === edited.date

  const toDelete = rows.filter(r => r.installment_number > newTotal).map(r => r.id)
  if (toDelete.length > 0) {
    const { error: delError } = await sb().from('transactions').delete().in('id', toDelete)
    if (delError) throw delError
  }

  const upserts = []
  for (let i = 1; i <= newTotal; i++) {
    const row = byNumber.get(i)
    const fromForm = applyToAll || !row || row.id === edited.id
    const desc = fromForm ? base : stripInstallmentSuffix(row!.description)
    upserts.push({
      id: row?.id ?? crypto.randomUUID(),
      user_id: edited.user_id,
      type: 'expense' as const,
      account_id: fromForm ? form.account_id : row!.account_id,
      category_id: fromForm ? form.category_id || null : row!.category_id,
      subcategory_id: fromForm ? form.subcategory_id || null : row!.subcategory_id,
      payment_method_id: fromForm ? form.payment_method_id || null : row!.payment_method_id,
      notes: fromForm ? form.notes || null : row!.notes,
      amount: fromForm ? amount : row!.amount,
      date: row && (dateUnchanged || !fromForm)
        ? row.date
        : dateUnchanged ? addMonthsISO(parent.date, i - 1) : addMonthsISO(form.date, i - k),
      description: newTotal > 1 ? `${desc} (${i}/${newTotal})` : desc,
      installments_total: newTotal,
      installment_number: i,
      parent_transaction_id: i === 1 ? null : parentId,
      status: row ? row.status : 'pending',
      is_recurring: fromForm ? !!form.is_recurring : row!.is_recurring,
    })
  }

  const { error: upError } = await sb().from('transactions').upsert(upserts)
  if (upError) throw upError
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

// Borra y devuelve lo borrado, para poder deshacer con restoreTransactions.
// group: el id de la primera cuota; borra el grupo entero.
export async function deleteTransactionsForUndo(target: { id: string } | { group: string }) {
  const filter = 'group' in target
    ? `id.eq.${target.group},parent_transaction_id.eq.${target.group}`
    : `id.eq.${target.id}`
  const { data, error } = await sb().from('transactions').select('*').or(filter)
  if (error) throw error
  const { error: delError } = await sb().from('transactions').delete().or(filter)
  if (delError) throw delError
  return data as Transaction[]
}

// Vuelve a insertar filas borradas, con sus mismos ids. La primera cuota va
// primero porque las demás la referencian. El trigger de saldos recalcula
// las cuentas igual que al cargarlas.
export async function restoreTransactions(rows: Transaction[]) {
  const sorted = [...rows].sort((a, b) => (a.parent_transaction_id ? 1 : 0) - (b.parent_transaction_id ? 1 : 0))
  const { error } = await sb().from('transactions').insert(sorted)
  if (error) throw error
}

// Movimientos de un rango largo con solo las columnas que hacen falta para
// sumar. Supabase corta cada respuesta en 1000 filas: se pide por páginas.
export interface TransactionLite {
  type: Transaction['type']
  amount: number
  date: string
  category_id: string | null
  status: Transaction['status']
  is_recurring: boolean
  installments_total: number
  description: string
}

export async function getTransactionsLite(dateFrom: string, dateTo: string) {
  const PAGE = 1000
  const rows: TransactionLite[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb()
      .from('transactions')
      .select('type, amount, date, category_id, status, is_recurring, installments_total, description')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data as TransactionLite[]))
    if (!data || data.length < PAGE) break
  }
  return rows
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

// ---- Saldos ----
//
// current_balance = initial_balance + suma de los movimientos, y lo recalcula
// un trigger que solo se dispara cuando cambia un movimiento. Por eso, cuando
// tocamos el saldo inicial desde acá, hay que mover el actual por la misma
// diferencia: si no, la pantalla sigue mostrando el número viejo hasta que se
// cargue el próximo gasto.

async function getBalances(id: string) {
  const { data, error } = await sb()
    .from('accounts')
    .select('initial_balance, current_balance')
    .eq('id', id)
    .single()
  if (error) throw error
  return {
    initial: Number(data.initial_balance),
    current: Number(data.current_balance),
  }
}

// "Tengo $X en esta cuenta": calcula el saldo inicial que hace que el saldo
// actual dé exactamente X, sin tocar ningún movimiento.
export async function adjustAccountBalance(id: string, target: number) {
  const { initial, current } = await getBalances(id)
  const newInitial = target - current + initial
  const { error } = await sb()
    .from('accounts')
    .update({ initial_balance: newInitial, current_balance: target })
    .eq('id', id)
  if (error) throw error
  return { newInitial, previous: current }
}

// Editar el saldo inicial a mano (desde el formulario de la cuenta).
export async function setInitialBalance(id: string, newInitial: number) {
  const { initial, current } = await getBalances(id)
  if (newInitial === initial) return
  const { error } = await sb()
    .from('accounts')
    .update({ initial_balance: newInitial, current_balance: current + (newInitial - initial) })
    .eq('id', id)
  if (error) throw error
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

// Todas las filas de presupuesto (intervalos). Se escriben solo con
// planBudgetWrites + applyBudgetWrites, que nunca tocan meses pasados.
export async function getBudgets() {
  const { data, error } = await sb()
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .order('created_at')
  if (error) throw error
  return data as Budget[]
}

// ---- Presupuesto por mes (docs/ux/05-PRESUPUESTO.md) ----

export interface MonthPlan {
  year: number
  month: number
  expected_income: number | null
  savings_target: number
}

// La tabla month_plans la crea sql/migrations/001_presupuesto_por_mes.sql.
// Si todavía no se corrió, la app sigue andando sin ingreso esperado ni ahorro.
function isMissingTable(error: { code?: string; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /month_plans/.test(error.message || '')
}

export async function getMonthPlans(): Promise<{ plans: MonthPlan[]; missing: boolean }> {
  const { data, error } = await sb()
    .from('month_plans')
    .select('year, month, expected_income, savings_target')
  if (error) {
    if (isMissingTable(error)) return { plans: [], missing: true }
    throw error
  }
  return {
    plans: (data || []).map(p => ({
      ...p,
      expected_income: p.expected_income === null ? null : Number(p.expected_income),
      savings_target: Number(p.savings_target || 0),
    })),
    missing: false,
  }
}

export async function saveMonthPlan(plan: MonthPlan) {
  const { error } = await sb()
    .from('month_plans')
    .upsert({ ...plan, updated_at: new Date().toISOString() }, { onConflict: 'user_id,year,month' })
  if (error) throw error
}

// Filas de budgets para escribir en un solo viaje: las que cambian (con id) y
// las nuevas; y los ids que sobran. Ver planBudgetWrites en lib/budget.ts.
export async function applyBudgetWrites(upserts: Partial<Budget>[], deleteIds: string[]) {
  // Primero lo que queda (nunca choca: las filas nuevas reutilizan el id de
  // la que tenía la misma fecha de inicio), después lo que sobra.
  if (upserts.length) {
    const { error } = await sb().from('budgets').upsert(upserts, { onConflict: 'id' })
    if (error) throw error
  }
  if (deleteIds.length) {
    const { error } = await sb().from('budgets').delete().in('id', deleteIds)
    if (error) throw error
  }
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
