'use client'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, Gauge, Tag, Wallet } from 'lucide-react'

// Tarjeta "Atención" del Resumen (docs/ux/04-GLOBAL-DASHBOARD.md §2.1): junta
// lo que pide hacer algo, cada cosa con su acción. Si no hay nada, no aparece.

export interface AttentionItem {
  key: string
  tone: 'neg' | 'warn' | 'info'
  icon: 'over' | 'pace' | 'fixed' | 'uncategorized' | 'balance'
  title: string
  detail?: string
  action: { label: string; href?: string; onClick?: () => void }
}

const ICONS = { over: AlertTriangle, pace: Gauge, fixed: CalendarClock, uncategorized: Tag, balance: Wallet }
const TONES = {
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
}

export default function AttentionCard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5" aria-labelledby="attention-title">
      <h2 id="attention-title" className="text-sm font-semibold text-ink-900">
        Atención <span className="text-ink-500 font-normal">· {items.length}</span>
      </h2>
      <ul className="mt-1 divide-y divide-line">
        {items.map(i => {
          const Icon = ICONS[i.icon]
          const btn = 'h-9 px-3 rounded-lg border border-line text-xs font-semibold text-brand-ink hover:bg-surface-2 flex-shrink-0 inline-flex items-center'
          return (
            <li key={i.key} className="flex items-center gap-3 py-2.5">
              <span className={`w-8 h-8 flex-shrink-0 rounded-[10px] flex items-center justify-center ${TONES[i.tone]}`} aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-ink-900">{i.title}</span>
                {i.detail && <span className="block text-xs text-ink-500 mt-0.5">{i.detail}</span>}
              </span>
              {i.action.href ? (
                <Link href={i.action.href} className={btn}>{i.action.label}</Link>
              ) : (
                <button type="button" onClick={i.action.onClick} className={btn}>{i.action.label}</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
