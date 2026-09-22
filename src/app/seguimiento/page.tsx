'use client'
import { useMemo, useState } from 'react'
import { getTransactionsLite } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { useMonthData } from '@/lib/useMonthData'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { MESES, rangeFor, buildSeries } from '@/lib/seguimiento'
import SeguimientoContent from '@/components/seguimiento/SeguimientoContent'

// Seguimiento: cómo evolucionan ingresos, gastos y ahorro (docs/ux/07-SEGUIMIENTO.md).
// Se traen 24 meses una sola vez por mes elegido; 6 o 12 se calculan en memoria.

const RANGES = [6, 12] as const

async function loadRows(year: number, month: number) {
  const { from, to } = rangeFor(year, month, 12)
  return getTransactionsLite(from, to)
}

export default function SeguimientoPage() {
  const { categories, selectedMonth } = useAppStore()
  const { data, error, reload } = useMonthData(loadRows)
  const [range, setRange] = useState<6 | 12>(6)
  const [selKey, setSelKey] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)

  const series = useMemo(
    () => data ? buildSeries(data, selectedMonth.year, selectedMonth.month, range) : null,
    [data, selectedMonth.year, selectedMonth.month, range]
  )

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
        <div className="grid lg:grid-cols-2 gap-3 md:gap-4">
          <CardSkeleton lines={3} big />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={6} />
        </div>
      ) : (
        <SeguimientoContent series={series} range={range} selKey={selKey} setSelKey={setSelKey}
          catId={catId} setCatId={setCatId} catName={catName} />
      )}
    </div>
  )
}

