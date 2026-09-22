'use client'
import { useMemo, useState } from 'react'
import { getTransactionsLite, getFutureTransactions } from '@/lib/api'
import { todayISO } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'
import { useMonthData } from '@/lib/useMonthData'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { MESES, rangeFor, buildSeries, buildOutlook } from '@/lib/seguimiento'
import SeguimientoContent, { type PlanPoint } from '@/components/seguimiento/SeguimientoContent'
import { summarizeMonth } from '@/lib/budget'

// Seguimiento: cómo evolucionan ingresos, gastos y ahorro (docs/ux/07-SEGUIMIENTO.md).
// Se traen 24 meses una sola vez por mes elegido; 6 o 12 se calculan en memoria.

const RANGES = [6, 12] as const

// Además: lo que tiene fecha después de hoy y el mes actual con el anterior
// (de ahí salen los fijos que se asume que se repiten), para "Próximos 6 meses".
async function loadRows(year: number, month: number) {
  const { from, to } = rangeFor(year, month, 12)
  const now = new Date()
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const [rows, future, recent] = await Promise.all([
    getTransactionsLite(from, to),
    getFutureTransactions(todayISO()),
    getTransactionsLite(`${prevStart.getFullYear()}-${pad(prevStart.getMonth() + 1)}-01`, todayISO()),
  ])
  return { rows, future, recent }
}

export default function SeguimientoPage() {
  const { categories, budgets, selectedMonth } = useAppStore()
  const { data, error, reload } = useMonthData(loadRows)
  const [range, setRange] = useState<6 | 12>(6)
  const [selKey, setSelKey] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)

  const series = useMemo(
    () => data ? buildSeries(data.rows, selectedMonth.year, selectedMonth.month, range) : null,
    [data, selectedMonth.year, selectedMonth.month, range]
  )

  // Gasto contra el plan de cada mes del período (docs/ux/05-PRESUPUESTO.md).
  const planPoints = useMemo<PlanPoint[]>(() => {
    if (!data || !series) return []
    const rootIds = categories.filter(c => !c.parent_id && c.type !== 'income').map(c => c.id)
    return series.months.map(p => {
      const s = summarizeMonth(data.rows, budgets, p.year, p.month, rootIds)
      return { key: p.key, month: p.month, planned: s.plannedTotal, spent: s.spentTotal, hasBudget: s.hasBudget, inProgress: p.inProgress, projection: p.projection }
    })
  }, [data, series, budgets, categories])

  const outlook = useMemo(() => data ? buildOutlook(data.future, data.recent) : null, [data])

  const catName = (id: string) => id === 'none' ? 'Sin categoría' : categories.find(c => c.id === id)?.name || 'Otra'

  if (error && !data) return <ErrorState onRetry={reload} />

  return (
    <div className="space-y-3 md:space-y-4">
      {error && data && <ErrorState compact onRetry={reload} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Seguimiento</h1>
          <p className="text-sm text-ink-500">
            Hasta {MESES[selectedMonth.month - 1]} {selectedMonth.year} · montos nominales, sin ajustar por inflación
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2 border border-line sm:w-[300px]" role="radiogroup" aria-label="Período">
          {RANGES.map(r => (
            <button key={r} role="radio" aria-checked={range === r} onClick={() => setRange(r)}
              className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                range === r ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgb(26_22_16/0.08)]' : 'text-ink-500'
              }`}>
              Últimos {r} meses
            </button>
          ))}
        </div>
      </div>

      {!series ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <CardSkeleton lines={3} big />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={6} />
        </div>
      ) : (
        <SeguimientoContent series={series} range={range} selKey={selKey} setSelKey={setSelKey}
          catId={catId} setCatId={setCatId} catName={catName} planPoints={planPoints} outlook={outlook} />
      )}
    </div>
  )
}

