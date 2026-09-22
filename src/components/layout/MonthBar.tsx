'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Sheet from '@/components/ui/Sheet'
import type { MonthValue } from '@/store/useAppStore'

// Barra de mes (docs/ux/04-GLOBAL-DASHBOARD.md §2.2): es el control que más se
// usa, así que tiene flechas de 44 px, el nombre del mes abre una grilla para
// saltar lejos y "Hoy" vuelve al mes actual cuando estás en otro.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export function shiftMonth(v: MonthValue, delta: number): MonthValue {
  const d = new Date(v.year, v.month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function MonthBar({ value, onChange, className = '' }: {
  value: MonthValue
  onChange: (v: MonthValue) => void
  className?: string
}) {
  const [picking, setPicking] = useState(false)
  const [pickYear, setPickYear] = useState(value.year)
  const now = new Date()
  const isCurrent = value.year === now.getFullYear() && value.month === now.getMonth() + 1
  const arrow = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-ink-700 hover:bg-surface-2 active:bg-muted'

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button type="button" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Mes anterior" className={arrow}>
        <ChevronLeft size={20} />
      </button>
      <button type="button" onClick={() => { setPickYear(value.year); setPicking(true) }}
        aria-label={`Elegir mes (ahora: ${MESES[value.month - 1]} ${value.year})`}
        className="flex-1 min-w-0 h-11 px-2 rounded-lg text-sm font-semibold text-ink-900 hover:bg-surface-2 active:bg-muted whitespace-nowrap">
        {MESES[value.month - 1].charAt(0).toUpperCase() + MESES[value.month - 1].slice(1)} {value.year}
      </button>
      {!isCurrent && (
        <button type="button" onClick={() => onChange({ year: now.getFullYear(), month: now.getMonth() + 1 })}
          className="h-8 px-2.5 rounded-full border border-line text-xs font-semibold text-brand-ink hover:bg-surface-2 flex-shrink-0">
          Hoy
        </button>
      )}
      <button type="button" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Mes siguiente" className={arrow}>
        <ChevronRight size={20} />
      </button>

      <Sheet open={picking} title="Elegir mes" onRequestClose={() => setPicking(false)}>
        <div className="pb-5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setPickYear(pickYear - 1)} aria-label="Año anterior" className={arrow}>
              <ChevronLeft size={20} />
            </button>
            <span className="text-base font-semibold text-ink-900 num">{pickYear}</span>
            <button type="button" onClick={() => setPickYear(pickYear + 1)} aria-label="Año siguiente" className={arrow}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {MESES_CORTO.map((m, i) => {
              const selected = pickYear === value.year && i + 1 === value.month
              const today = pickYear === now.getFullYear() && i === now.getMonth()
              return (
                <button key={m} type="button" aria-pressed={selected}
                  onClick={() => { onChange({ year: pickYear, month: i + 1 }); setPicking(false) }}
                  className={`h-12 rounded-xl border text-sm capitalize ${
                    selected ? 'bg-brand text-white border-brand font-semibold'
                      : today ? 'border-brand text-brand-ink font-semibold'
                      : 'border-line text-ink-900 hover:bg-surface-2'
                  }`}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
