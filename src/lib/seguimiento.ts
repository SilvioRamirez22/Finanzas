// Cálculos de la pantalla Seguimiento (docs/ux/07-SEGUIMIENTO.md).
// Todo sale de una sola lista de movimientos; nada consulta la base acá.
import type { TransactionLite } from './api'

export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
export const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const pad = (n: number) => String(n).padStart(2, '0')

export interface MonthPoint {
  key: string          // "2026-09"
  year: number
  month: number
  income: number
  expense: number
  // Mes que todavía no terminó: no entra en promedios ni se juzga.
  inProgress: boolean
  // Gasto proyectado al ritmo actual (solo el mes en curso).
  projection: number | null
}

export interface Series {
  months: MonthPoint[]            // los `n` meses del período, del más viejo al más nuevo
  previous: MonthPoint[]          // los `n` meses anteriores, para comparar
  byCategory: Map<string, number[]>  // categoría raíz -> gasto por mes (alineado con `months`)
}

// Primer y último día de los 2n meses que terminan en (year, month).
export function rangeFor(year: number, month: number, n: number) {
  const start = new Date(year, month - 1 - (2 * n - 1), 1)
  const last = new Date(year, month, 0)
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    to: `${year}-${pad(month)}-${pad(last.getDate())}`,
  }
}

export function buildSeries(rows: TransactionLite[], year: number, month: number, n: number, today = new Date()): Series {
  const keys: { key: string; year: number; month: number }[] = []
  for (let i = 2 * n - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    keys.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const index = new Map(keys.map((k, i) => [k.key, i]))
  const income = new Array(keys.length).fill(0)
  const expense = new Array(keys.length).fill(0)
  const cats = new Map<string, number[]>()

  for (const t of rows) {
    // Mismo criterio que get_expenses_by_category: no se cuentan las canceladas.
    if (t.status === 'cancelled' || t.type === 'transfer') continue
    const i = index.get(t.date.slice(0, 7))
    if (i === undefined) continue
    const amount = Number(t.amount)
    if (t.type === 'income') income[i] += amount
    else {
      expense[i] += amount
      if (i >= n) {
        const id = t.category_id || 'none'
        if (!cats.has(id)) cats.set(id, new Array(n).fill(0))
        cats.get(id)![i - n] += amount
      }
    }
  }

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
  const points: MonthPoint[] = keys.map((k, i) => {
    const inProgress = k.key === todayKey
    const days = new Date(k.year, k.month, 0).getDate()
    return {
      ...k, income: income[i], expense: expense[i], inProgress,
      projection: inProgress && today.getDate() > 0 ? (expense[i] / today.getDate()) * days : null,
    }
  })
  return { months: points.slice(n), previous: points.slice(0, n), byCategory: cats }
}

// Meses cerrados (sin el que está en curso ni meses futuros vacíos).
export function closedMonths(points: MonthPoint[], today = new Date()) {
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
  return points.filter(p => !p.inProgress && p.key < todayKey)
}

export function average(points: MonthPoint[], pick: (p: MonthPoint) => number) {
  return points.length ? points.reduce((s, p) => s + pick(p), 0) / points.length : 0
}

export function savingsRate(p: { income: number; expense: number }) {
  return p.income > 0 ? (p.income - p.expense) / p.income : null
}

// ---- "Qué cambió": frases calculadas, nunca inventadas ----

export interface Insight {
  kind: 'up' | 'down' | 'warn' | 'ok'
  title: string
  body: string
}

const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

// El ahorro contra la meta no va acá: ya lo dice su propia tarjeta.
export function buildInsights(
  series: Series,
  categoryName: (id: string) => string,
): Insight[] {
  const out: (Insight & { weight: number })[] = []
  const closed = series.months.map((p, i) => ({ p, i })).filter(x => !x.p.inProgress && closedMonths([x.p]).length)
  const idx = closed.map(x => x.i)

  // Subas o bajas sostenidas por categoría (3 o más meses seguidos).
  if (idx.length >= 3) {
    series.byCategory.forEach((vals, id) => {
      if (id === 'none') return
      const v = idx.map(i => vals[i])
      let up = 0, down = 0
      for (let k = v.length - 1; k > 0; k--) {
        if (v[k] > v[k - 1] * 1.02 && down === 0) up++
        else if (v[k] < v[k - 1] * 0.98 && up === 0) down++
        else break
      }
      const streak = Math.max(up, down)
      if (streak < 3) return
      const from = v[v.length - 1 - streak], to = v[v.length - 1]
      if (from <= 0) return
      const change = (to - from) / from
      const firstMonth = series.months[idx[idx.length - 1 - streak]]
      const lastMonth = series.months[idx[idx.length - 1]]
      out.push({
        kind: up ? 'up' : 'down',
        title: `${categoryName(id)} ${up ? 'subió' : 'bajó'} ${streak} meses seguidos`,
        body: `De ${money(from)} en ${MESES[firstMonth.month - 1]} a ${money(to)} en ${MESES[lastMonth.month - 1]}: ${Math.abs(Math.round(change * 100))} % ${up ? 'más' : 'menos'}.`,
        weight: Math.abs(to - from),
      })
    })
  }

  // Mes en curso contra el promedio.
  const current = series.months.find(p => p.inProgress)
  const avgExp = average(closed.map(x => x.p), p => p.expense)
  if (current?.projection && avgExp > 0) {
    const diff = (current.projection - avgExp) / avgExp
    if (Math.abs(diff) >= 0.08) {
      out.push({
        kind: diff > 0 ? 'warn' : 'ok',
        title: `${MESES[current.month - 1][0].toUpperCase()}${MESES[current.month - 1].slice(1)} viene ${Math.abs(Math.round(diff * 100))} % ${diff > 0 ? 'arriba' : 'abajo'} de tu promedio`,
        body: `A este ritmo cerrás en ${money(current.projection)}; tu gasto promedio es ${money(avgExp)}.`,
        weight: Number.MAX_SAFE_INTEGER,
      })
    }
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 4).map(({ weight, ...i }) => i)
}
