'use client'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import type { Account } from '@/types'
import type { FutureTransaction } from '@/lib/api'

// Disponible hoy, en una línea al final del Resumen. Antes era el número grande
// de arriba, pero no dice cuánta plata hay: hay cuentas que no están en la app.
// Lo primero ahora es lo que falta pagar (CommittedCard).
// La plata que hay hoy, sin las cuotas ni lo cargado con fecha futura: el saldo
// de la base ya los descuenta, así que acá se devuelven (D5). Solo la moneda
// principal: las cuentas en otra moneda nunca se suman (D6).

export function balancesToday(accounts: Account[], future: FutureTransaction[]) {
  const back = new Map<string, number>()
  const add = (id: string | null, v: number) => { if (id) back.set(id, (back.get(id) || 0) + v) }
  for (const t of future) {
    const a = Number(t.amount)
    if (t.type === 'expense') add(t.account_id, a)
    else if (t.type === 'income') add(t.account_id, -a)
    else { add(t.account_id, a); add(t.transfer_to_account_id, -a) }
  }
  return new Map(accounts.map(acc => [acc.id, Number(acc.current_balance) + (back.get(acc.id) || 0)]))
}

export default function BalanceLine({ accounts, future, unconfigured, mainCurrency = 'ARS' }: {
  accounts: Account[]
  future: FutureTransaction[]
  unconfigured: boolean
  mainCurrency?: string
}) {
  const active = accounts.filter(a => a.is_active)
  const today = balancesToday(active, future)
  const counted = active.filter(a => !a.exclude_from_totals && (a.currency || mainCurrency) === mainCurrency)
  const total = counted.reduce((s, a) => s + (today.get(a.id) || 0), 0)

  return (
    <Link href="/cuentas"
      className="flex items-center justify-between gap-3 bg-surface rounded-2xl border border-line px-4 py-3 text-sm hover:bg-surface-2 active:bg-surface-2">
      <span className="text-ink-500">{unconfigured ? 'Movimiento acumulado' : 'Disponible hoy'} en cuentas</span>
      <span className={`num flex-shrink-0 ${total < 0 ? 'text-neg' : 'text-ink-700'}`}>
        {total < 0 ? '−' : ''}{formatCurrency(Math.abs(total))}
      </span>
    </Link>
  )
}
