'use client'

// Selector de período: rango + año + meses en pastillas.
// Estilo referencia KJ Finance, adaptado a datos de varios años.

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export type RangeType = 'month' | 'last3' | 'last6' | 'last12' | 'year' | 'all'

export interface Period {
  range: RangeType
  year: number
  month: number // 1-12, solo usado cuando range === 'month'
}

const RANGE_LABELS: { value: RangeType; label: string }[] = [
  { value: 'month', label: 'Mes puntual' },
  { value: 'last3', label: 'Últimos 3 meses' },
  { value: 'last6', label: 'Últimos 6 meses' },
  { value: 'last12', label: 'Últimos 12 meses' },
  { value: 'year', label: 'Todo el año' },
  { value: 'all', label: 'Todo el historial' },
]

interface PeriodSelectorProps {
  period: Period
  onChange: (p: Period) => void
  availableYears?: number[]
}

export default function PeriodSelector({ period, onChange, availableYears }: PeriodSelectorProps) {
  const years = availableYears && availableYears.length > 0
    ? availableYears
    : [2024, 2025, 2026]

  const monthsDisabled = period.range !== 'month'
  const yearDisabled = period.range === 'all'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tipo de rango */}
        <select
          value={period.range}
          onChange={e => onChange({ ...period, range: e.target.value as RangeType })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-gray-700 outline-none focus:border-emerald-400"
        >
          {RANGE_LABELS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Año */}
        <select
          value={period.year}
          disabled={yearDisabled}
          onChange={e => onChange({ ...period, year: parseInt(e.target.value) })}
          className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white font-medium outline-none focus:border-emerald-400 ${
            yearDisabled ? 'opacity-40 cursor-not-allowed' : 'text-gray-700'
          }`}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Pastillas de meses */}
        <div className={`flex items-center gap-1 flex-wrap ${monthsDisabled ? 'opacity-30 pointer-events-none' : ''}`}>
          {MESES.map((m, i) => {
            const mNum = i + 1
            const active = !monthsDisabled && mNum === period.month
            return (
              <button
                key={m}
                onClick={() => onChange({ ...period, month: mNum })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Helper: convierte un Period en un rango de fechas {from, to} en formato YYYY-MM-DD
export function periodToDateRange(period: Period): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

  if (period.range === 'all') {
    return { from: '2000-01-01', to: '2099-12-31' }
  }
  if (period.range === 'year') {
    return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
  }
  if (period.range === 'month') {
    const d = lastDay(period.year, period.month)
    return {
      from: `${period.year}-${pad(period.month)}-01`,
      to: `${period.year}-${pad(period.month)}-${pad(d)}`,
    }
  }
  // Rangos "últimos N meses" terminan en el mes/año seleccionado
  const n = period.range === 'last3' ? 3 : period.range === 'last6' ? 6 : 12
  const endY = period.year
  const endM = period.month
  // Calcular mes de inicio
  let startM = endM - (n - 1)
  let startY = endY
  while (startM <= 0) { startM += 12; startY -= 1 }
  const endDay = lastDay(endY, endM)
  return {
    from: `${startY}-${pad(startM)}-01`,
    to: `${endY}-${pad(endM)}-${pad(endDay)}`,
  }
}
