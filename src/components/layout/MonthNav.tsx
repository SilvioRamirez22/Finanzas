'use client'

// Navegador de mes compacto: ‹ Ago 2026 ›
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface MonthValue { year: number; month: number }

export default function MonthNav({ value, onChange }: {
  value: MonthValue
  onChange: (v: MonthValue) => void
}) {
  function shift(delta: number) {
    let m = value.month + delta
    let y = value.year
    while (m > 12) { m -= 12; y += 1 }
    while (m < 1) { m += 12; y -= 1 }
    onChange({ year: y, month: m })
  }

  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => shift(-1)}
        className="px-2.5 py-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ‹
      </button>
      <span className="px-4 py-1.5 text-sm font-medium text-gray-800 min-w-[92px] text-center">
        {MESES[value.month - 1]} {value.year}
      </span>
      <button
        onClick={() => shift(1)}
        className="px-2.5 py-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ›
      </button>
    </div>
  )
}
