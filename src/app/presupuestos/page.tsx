'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { applyBudgetWrites } from '@/lib/api'
import { loadBudgetData } from '@/lib/budgetData'
import { useAppStore } from '@/store/useAppStore'
import { useMonthData } from '@/lib/useMonthData'
import { formatCurrency } from '@/lib/format'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import Sheet from '@/components/ui/Sheet'
import CategoryIcon from '@/components/CategoryIcon'
import LoadFixedSheet from '@/components/forms/LoadFixedSheet'
import {
  summarizeMonth, monthProgress, planBudgetWrites, roundPlan, shift,
  type MonthBudget, type CategoryLine, type BudgetMode,
} from '@/lib/budget'

// Presupuesto del mes (docs/ux/05-PRESUPUESTO.md §5.1): el plan, cómo vengo
// contra el ritmo del mes, cada categoría y el cumplimiento de los últimos meses.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export default function PresupuestosPage() {
  const { categories, selectedMonth, profile, notifyDataChanged } = useAppStore()
  const { year, month } = selectedMonth
  const { data, error, reload } = useMonthData(loadBudgetData)
  const [editing, setEditing] = useState<{ line: CategoryLine; suggested: number } | null>(null)
  const [loadingFixed, setLoadingFixed] = useState(false)

  const roots = useMemo(
    () => categories.filter(c => !c.parent_id && c.is_active && c.type !== 'income'),
    [categories]
  )
  const rootIds = useMemo(() => roots.map(c => c.id), [roots])
  const cat = (id: string) => categories.find(c => c.id === id)

  const summary = useMemo(
    () => data ? summarizeMonth(data.txs, data.budgets, year, month, rootIds) : null,
    [data, year, month, rootIds]
  )
  const history = useMemo(() => {
    if (!data) return []
    return Array.from({ length: 6 }, (_, i) => {
      const p = shift(year, month, i - 5)
      return summarizeMonth(data.txs, data.budgets, p.year, p.month, rootIds)
    })
  }, [data, year, month, rootIds])

  if (error && !data) return <ErrorState onRetry={reload} />

  if (!data || !summary) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-3 md:gap-4">
        <div className="space-y-3"><CardSkeleton big lines={4} /><CardSkeleton lines={6} /></div>
        <CardSkeleton lines={5} />
      </div>
    )
  }

  const plan = data.plans.plans.find(p => p.year === year && p.month === month) || null
  const progress = monthProgress(year, month)

  async function saveOne(categoryId: string, amount: number, mode: BudgetMode) {
    if (!profile || !data) return
    try {
      const { upserts, deletes } = planBudgetWrites(data.budgets, profile.id, categoryId, amount, year, month, mode)
      await applyBudgetWrites(upserts, deletes)
      notifyDataChanged()
      setEditing(null)
      toast.success(amount > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar')
    }
  }

  const budgeted = sortByRisk(summary.lines.filter(l => l.budget > 0), progress)
  const unbudgeted = summary.lines.filter(l => l.budget === 0 && l.variable > 0).sort((a, b) => b.variable - a.variable)
  const unbudgetedTotal = unbudgeted.reduce((s, l) => s + l.variable, 0)
  const name = (id: string) => id === 'none' ? 'Sin categoría' : cat(id)?.name || 'Otra'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-3 md:gap-4 items-start">
      <div className="space-y-3 md:space-y-4">
        {error && <ErrorState compact onRetry={reload} />}
        {data.plans.missing && <MigrationNotice />}

        <PlanCard summary={summary} plan={plan} progress={progress} month={month} name={name}
          onLoadFixed={() => setLoadingFixed(true)} />

        {summary.hasBudget && (
          <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-900">Por categoría</h2>
              <span className="text-xs text-ink-500">primero las que están en riesgo</span>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {budgeted.map(l => (
                <CategoryRow key={l.id} line={l} progress={progress} name={name(l.id)}
                  icon={cat(l.id)?.icon} color={cat(l.id)?.color}
                  onEdit={() => setEditing({ line: l, suggested: l.budget })} />
              ))}
            </ul>
          </section>
        )}

        {unbudgeted.length > 0 && (
          <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
            <h2 className="text-sm font-semibold text-ink-900">Sin presupuesto</h2>
            <p className="text-sm text-ink-700 mt-1">
              <span className="num">{formatCurrency(unbudgetedTotal)}</span> de gasto variable quedó fuera del plan.
            </p>
            <ul className="mt-2 divide-y divide-line">
              {unbudgeted.map(l => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-900 truncate">{name(l.id)}</span>
                    <span className="block text-xs text-ink-500 num">
                      {formatCurrency(l.variable)}{l.avg3 > 0 && ` · promedio ${formatCurrency(l.avg3)}`}
                    </span>
                  </span>
                  {l.id !== 'none' && (
                    <button onClick={() => setEditing({ line: l, suggested: roundPlan(Math.max(l.avg3, l.variable)) })}
                      className="h-11 px-3 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-surface-2 flex-shrink-0">
                      Presupuestar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-3 md:space-y-4">
        <HistoryCard history={history} />
      </div>

      <LoadFixedSheet open={loadingFixed} onClose={() => setLoadingFixed(false)} year={year} month={month} />

      <EditOneSheet
        editing={editing}
        name={editing ? name(editing.line.id) : ''}
        month={month}
        onClose={() => setEditing(null)}
        onSave={saveOne}
      />
    </div>
  )
}

// Excedidas primero, después las adelantadas respecto del ritmo del mes, y el
// resto por monto (decisión 7 de 05-PRESUPUESTO.md).
function sortByRisk(lines: CategoryLine[], progress: number) {
  const risk = (l: CategoryLine) => {
    if (l.variable > l.budget) return 2
    if (progress > 0 && progress < 1 && l.variable / l.budget > progress + 0.1) return 1
    return 0
  }
  return [...lines].sort((a, b) => {
    const r = risk(b) - risk(a)
    if (r) return r
    if (risk(a) === 2) return (b.variable - b.budget) - (a.variable - a.budget)  // más excedida primero
    if (risk(a) === 1) return b.variable / b.budget - a.variable / a.budget      // más adelantada primero
    return b.budget - a.budget
  })
}

function MigrationNotice() {
  return (
    <div role="status" className="rounded-2xl border border-line bg-warn-soft px-4 py-3 text-sm text-warn">
      <b>Falta un paso en Supabase</b> para guardar el ingreso esperado y el ahorro de cada mes: correr{' '}
      <code className="text-xs">sql/migrations/001_presupuesto_por_mes.sql</code> en el SQL Editor. Los topes por
      categoría ya funcionan.
    </div>
  )
}

// ---------- (a) El plan del mes ----------
function PlanCard({ summary: s, plan, progress, month, name, onLoadFixed }: {
  summary: MonthBudget
  plan: { expected_income: number | null; savings_target: number } | null
  progress: number
  month: number
  name: (id: string) => string
  onLoadFixed: () => void
}) {
  const mes = MESES[month - 1]
  const editHref = '/presupuestos/editar'

  if (!s.hasBudget) {
    return (
      <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-ink-500">PLAN DE {mes.toUpperCase()}</p>
        <h2 className="text-lg font-semibold text-ink-900 mt-1">Armá tu plan de {mes} en un minuto</h2>
        <p className="text-sm text-ink-700 mt-1">
          Te propongo topes a partir de lo que gastaste en promedio los últimos 3 meses; los ajustás y listo.
          {s.committed > 0 && <> Ya hay <b className="num">{formatCurrency(s.committed)}</b> comprometidos en fijos y cuotas.</>}
        </p>
        <Link href={editHref} className="inline-flex items-center h-12 mt-4 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold">
          Armar el plan
        </Link>
      </section>
    )
  }

  const pct = s.plannedTotal > 0 ? s.spentTotal / s.plannedTotal : 0
  const varPct = s.budgetedVariable > 0 ? s.variableOnBudgeted / s.budgetedVariable : 0
  const remaining = s.budgetedVariable - s.variableOnBudgeted
  const daysInMonth = new Date(s.year, s.month, 0).getDate()
  const daysLeft = progress > 0 && progress < 1 ? daysInMonth - Math.round(progress * daysInMonth) + 1 : 0
  const over = s.lines.filter(l => l.budget > 0 && l.variable > l.budget)

  let status: React.ReactNode
  if (progress === 0) {
    status = <>Todavía no empezó. Ya hay <b className="num">{formatCurrency(s.committed)}</b> comprometidos en fijos y cuotas.</>
  } else if (progress === 1) {
    const diff = s.spentTotal - s.plannedTotal
    status = <>Cerraste en <b className="num">{formatCurrency(s.spentTotal)}</b>: {Math.abs(diff) < 1000 ? 'justo en el plan' : <><b className="num">{formatCurrency(Math.abs(diff))}</b> {diff > 0 ? 'arriba' : 'abajo'} del plan</>}.</>
  } else if (over.length > 0) {
    const excess = over.reduce((sum, l) => sum + l.variable - l.budget, 0)
    status = over.length === 1
      ? <>Te pasaste <b className="num">{formatCurrency(excess)}</b> en {name(over[0].id)}.</>
      : <>Te pasaste <b className="num">{formatCurrency(excess)}</b>: {over.slice(0, 3).map(l => `${name(l.id)} +${formatCurrency(l.variable - l.budget)}`).join(', ')}.</>
  } else if (varPct > progress + 0.05) {
    const projected = s.variableOnBudgeted / progress
    status = <>Vas <b className="num">{formatCurrency(s.variableOnBudgeted - s.budgetedVariable * progress)}</b> arriba del ritmo. Si seguís así, lo variable cierra en <b className="num">{formatCurrency(projected)}</b> (+{Math.round((projected / s.budgetedVariable - 1) * 100)} %).</>
  } else {
    status = <>Vas bien: a esta altura del mes deberías ir en {Math.round(progress * 100)} % de lo variable y vas en {Math.round(varPct * 100)} %.</>
  }

  const available = plan?.expected_income != null ? plan.expected_income - (plan.savings_target || 0) : null
  const unassigned = available !== null ? available - s.plannedTotal : null

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-ink-500">PLAN DE {mes.toUpperCase()}</p>
        <Link href={editHref} className="inline-flex items-center gap-1.5 h-9 px-3 -mt-1.5 -mr-1 rounded-lg border border-line text-sm text-ink-700 hover:bg-surface-2">
          <Pencil size={14} /> Editar
        </Link>
      </div>
      <p className="text-ink-900 mt-1">
        <span className="text-sm text-ink-700">Gastaste </span>
        <span className="num text-[26px] sm:text-3xl font-semibold tracking-tight">{formatCurrency(s.spentTotal)}</span>
        <span className="text-sm text-ink-700"> de <span className="num">{formatCurrency(s.plannedTotal)}</span></span>
      </p>
      <Bar pct={pct} marker={progress > 0 && progress < 1 ? progress : null} />
      <p className="text-sm text-ink-700 mt-2">{status}</p>
      {daysLeft > 0 && remaining > 0 && (
        <p className="text-sm text-ink-700 mt-1">
          Te quedan <b className="num">{formatCurrency(remaining)}</b> para {daysLeft} {daysLeft === 1 ? 'día' : 'días'}: <span className="num">{formatCurrency(remaining / daysLeft)}</span> por día.
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-line space-y-2.5">
        <Part neutral label="Fijos" spent={s.fixedSpent} of={s.fixedSpent + s.fixedPending}
          note={s.fixedPending > 0 ? `faltan cargar ${formatCurrency(s.fixedPending)}` : undefined}
          action={s.fixedPending > 0 ? { label: 'Cargar', onClick: onLoadFixed } : undefined} />
        <Part neutral label="Cuotas" spent={s.installments} of={s.installments} note={s.installments > 0 ? 'ya comprometidas' : undefined} />
        <Part label="Variable" spent={s.variableOnBudgeted} of={s.budgetedVariable} marker={progress > 0 && progress < 1 ? progress : null} />
        {s.variableUnbudgeted > 0 && (
          <p className="text-xs text-ink-500">
            + <span className="num">{formatCurrency(s.variableUnbudgeted)}</span> en categorías sin presupuesto
          </p>
        )}
      </div>

      {available !== null && unassigned !== null && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-ink-700">Ingreso esperado − ahorro</span><span className="num text-ink-900">{formatCurrency(available)}</span></div>
          <div className="flex justify-between font-medium">
            <span className="text-ink-700">{unassigned >= 0 ? 'Sin asignar' : 'El plan supera lo disponible'}</span>
            <span className={`num ${unassigned >= 0 ? 'text-pos' : 'text-neg'}`}>{formatCurrency(Math.abs(unassigned))}</span>
          </div>
        </div>
      )}
    </section>
  )
}

// Barra de progreso con marca de 100 % implícita (el final) y, en el mes en
// curso, la marca de "dónde deberías ir hoy".
// neutral: fijos y cuotas, que no se gestionan; llegar al 100 % es lo esperable.
function Bar({ pct, marker, thin = false, neutral = false }: { pct: number; marker?: number | null; thin?: boolean; neutral?: boolean }) {
  const over = pct > 1
  return (
    <div className={`relative ${thin ? 'h-1.5 mt-1.5' : 'h-2.5 mt-3'} rounded-full bg-muted`}>
      <div className={`h-full rounded-full ${neutral ? 'bg-[var(--chart-neutral)]' : over ? 'bg-neg-fill' : pct > 0.9 ? 'bg-warn' : 'bg-brand'}`}
        style={{ width: `${Math.min(pct, 1) * 100}%` }} />
      {marker != null && (
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink-900" style={{ left: `${marker * 100}%` }}
          title="Donde deberías ir hoy" aria-hidden="true" />
      )}
    </div>
  )
}

function Part({ label, spent, of, note, marker, neutral, action }: {
  label: string; spent: number; of: number; note?: string; marker?: number | null; neutral?: boolean
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-700">{label}</span>
        <span className="num text-ink-900">{formatCurrency(spent)} <span className="text-ink-500">de {formatCurrency(of)}</span></span>
      </div>
      <Bar pct={of > 0 ? spent / of : 0} marker={marker} thin neutral={neutral} />
      {note && (
        <p className="text-xs text-ink-500 mt-1 flex items-center justify-between gap-3">
          <span>{note}</span>
          {action && (
            <button type="button" onClick={action.onClick}
              className="h-9 px-3 -my-1.5 rounded-lg border border-line text-xs font-semibold text-brand-ink hover:bg-surface-2">
              {action.label}
            </button>
          )}
        </p>
      )}
    </div>
  )
}

// ---------- (b) Una categoría ----------
function CategoryRow({ line: l, progress, name, icon, color, onEdit }: {
  line: CategoryLine; progress: number; name: string; icon?: string; color?: string; onEdit: () => void
}) {
  const pct = l.variable / l.budget
  const over = l.variable > l.budget
  const ahead = !over && progress > 0 && progress < 1 && pct > progress + 0.1
  const committed = l.fixed + l.installments
  return (
    <li>
      <button type="button" onClick={onEdit} className="w-full text-left py-3 group" aria-label={`${name}: editar presupuesto`}>
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center"
            style={{ background: `${color || '#888780'}1F`, color: color || '#888780' }}>
            <CategoryIcon name={icon} size={14} />
          </span>
          <span className="flex-1 min-w-0 text-sm font-medium text-ink-900 truncate">{name}</span>
          <span className={`num text-sm flex-shrink-0 ${over ? 'text-neg font-medium' : 'text-ink-700'}`}>
            {over ? `+${formatCurrency(l.variable - l.budget)} arriba` : `${formatCurrency(l.budget - l.variable)} libres`}
          </span>
          <ChevronRight size={16} className="text-ink-500 flex-shrink-0" />
        </div>
        <Bar pct={pct} marker={progress > 0 && progress < 1 ? progress : null} thin />
        <p className="text-xs text-ink-500 mt-1.5 num">
          {formatCurrency(l.variable)} de {formatCurrency(l.budget)}
          {l.avg3 > 0 && ` · promedio ${formatCurrency(l.avg3)}`}
          {committed > 0 && ` · + ${formatCurrency(committed)} en fijos y cuotas`}
          {ahead && <span className="text-warn font-medium"> · va adelantada</span>}
          {l.variable === 0 && <span> · sin gastos todavía</span>}
        </p>
      </button>
    </li>
  )
}

// ---------- (c) Cumplimiento ----------
function HistoryCard({ history }: { history: MonthBudget[] }) {
  const withPlan = history.filter(h => h.hasBudget && monthProgress(h.year, h.month) === 1)
  const within = withPlan.filter(h => h.variableOnBudgeted <= h.budgetedVariable).length
  const maxPct = Math.max(1.3, ...history.map(h => h.hasBudget ? h.variableOnBudgeted / h.budgetedVariable : 0))
  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5">
      <h2 className="text-sm font-semibold text-ink-900">Cumplimiento</h2>
      <p className="text-sm text-ink-700 mt-1">
        {withPlan.length === 0
          ? 'Cuando cierre el primer mes con plan, acá vas a ver si te mantuviste adentro.'
          : `Cerraste dentro del plan ${within} de ${withPlan.length} ${withPlan.length === 1 ? 'mes' : 'meses'}.`}
      </p>
      <div className="relative mt-4 h-28 flex items-end gap-2">
        <div className="absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(1 / maxPct) * 100}%` }} aria-hidden="true" />
        {history.map(h => {
          const p = h.hasBudget ? h.variableOnBudgeted / h.budgetedVariable : 0
          const running = monthProgress(h.year, h.month) < 1
          return (
            <div key={`${h.year}-${h.month}`} className="flex-1 h-full flex flex-col justify-end items-center"
              title={h.hasBudget ? `${MESES[h.month - 1]}: ${Math.round(p * 100)} % del plan variable${running ? ' (en curso)' : ''}` : `${MESES[h.month - 1]}: sin plan`}>
              {h.hasBudget ? (
                <div className={`w-full max-w-[28px] rounded-t ${running ? 'border-2 border-dashed border-line-strong' : p > 1 ? 'bg-neg-fill' : 'bg-brand'}`}
                  style={{ height: `${Math.max(3, (p / maxPct) * 100)}%` }} />
              ) : (
                <div className="w-full max-w-[28px] h-[3px] rounded bg-muted" />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 mt-1">
        {history.map(h => <span key={`${h.year}-${h.month}`} className="flex-1 text-center text-[11px] text-ink-500">{MESES_CORTO[h.month - 1]}</span>)}
      </div>
      <p className="text-xs text-ink-500 mt-3">
        Cada barra es el gasto variable de las categorías con presupuesto contra su tope de ese mes. La línea es el 100 %.
      </p>
    </section>
  )
}

// ---------- Editar el tope de una categoría ----------
function EditOneSheet({ editing, name, month, onClose, onSave }: {
  editing: { line: CategoryLine; suggested: number } | null
  name: string
  month: number
  onClose: () => void
  onSave: (categoryId: string, amount: number, mode: BudgetMode) => Promise<void>
}) {
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<BudgetMode>('forward')
  const [saving, setSaving] = useState(false)
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  // Reinicia el formulario cada vez que se abre para otra categoría.
  if (editing && openedFor !== editing.line.id) {
    setOpenedFor(editing.line.id)
    setRaw(editing.suggested ? String(Math.round(editing.suggested)) : '')
    setMode('forward')
  }
  if (!editing && openedFor) setOpenedFor(null)

  const amount = Number(raw) || 0
  const mes = MESES[month - 1]
  const l = editing?.line

  async function submit(value: number) {
    if (!l) return
    setSaving(true)
    await onSave(l.id, value, mode)
    setSaving(false)
  }

  return (
    <Sheet open={!!editing} title={name} onRequestClose={onClose}
      footer={
        <div className="flex gap-2">
          {l && l.budget > 0 && (
            <button type="button" disabled={saving} onClick={() => submit(0)}
              className="h-12 px-4 rounded-xl border border-line text-sm font-medium text-neg">
              Quitar
            </button>
          )}
          <button type="button" disabled={saving || amount <= 0} onClick={() => submit(amount)}
            className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:bg-surface-2 disabled:text-ink-500">
            {saving ? 'Guardando…' : amount > 0 ? `Guardar ${formatCurrency(amount)}` : 'Escribí el tope'}
          </button>
        </div>
      }>
      {l && (
        <div className="pb-4 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-ink-500 mb-1.5">Tope para gasto variable</span>
            <input value={raw ? Number(raw).toLocaleString('es-AR') : ''} inputMode="numeric"
              onChange={e => setRaw(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="0" className="num w-full h-12 rounded-xl border border-line px-3 text-xl font-semibold text-ink-900 outline-none focus:border-brand" />
          </label>
          <p className="text-sm text-ink-700">
            En {mes} llevás <b className="num">{formatCurrency(l.variable)}</b>
            {l.avg3 > 0 && <> y tu promedio es <b className="num">{formatCurrency(l.avg3)}</b></>}.
            {(l.fixed + l.installments) > 0 && <> Los fijos y cuotas de esta categoría (<span className="num">{formatCurrency(l.fixed + l.installments)}</span>) van aparte.</>}
          </p>
          <fieldset>
            <legend className="block text-xs font-medium text-ink-500 mb-1.5">Aplicar</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['forward', `Desde ${mes}`], ['only', `Solo ${mes}`]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
                  className={`h-11 rounded-xl border text-sm ${mode === v ? 'bg-brand-soft border-brand text-brand-ink font-medium' : 'border-line text-ink-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-500 mt-1.5">
              {mode === 'forward' ? 'Rige este mes y los siguientes. Los meses anteriores no cambian.' : 'Solo este mes; el siguiente vuelve al tope de siempre.'}
            </p>
          </fieldset>
        </div>
      )}
    </Sheet>
  )
}
