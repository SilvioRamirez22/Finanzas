'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { applyBudgetWrites, saveMonthPlan } from '@/lib/api'
import { loadBudgetData } from '@/lib/budgetData'
import { useAppStore } from '@/store/useAppStore'
import { useMonthData } from '@/lib/useMonthData'
import { formatCurrency } from '@/lib/format'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import CategoryIcon from '@/components/CategoryIcon'
import {
  budgetsForMonth, summarizeMonth, planBudgetWrites, suggestedIncome, roundPlan, shift,
  type BudgetMode,
} from '@/lib/budget'
import type { Budget } from '@/types'

// Armar el plan de un mes (docs/ux/05-PRESUPUESTO.md §5.2): ingreso esperado,
// ahorro, lo ya comprometido y un tope por categoría, con "sin asignar" en
// vivo. La primera vez viene completo con sugerencias: solo hay que ajustar.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 12)
const fmt = (raw: string) => (raw ? Number(raw).toLocaleString('es-AR') : '')
const toRaw = (n: number) => (n > 0 ? String(Math.round(n)) : '')

export default function EditarPlanPage() {
  const router = useRouter()
  const { categories, selectedMonth, profile, notifyDataChanged } = useAppStore()
  const { year, month } = selectedMonth
  const { data, error, reload } = useMonthData(loadBudgetData)

  const [income, setIncome] = useState('')
  const [savings, setSavings] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<BudgetMode>('forward')
  const [readyFor, setReadyFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const roots = useMemo(
    () => categories.filter(c => !c.parent_id && c.is_active && c.type !== 'income'),
    [categories]
  )
  const rootIds = useMemo(() => roots.map(c => c.id), [roots])
  const summary = useMemo(
    () => data ? summarizeMonth(data.txs, data.budgets, year, month, rootIds) : null,
    [data, year, month, rootIds]
  )
  const avg = (id: string) => summary?.lines.find(l => l.id === id)?.avg3 || 0
  const current = useMemo(() => data ? budgetsForMonth(data.budgets, year, month) : new Map<string, number>(), [data, year, month])
  const prev = shift(year, month, -1)
  const previous = useMemo(() => data ? budgetsForMonth(data.budgets, prev.year, prev.month) : new Map<string, number>(), [data, prev.year, prev.month])

  // Valores iniciales, una vez por mes: lo que ya hay, o sugerencias.
  const key = `${year}-${month}`
  useEffect(() => {
    if (!data || !summary || readyFor === key) return
    const plan = data.plans.plans.find(p => p.year === year && p.month === month)
    setIncome(toRaw(plan?.expected_income ?? roundPlan(suggestedIncome(data.txs, year, month))))
    setSavings(toRaw(plan?.savings_target ?? 0))
    const next: Record<string, string> = {}
    for (const c of roots) {
      next[c.id] = current.size > 0 ? toRaw(current.get(c.id) || 0) : toRaw(avg(c.id) > 0 ? roundPlan(avg(c.id)) : 0)
    }
    setAmounts(next)
    setMode('forward')
    setReadyFor(key)
  }, [data, summary, key])

  if (error && !data) return <ErrorState onRetry={reload} />
  if (!data || !summary || readyFor !== key) {
    return <div className="max-w-2xl mx-auto space-y-3"><CardSkeleton big lines={4} /><CardSkeleton lines={8} /></div>
  }

  const mes = MESES[month - 1]
  const incomeN = Number(income) || 0
  const savingsN = Number(savings) || 0
  const topes = roots.reduce((s, c) => s + (Number(amounts[c.id]) || 0), 0)
  const available = incomeN - savingsN
  const unassigned = available - summary.committed - topes
  const planMissing = data.plans.missing
  const firstTime = current.size === 0
  const sorted = [...roots].sort((a, b) => avg(b.id) - avg(a.id) || a.sort_order - b.sort_order)
  const changed = roots.filter(c => (Number(amounts[c.id]) || 0) !== (current.get(c.id) || 0))

  function fillFrom(source: 'previous' | 'average') {
    const next: Record<string, string> = {}
    for (const c of roots) {
      next[c.id] = source === 'previous' ? toRaw(previous.get(c.id) || 0) : toRaw(avg(c.id) > 0 ? roundPlan(avg(c.id)) : 0)
    }
    setAmounts(next)
  }

  async function save() {
    if (!profile || !data) return
    setSaving(true)
    try {
      const upserts: Partial<Budget>[] = []
      const deletes: string[] = []
      for (const c of changed) {
        const w = planBudgetWrites(data.budgets, profile.id, c.id, Number(amounts[c.id]) || 0, year, month, mode)
        upserts.push(...w.upserts)
        deletes.push(...w.deletes)
      }
      await applyBudgetWrites(upserts, deletes)
      if (!planMissing && incomeN > 0) {
        await saveMonthPlan({ year, month, expected_income: incomeN, savings_target: savingsN })
      }
      notifyDataChanged()
      toast.success(`Plan de ${mes} guardado`)
      router.push('/presupuestos')
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar el plan')
      setSaving(false)
    }
  }

  const money = 'num w-full h-11 rounded-xl border border-line bg-surface px-3 text-right text-base text-ink-900 outline-none focus:border-brand'

  return (
    <div className="max-w-2xl mx-auto space-y-3 md:space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Link href="/presupuestos" aria-label="Volver a Presupuesto"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-ink-700 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">
          {firstTime ? `Armá el plan de ${mes}` : `Plan de ${mes}`}
        </h1>
      </div>
      {firstTime && (
        <p className="text-sm text-ink-700 -mt-1">
          Ya viene completo con tus promedios de los últimos 3 meses. Ajustá lo que quieras y guardá.
        </p>
      )}

      {/* Plata del mes */}
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5 space-y-3">
        {planMissing ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
            Para guardar ingreso esperado y ahorro falta correr{' '}
            <code className="text-xs">sql/migrations/001_presupuesto_por_mes.sql</code> en Supabase. Los topes se guardan igual.
          </p>
        ) : null}
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-900">
            Ingreso esperado
            <span className="block text-xs text-ink-500">sugerido: promedio de 3 meses</span>
          </span>
          <input value={fmt(income)} onChange={e => setIncome(digits(e.target.value))} inputMode="numeric"
            placeholder="0" className={`${money} max-w-[180px]`} disabled={planMissing} />
        </label>
        <div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-900">Ahorro objetivo</span>
            <input value={fmt(savings)} onChange={e => setSavings(digits(e.target.value))} inputMode="numeric"
              placeholder="0" className={`${money} max-w-[180px]`} disabled={planMissing} />
          </label>
          {incomeN > 0 && !planMissing && (
            <div className="flex gap-2 justify-end mt-2">
              {[0.1, 0.2].map(p => (
                <button key={p} type="button" onClick={() => setSavings(toRaw(roundPlan(incomeN * p)))}
                  className="h-9 px-3 rounded-full border border-line text-sm text-ink-700 hover:bg-surface-2">
                  {Math.round(p * 100)} %
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-700">
            Ya comprometido
            <span className="block text-xs text-ink-500">
              fijos {formatCurrency(summary.fixedSpent + summary.fixedPending)} · cuotas {formatCurrency(summary.installments)}
            </span>
          </span>
          <span className="num text-ink-900">{formatCurrency(summary.committed)}</span>
        </div>
      </section>

      {/* Sin asignar: sigue a la vista mientras se editan los topes. */}
      <div className="sticky top-[106px] md:top-[97px] z-20">
        <div className={`rounded-2xl border px-4 py-3 shadow-[0_1px_3px_rgb(26_22_16/0.08)] ${
          incomeN === 0 ? 'bg-surface border-line' : unassigned >= 0 ? 'bg-pos-soft border-line' : 'bg-neg-soft border-line'
        }`} role="status" aria-live="polite">
          {incomeN === 0 ? (
            <p className="text-sm text-ink-700 flex justify-between gap-3">
              <span>Topes variables</span><span className="num font-semibold text-ink-900">{formatCurrency(topes)}</span>
            </p>
          ) : (
            <p className="flex items-baseline justify-between gap-3">
              <span className={`text-sm font-medium ${unassigned >= 0 ? 'text-pos' : 'text-neg'}`}>
                {unassigned >= 0 ? 'Sin asignar' : 'Te pasás de lo disponible por'}
              </span>
              <span className={`num text-xl font-semibold ${unassigned >= 0 ? 'text-pos' : 'text-neg'}`}>
                {formatCurrency(Math.abs(unassigned))}
              </span>
            </p>
          )}
          {incomeN > 0 && (
            <p className="text-xs text-ink-700 mt-0.5 num">
              {formatCurrency(available)} disponible − {formatCurrency(summary.committed)} comprometido − {formatCurrency(topes)} en topes
            </p>
          )}
        </div>
      </div>

      {/* Topes por categoría */}
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-ink-900">Topes de gasto variable</h2>
          <div className="flex gap-2">
            {previous.size > 0 && (
              <button type="button" onClick={() => fillFrom('previous')}
                className="h-9 px-3 rounded-full border border-line text-sm text-ink-700 hover:bg-surface-2">
                Copiar de {MESES[prev.month - 1]}
              </button>
            )}
            <button type="button" onClick={() => fillFrom('average')}
              className="h-9 px-3 rounded-full border border-line text-sm text-ink-700 hover:bg-surface-2">
              Sugerir por promedio
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-500 mt-1">Fijos y cuotas no van acá: ya están contados como comprometidos. Vacío = sin tope.</p>
        <ul className="mt-2 divide-y divide-line">
          {sorted.map(c => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center"
                style={{ background: `${c.color || '#888780'}1F`, color: c.color || '#888780' }}>
                <CategoryIcon name={c.icon} size={15} />
              </span>
              <label htmlFor={`tope-${c.id}`} className="flex-1 min-w-0">
                <span className="block text-sm text-ink-900 truncate">{c.name}</span>
                <span className="block text-xs text-ink-500 num">
                  {avg(c.id) > 0 ? `promedio ${formatCurrency(avg(c.id))}` : 'sin gasto variable reciente'}
                </span>
              </label>
              <input id={`tope-${c.id}`} value={fmt(amounts[c.id] || '')} inputMode="numeric" placeholder="—"
                onChange={e => setAmounts(a => ({ ...a, [c.id]: digits(e.target.value) }))}
                className={`${money} max-w-[140px]`} />
            </li>
          ))}
        </ul>
      </section>

      {/* Guardar */}
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5 space-y-3">
        <fieldset>
          <legend className="text-xs font-medium text-ink-500 mb-1.5">Los topes rigen</legend>
          <div className="grid grid-cols-2 gap-2">
            {([['forward', `Desde ${mes} en adelante`], ['only', `Solo en ${mes}`]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
                className={`h-11 rounded-xl border text-sm ${mode === v ? 'bg-brand-soft border-brand text-brand-ink font-medium' : 'border-line text-ink-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500 mt-1.5">Los meses anteriores nunca cambian.</p>
        </fieldset>
        <button type="button" onClick={save} disabled={saving}
          className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Guardando…' : `Guardar el plan de ${mes}`}
        </button>
        {!firstTime && changed.length > 0 && (
          <p className="text-xs text-ink-500 text-center">
            Cambian {changed.length} {changed.length === 1 ? 'tope' : 'topes'}: {changed.slice(0, 4).map(c => c.name).join(', ')}{changed.length > 4 ? '…' : ''}
          </p>
        )}
      </section>
    </div>
  )
}
