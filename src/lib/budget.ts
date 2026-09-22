// Presupuesto por mes (docs/ux/05-PRESUPUESTO.md). Cálculos puros: nada
// consulta la base acá.
//
// Modelo: cada fila de `budgets` dice "desde start_date (hasta end_date, o
// para siempre) el tope de esta categoría es amount". El tope de un mes es el
// de la fila que lo cubre con el start_date más nuevo. Un monto 0 significa
// "sin presupuesto ese mes".
import type { Budget } from '@/types'
import { pendingFixed } from './fixed'

const pad = (n: number) => String(n).padStart(2, '0')
export const firstDay = (y: number, m: number) => `${y}-${pad(m)}-01`
export const lastDay = (y: number, m: number) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`
export function shift(y: number, m: number, delta: number) {
  const d = new Date(y, m - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
export const monthKey = (y: number, m: number) => `${y}-${pad(m)}`

type BudgetRow = Pick<Budget, 'id' | 'category_id' | 'amount' | 'start_date' | 'end_date' | 'is_active'>

// categoría -> tope vigente en el mes (solo las que tienen tope > 0)
export function budgetsForMonth(rows: BudgetRow[], y: number, m: number) {
  const d0 = firstDay(y, m), d1 = lastDay(y, m)
  const best = new Map<string, BudgetRow>()
  for (const r of rows) {
    if (!r.is_active || r.start_date > d1 || (r.end_date && r.end_date < d0)) continue
    const cur = best.get(r.category_id)
    if (!cur || r.start_date > cur.start_date) best.set(r.category_id, r)
  }
  const out = new Map<string, number>()
  best.forEach((r, id) => { if (Number(r.amount) > 0) out.set(id, Number(r.amount)) })
  return out
}

// ---- Escribir un cambio sin reescribir el pasado ----

export type BudgetMode = 'forward' | 'only'

// Devuelve qué filas guardar (con id: se actualizan; sin id existente: nuevas)
// y cuáles borrar, para poner `amount` en la categoría desde el mes (forward)
// o solo en ese mes (only). Nunca toca meses anteriores.
export function planBudgetWrites(
  rows: (BudgetRow & Partial<Budget>)[], userId: string, categoryId: string,
  amount: number, y: number, m: number, mode: BudgetMode,
) {
  const d0 = firstDay(y, m), d1 = lastDay(y, m)
  const prevEnd = lastDay(shift(y, m, -1).year, shift(y, m, -1).month)
  const mine = rows.filter(r => r.category_id === categoryId)
  const upserts: Partial<Budget>[] = []
  const deletes: string[] = []
  const row = (r: Partial<Budget>) => ({
    user_id: userId, category_id: categoryId, period: 'monthly' as const, is_active: true, ...r,
  })
  const sameStart = mine.find(r => r.start_date === d0)

  if (mode === 'forward') {
    for (const r of mine) {
      // Lo que empezó antes y sigue vigente: se cierra el mes anterior.
      if (r.start_date < d0 && (!r.end_date || r.end_date >= d0)) {
        upserts.push(row({ id: r.id, amount: r.amount, start_date: r.start_date, end_date: prevEnd }))
      }
      // Lo que empezaba este mes o después queda reemplazado.
      if (r.start_date >= d0 && r !== sameStart) deletes.push(r.id)
    }
    if (amount > 0) {
      upserts.push(row({ id: sameStart?.id ?? crypto.randomUUID(), amount, start_date: d0, end_date: null }))
    } else if (sameStart) {
      deletes.push(sameStart.id)
    }
    return { upserts, deletes }
  }

  // Solo este mes: una fila que empieza y termina en el mes. Gana porque es la
  // que empieza más tarde; el mes siguiente vuelve a regir lo que había.
  if (sameStart && (!sameStart.end_date || sameStart.end_date > d1)) {
    // Había un cambio "desde este mes": se parte en este mes + el resto.
    upserts.push(row({ id: sameStart.id, amount, start_date: d0, end_date: d1 }))
    const next = shift(y, m, 1)
    const nextStart = firstDay(next.year, next.month)
    if (!mine.some(r => r.start_date === nextStart)) {
      upserts.push(row({ id: crypto.randomUUID(), amount: sameStart.amount, start_date: nextStart, end_date: sameStart.end_date }))
    }
  } else {
    upserts.push(row({ id: sameStart?.id ?? crypto.randomUUID(), amount, start_date: d0, end_date: d1 }))
  }
  return { upserts, deletes }
}

// ---- Resumen de un mes ----

export interface TxForBudget {
  type: string
  amount: number
  date: string
  category_id: string | null
  status: string
  is_recurring: boolean
  installments_total: number
  description: string
}

export interface CategoryLine {
  id: string
  budget: number        // 0 = sin tope ese mes
  spent: number         // todo el gasto de la categoría
  fixed: number         // de eso, gastos fijos
  installments: number  // de eso, cuotas
  variable: number      // lo que el tope controla: spent − fijos − cuotas
  avg3: number          // gasto variable promedio de los 3 meses anteriores
}

export interface MonthBudget {
  year: number
  month: number
  lines: CategoryLine[]
  budgetedVariable: number   // suma de topes
  variableOnBudgeted: number // gasto variable de las categorías con tope
  variableUnbudgeted: number // gasto variable fuera del plan
  fixedSpent: number
  fixedPending: number       // fijos del mes anterior que todavía no se cargaron
  installments: number
  committed: number          // fijos (cargados + pendientes) + cuotas
  plannedTotal: number       // comprometido + topes
  spentTotal: number
  hasBudget: boolean
}

const isFixed = (t: TxForBudget) => t.is_recurring && !(t.installments_total > 1)
const isInstallment = (t: TxForBudget) => t.installments_total > 1

function expensesOf(txs: TxForBudget[], y: number, m: number) {
  const key = monthKey(y, m)
  return txs.filter(t => t.type === 'expense' && t.status !== 'cancelled' && t.date.startsWith(key))
}

// txs debe incluir el mes, el anterior (para los fijos pendientes) y los 3
// anteriores (para los promedios).
export function summarizeMonth(txs: TxForBudget[], rows: BudgetRow[], y: number, m: number, rootIds: string[]): MonthBudget {
  const budgets = budgetsForMonth(rows, y, m)
  const cur = expensesOf(txs, y, m)
  const prev = shift(y, m, -1)
  const prevTx = expensesOf(txs, prev.year, prev.month)

  const byCat = new Map<string, CategoryLine>()
  const line = (id: string) => {
    if (!byCat.has(id)) byCat.set(id, { id, budget: budgets.get(id) || 0, spent: 0, fixed: 0, installments: 0, variable: 0, avg3: 0 })
    return byCat.get(id)!
  }
  budgets.forEach((_, id) => line(id))

  let fixedSpent = 0, installments = 0
  for (const t of cur) {
    const a = Number(t.amount)
    const l = line(t.category_id || 'none')
    l.spent += a
    if (isInstallment(t)) { l.installments += a; installments += a }
    else if (isFixed(t)) { l.fixed += a; fixedSpent += a }
    else l.variable += a
  }

  // Promedio de gasto variable de los 3 meses anteriores, por categoría.
  for (let k = 1; k <= 3; k++) {
    const p = shift(y, m, -k)
    for (const t of expensesOf(txs, p.year, p.month)) {
      if (isFixed(t) || isInstallment(t)) continue
      const id = t.category_id || 'none'
      if (!rootIds.includes(id) && !byCat.has(id)) continue
      line(id).avg3 += Number(t.amount) / 3
    }
  }

  // Fijos que había el mes anterior y este mes todavía no aparecen (misma
  // regla que la hoja de "cargar los fijos").
  const fixedPending = pendingFixed(prevTx, cur, y, m).reduce((s, c) => s + Number(c.source.amount), 0)

  const lines = Array.from(byCat.values())
  const budgetedVariable = lines.reduce((s, l) => s + l.budget, 0)
  const variableOnBudgeted = lines.filter(l => l.budget > 0).reduce((s, l) => s + l.variable, 0)
  const variableUnbudgeted = lines.filter(l => l.budget === 0).reduce((s, l) => s + l.variable, 0)
  const committed = fixedSpent + fixedPending + installments

  return {
    year: y, month: m, lines,
    budgetedVariable, variableOnBudgeted, variableUnbudgeted,
    fixedSpent, fixedPending, installments, committed,
    plannedTotal: committed + budgetedVariable,
    spentTotal: cur.reduce((s, t) => s + Number(t.amount), 0),
    hasBudget: budgetedVariable > 0,
  }
}

// Qué parte del mes pasó: 1 si ya terminó, 0 si no empezó.
export function monthProgress(y: number, m: number, today = new Date()) {
  const key = monthKey(y, m), todayKey = monthKey(today.getFullYear(), today.getMonth() + 1)
  if (key < todayKey) return 1
  if (key > todayKey) return 0
  return today.getDate() / new Date(y, m, 0).getDate()
}

// Ingreso promedio de los 3 meses cerrados anteriores: el ingreso esperado sugerido.
export function suggestedIncome(txs: TxForBudget[], y: number, m: number) {
  let sum = 0, months = 0
  for (let k = 1; k <= 3; k++) {
    const p = shift(y, m, -k)
    const key = monthKey(p.year, p.month)
    const inc = txs.filter(t => t.type === 'income' && t.status !== 'cancelled' && t.date.startsWith(key))
      .reduce((s, t) => s + Number(t.amount), 0)
    if (inc > 0) { sum += inc; months++ }
  }
  return months ? sum / months : 0
}

// Redondea para arriba a un número "de plan": 5.000 si es chico, 10.000 si no.
export function roundPlan(n: number) {
  const step = n < 100000 ? 5000 : 10000
  return Math.ceil(n / step) * step
}
