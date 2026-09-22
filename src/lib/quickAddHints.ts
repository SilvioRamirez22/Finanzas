import { createClient } from './supabase/client'
import type { TransactionType } from '@/types'

// Lo que la carga rápida aprende de los movimientos de los últimos 90 días:
// qué categorías y cuentas se usan más, cuál fue la última cuenta, el último
// medio de pago de cada cuenta y las descripciones que se repiten.
//
// Sale de Supabase y no del navegador: así la "última cuenta" es la misma en
// el celular y en la compu.
export interface DescriptionHint {
  text: string
  type: TransactionType
  category_id: string | null
  subcategory_id: string | null
  account_id: string
  amount: number
  uses: number
}

export interface QuickAddHints {
  // id de categoría (raíz o sub) -> cantidad de usos, por tipo de movimiento
  categoryUses: Record<string, number>
  accountUses: Record<string, number>
  lastAccountByType: Partial<Record<TransactionType, string>>
  lastPaymentByAccount: Record<string, string>
  descriptions: DescriptionHint[]
}

export const EMPTY_HINTS: QuickAddHints = {
  categoryUses: {}, accountUses: {}, lastAccountByType: {}, lastPaymentByAccount: {}, descriptions: [],
}

// "Heladera (3/12)" -> "Heladera"
const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()

// Se guarda en memoria mientras la app está abierta y se vuelve a pedir
// cuando cambian los movimientos (dataVersion).
let cache: { version: number; hints: QuickAddHints } | null = null

export async function getQuickAddHints(version: number): Promise<QuickAddHints> {
  if (cache && cache.version === version) return cache.hints

  const since = new Date()
  since.setDate(since.getDate() - 90)
  const pad = (n: number) => String(n).padStart(2, '0')
  const sinceISO = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`

  const { data, error } = await createClient()
    .from('transactions')
    .select('type, category_id, subcategory_id, account_id, payment_method_id, description, amount, installment_number, created_at')
    .gte('date', sinceISO)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw error

  const hints: QuickAddHints = {
    categoryUses: {}, accountUses: {}, lastAccountByType: {}, lastPaymentByAccount: {}, descriptions: [],
  }
  const descs = new Map<string, DescriptionHint>()

  for (const t of data || []) {
    // Las cuotas 2, 3, 4... las generó la app, no son elecciones de la persona.
    if (t.installment_number && t.installment_number > 1) continue
    const type = t.type as TransactionType

    if (t.category_id) hints.categoryUses[t.category_id] = (hints.categoryUses[t.category_id] || 0) + 1
    if (t.subcategory_id) hints.categoryUses[t.subcategory_id] = (hints.categoryUses[t.subcategory_id] || 0) + 1
    hints.accountUses[t.account_id] = (hints.accountUses[t.account_id] || 0) + 1
    // Vienen del más nuevo al más viejo: el primero que aparece es el último usado.
    if (!hints.lastAccountByType[type]) hints.lastAccountByType[type] = t.account_id
    if (t.payment_method_id && !hints.lastPaymentByAccount[t.account_id]) {
      hints.lastPaymentByAccount[t.account_id] = t.payment_method_id
    }

    const text = stripSuffix(t.description || '')
    if (!text || type === 'transfer') continue
    const key = `${type}:${text.toLowerCase()}`
    const prev = descs.get(key)
    if (prev) prev.uses++
    else descs.set(key, {
      text, type,
      category_id: t.category_id, subcategory_id: t.subcategory_id,
      account_id: t.account_id, amount: Number(t.amount), uses: 1,
    })
  }

  hints.descriptions = Array.from(descs.values()).sort((a, b) => b.uses - a.uses).slice(0, 300)
  cache = { version, hints }
  return hints
}

// Sugerencias para lo que se está escribiendo: primero las que empiezan igual,
// después las que lo contienen; dentro de cada grupo, las más usadas.
export function suggestDescriptions(hints: QuickAddHints, type: TransactionType, query: string, max = 5) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const pool = hints.descriptions.filter(d => d.type === type && d.text.toLowerCase() !== q)
  const starts = pool.filter(d => d.text.toLowerCase().startsWith(q))
  const contains = pool.filter(d => !d.text.toLowerCase().startsWith(q) && d.text.toLowerCase().includes(q))
  return [...starts, ...contains].slice(0, max)
}
