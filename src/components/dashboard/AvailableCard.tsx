'use client'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import type { Account } from '@/types'
import type { FutureTransaction } from '@/lib/api'

// Disponible hoy (docs/ux/04-GLOBAL-DASHBOARD.md §2.1 y decisión 15): la plata
// que hay hoy, sin las cuotas ni lo cargado con fecha futura. El saldo de la
// base ya los descuenta; acá se devuelven y se muestran aparte como
// "comprometido". Las cuentas en otra moneda van aparte y nunca se suman (D6).

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

export default function AvailableCard({ accounts, future, unconfigured, mainCurrency = 'ARS' }: {
  accounts: Account[]
  future: FutureTransaction[] | null
  unconfigured: boolean
  mainCurrency?: string
}) {
  const active = accounts.filter(a => a.is_active)
  const today = balancesToday(active, future || [])
  const counted = active.filter(a => !a.exclude_from_totals && (a.currency || mainCurrency) === mainCurrency)
  const others = active.filter(a => !a.exclude_from_totals && (a.currency || mainCurrency) !== mainCurrency)
  const total = counted.reduce((s, a) => s + (today.get(a.id) || 0), 0)

  const futureExpenses = (future || []).filter(t => t.type === 'expense' && counted.some(a => a.id === t.account_id))
  const installments = futureExpenses.filter(t => t.installments_total > 1).reduce((s, t) => s + Number(t.amount), 0)
  const otherFuture = futureExpenses.filter(t => !(t.installments_total > 1)).reduce((s, t) => s + Number(t.amount), 0)
  const committed = installments + otherFuture
  const sign = (n: number) => (n < 0 ? '−' : '')

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-500">
          {unconfigured ? 'MOVIMIENTO ACUMULADO' : 'DISPONIBLE HOY'}
        </h2>
        <Link href="/cuentas" className="text-xs text-ink-500 hover:text-ink-900">Cuentas</Link>
      </div>
      <p className={`num text-[28px] sm:text-3xl font-semibold mt-1 tracking-tight break-words ${total < 0 ? 'text-neg' : 'text-ink-900'}`}>
        {sign(total)}{formatCurrency(Math.abs(total))}
      </p>
      {unconfigured && (
        <p className="text-xs text-warn mt-1">
          No es la plata que tenés: es la suma de lo cargado, sin saldo de partida.{' '}
          <Link href="/cuentas" className="underline underline-offset-2 font-medium">Configurar saldos</Link>
        </p>
      )}

      {committed > 0 && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-700">Comprometido a futuro</span>
            <span className="num font-medium text-ink-900">{formatCurrency(committed)}</span>
          </div>
          <p className="text-xs text-ink-500 mt-0.5">
            {[installments > 0 && `cuotas ${formatCurrency(installments)}`, otherFuture > 0 && `otros con fecha futura ${formatCurrency(otherFuture)}`].filter(Boolean).join(' · ')}
            {' · '}<Link href="/seguimiento" className="underline underline-offset-2">ver por mes</Link>
          </p>
        </div>
      )}

      <ul className="mt-3 divide-y divide-line">
        {counted.map(a => {
          const v = today.get(a.id) || 0
          return (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink-700 truncate">{a.name}</span>
              <span className={`num flex-shrink-0 ml-3 ${v < 0 ? 'text-neg' : 'text-ink-900'}`}>{sign(v)}{formatCurrency(Math.abs(v))}</span>
            </li>
          )
        })}
      </ul>

      {others.length > 0 && (
        <div className="mt-2 pt-2 border-t border-line">
          <p className="text-xs text-ink-500 mb-1">En otras monedas (no se suman al total)</p>
          <ul>
            {others.map(a => {
              const v = today.get(a.id) || 0
              return (
                <li key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-ink-700 truncate">{a.name}</span>
                  <span className="num flex-shrink-0 ml-3 text-ink-900">{sign(v)}{formatCurrency(Math.abs(v), a.currency)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
