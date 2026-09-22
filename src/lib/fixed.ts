// Gastos e ingresos fijos que faltan cargar en un mes (F3, decisión 13 de
// docs/ux/06-PREGUNTAS.md): no hay recurrencia automática; la app propone los
// fijos del mes anterior que todavía no aparecen y la persona confirma.
import { todayISO } from './format'

export interface FixedSource {
  id?: string
  type: string
  amount: number
  date: string
  description: string
  category_id: string | null
  subcategory_id?: string | null
  account_id?: string
  payment_method_id?: string | null
  is_recurring: boolean
  installments_total: number
  status: string
}

export interface FixedCandidate<T extends FixedSource = FixedSource> {
  key: string
  source: T
  date: string   // mismo día del mes que la vez anterior (o el último día, si no existe)
}

const pad = (n: number) => String(n).padStart(2, '0')

// "Luz (2/12)  " -> "luz"
export const normDesc = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase()

export const isFixed = (t: FixedSource) =>
  t.is_recurring && t.type !== 'transfer' && !(t.installments_total > 1) && t.status !== 'cancelled'

// prev: movimientos del mes anterior; cur: los del mes. Un fijo cuenta como
// cargado si en el mes ya hay un movimiento del mismo tipo con la misma
// descripción, esté marcado como fijo o no.
export function pendingFixed<T extends FixedSource>(prev: T[], cur: T[], year: number, month: number): FixedCandidate<T>[] {
  const loaded = new Set(cur.filter(t => t.status !== 'cancelled').map(t => `${t.type}:${normDesc(t.description)}`))
  const last = new Date(year, month, 0).getDate()
  const out = new Map<string, FixedCandidate<T>>()
  for (const t of prev) {
    if (!isFixed(t)) continue
    const key = `${t.type}:${normDesc(t.description)}`
    if (loaded.has(key) || out.has(key)) continue
    const day = Math.min(Number(t.date.slice(8, 10)), last)
    out.set(key, { key, source: t, date: `${year}-${pad(month)}-${pad(day)}` })
  }
  // Primero los gastos, del más caro al más barato; después los ingresos.
  return Array.from(out.values()).sort((a, b) =>
    (a.source.type === 'income' ? 1 : 0) - (b.source.type === 'income' ? 1 : 0) || Number(b.source.amount) - Number(a.source.amount)
  )
}

// Un fijo con fecha futura queda "pendiente", como las cuotas que vienen.
export const statusForDate = (date: string): 'pending' | 'confirmed' => (date > todayISO() ? 'pending' : 'confirmed')

// Lo que se repite como un fijo aunque no esté marcado (D12: casi nada está
// marcado todavía): exactamente una vez por mes en cada uno de los 3 meses
// anteriores, con montos parecidos (el mayor no pasa 1,5 veces el menor).
// Se proponen destildados; al cargarlos quedan marcados como fijos.
export function detectRecurring<T extends FixedSource>(
  before: T[], cur: T[], year: number, month: number, exclude: Set<string>,
): FixedCandidate<T>[] {
  const monthKeys = [1, 2, 3].map(k => {
    const d = new Date(year, month - 1 - k, 1)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  })
  const loaded = new Set(cur.filter(t => t.status !== 'cancelled').map(t => `${t.type}:${normDesc(t.description)}`))
  const groups = new Map<string, T[][]>()
  for (const t of before) {
    if (t.type === 'transfer' || t.status === 'cancelled' || t.installments_total > 1 || t.is_recurring) continue
    const mi = monthKeys.indexOf(t.date.slice(0, 7))
    if (mi < 0) continue
    const key = `${t.type}:${normDesc(t.description)}`
    if (!normDesc(t.description) || loaded.has(key) || exclude.has(key)) continue
    if (!groups.has(key)) groups.set(key, [[], [], []])
    groups.get(key)![mi].push(t)
  }
  const last = new Date(year, month, 0).getDate()
  const out: FixedCandidate<T>[] = []
  groups.forEach((byMonth, key) => {
    if (byMonth.some(list => list.length !== 1)) return
    const amounts = byMonth.map(list => Number(list[0].amount))
    if (Math.max(...amounts) > Math.min(...amounts) * 1.5) return
    const source = byMonth[0][0]   // la del mes anterior
    const day = Math.min(Number(source.date.slice(8, 10)), last)
    out.push({ key, source, date: `${year}-${pad(month)}-${pad(day)}` })
  })
  return out.sort((a, b) => Number(b.source.amount) - Number(a.source.amount))
}
