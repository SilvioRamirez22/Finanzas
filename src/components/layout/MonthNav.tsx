'use client'

// Navegador de mes compacto: ‹ Ago 2026 ›
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface MonthValue { year: number; month: number }

export default function MonthNav({ value, onChange, compact = false }: {
  value: MonthValue
  onChange: (v: MonthValue) => void
  // compact: versión para el celular. Muestra "Sep '26" en una sola línea y
  // usa flechas más chicas, para que entre junto al resto del header.
  compact?: boolean
}) {
  function shift(delta: number) {
    let m = value.month + delta
    let y = value.year
    while (m > 12) { m -= 12; y += 1 }
    while (m < 1) { m += 12; y -= 1 }
    onChange({ year: y, month: m })
  }

  const label = compact
    ? `${MESES[value.month - 1]} '${String(value.year).slice(-2)}`
    : `${MESES[value.month - 1]} ${value.year}`

  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => shift(-1)}
        aria-label="Mes anterior"
        className={`text-gray-400 hover:text-gray-700 active:bg-gray-100 hover:bg-gray-50 transition-colors ${
          compact ? 'px-2 py-2 leading-none' : 'px-2.5 py-1.5'
        }`}
      >
        ‹
      </button>
      <span className={`font-medium text-gray-800 text-center whitespace-nowrap ${
        compact ? 'px-1.5 py-1.5 text-xs min-w-[58px]' : 'px-4 py-1.5 text-sm min-w-[92px]'
      }`}>
        {label}
      </span>
      <button
        onClick={() => shift(1)}
        aria-label="Mes siguiente"
        className={`text-gray-400 hover:text-gray-700 active:bg-gray-100 hover:bg-gray-50 transition-colors ${
          compact ? 'px-2 py-2 leading-none' : 'px-2.5 py-1.5'
        }`}
      >
        ›
      </button>
    </div>
  )
}
