'use client'
import { useState } from 'react'

// Cuándo vence cada cuota, debajo de la elección de cuotas en la carga y en la
// edición. Con muchas cuotas muestra las primeras, la que se edita y la
// última, y el resto con "Ver todas".

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const COLLAPSE_OVER = 12

// "6 oct", o "6 ene 2027" si no es el año de hoy
export function dueLabel(iso: string, today: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${String(y) !== today.slice(0, 4) ? ` ${y}` : ''}`
}

export default function InstallmentSchedule({ dates, today, current }: {
  dates: string[]     // una fecha por cuota, de la primera a la última
  today: string
  current?: number    // número de la cuota que se está editando
}) {
  const [expanded, setExpanded] = useState(false)
  const total = dates.length
  const last = dates[total - 1]
  const remaining = dates.filter(d => d > today).length

  const summary = current === undefined
    ? `Una por mes, hasta el ${dueLabel(last, today)}`
    : remaining === 0 ? 'Ya pasaron todas'
    : `${remaining === 1 ? 'Queda 1 cuota' : `Quedan ${remaining} cuotas`}, hasta el ${dueLabel(last, today)}`

  // Índices a la vista; null marca un salto ("…").
  const collapsed = total > COLLAPSE_OVER && !expanded
  const shown = new Set<number>()
  for (let i = 0; i < total; i++) {
    const nearCurrent = current !== undefined && Math.abs(i + 1 - current) <= 1
    if (!collapsed || i < 6 || i === total - 1 || nearCurrent) shown.add(i)
  }
  const items: (number | null)[] = []
  for (let i = 0; i < total; i++) {
    if (shown.has(i)) items.push(i)
    else if (items[items.length - 1] !== null) items.push(null)
  }

  return (
    <div>
      <p className="text-xs text-ink-500">
        <span className="font-medium text-ink-700">Vencimientos</span> · {summary}
      </p>
      <ol className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
        {items.map((i, n) => {
          if (i === null) return <li key={`gap-${n}`} aria-hidden="true" className="px-2 py-1 text-sm text-ink-500">…</li>
          const d = dates[i]
          const isCurrent = current === i + 1
          const past = d < today
          return (
            <li key={i} aria-current={isCurrent ? 'true' : undefined}
              className={`flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-sm num ${
                isCurrent ? 'bg-brand-soft text-brand-ink font-medium' : past ? 'text-ink-500' : 'text-ink-900'
              }`}>
              <span className={`text-xs ${isCurrent ? '' : 'text-ink-500'}`}>{i + 1}/{total}</span>
              <span>
                {d === today ? 'hoy' : dueLabel(d, today)}
                {past && !isCurrent && <span className="sr-only"> (ya pasó)</span>}
                {isCurrent && <span className="sr-only"> (esta)</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {total > COLLAPSE_OVER && (
        <button type="button" onClick={() => setExpanded(e => !e)}
          className="mt-1 h-9 px-2 -ml-2 text-xs font-medium text-brand-ink">
          {expanded ? 'Ver menos' : `Ver las ${total} fechas`}
        </button>
      )}
    </div>
  )
}
