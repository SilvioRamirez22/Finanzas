'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { sumItems, type CommitItem, type MonthCommitments } from '@/lib/seguimiento'

// Comprometido en un mes que todavía no empezó: cuotas, gastos fijos y lo que
// ya está cargado con fecha de ese mes. En un mes futuro reemplaza a
// "Disponible hoy" como primer número del Resumen. Mismo cálculo que
// "Próximos 6 meses" de Seguimiento (commitmentsForMonth).

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

type Row = CommitItem & { estimated?: boolean }

export default function CommittedCard({ year, month, data }: {
  year: number
  month: number
  data: MonthCommitments
}) {
  const [open, setOpen] = useState<string | null>(null)
  const mes = MESES[month - 1]
  const now = new Date()
  const title = `${mes}${year !== now.getFullYear() ? ` ${year}` : ''}`

  const fixedRows: Row[] = [
    ...data.fixedLoaded,
    ...data.fixedEstimated.map(i => ({ ...i, estimated: true })),
  ].sort((a, b) => b.amount - a.amount)
  const groups = [
    {
      key: 'inst', label: 'Cuotas', rows: data.installments as Row[],
      note: data.installments.length === 1 ? '1 cuota' : `${data.installments.length} cuotas`,
    },
    {
      key: 'fixed', label: 'Gastos fijos', rows: fixedRows,
      note: [
        data.fixedLoaded.length > 0 && `${data.fixedLoaded.length} ya ${data.fixedLoaded.length === 1 ? 'cargado' : 'cargados'}`,
        data.fixedEstimated.length > 0 && `${data.fixedEstimated.length} ${data.fixedEstimated.length === 1 ? 'estimado' : 'estimados'}`,
      ].filter(Boolean).join(' · '),
    },
    {
      key: 'other', label: 'Otros ya cargados', rows: data.otherLoaded as Row[],
      note: `con fecha de ${mes}`,
    },
  ].filter(g => g.rows.length > 0)
  const total = groups.reduce((s, g) => s + sumItems(g.rows), 0)

  // Meses de donde salen los fijos estimados: el actual y el anterior.
  const refPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 md:p-5" aria-labelledby="committed-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="committed-title" className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
          Comprometido en {title}
        </h2>
        <Link href="/seguimiento" className="text-xs text-ink-500 hover:text-ink-900 whitespace-nowrap flex-shrink-0">Próximos meses</Link>
      </div>
      <p className="num text-[28px] sm:text-3xl font-semibold mt-1 tracking-tight break-words text-ink-900">
        {formatCurrency(total)}
      </p>
      <p className="text-xs text-ink-500 mt-0.5">
        {total > 0
          ? `Lo que ya sabés que vas a pagar en ${mes}: cuotas, gastos fijos y lo cargado con fecha de ese mes.`
          : `Todavía no hay cuotas, gastos fijos ni nada cargado para ${mes}.`}
      </p>

      {groups.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {groups.map(g => {
            const isOpen = open === g.key
            return (
              <li key={g.key}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.key)} aria-expanded={isOpen}
                  className="w-[calc(100%+1rem)] min-h-[48px] flex items-center gap-2 py-2 text-left hover:bg-surface-2 active:bg-surface-2 -mx-2 px-2 rounded-lg">
                  <ChevronRight size={14} aria-hidden="true"
                    className={`flex-shrink-0 text-ink-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink-900">{g.label}</span>
                    <span className="block text-xs text-ink-500 truncate">{g.note}</span>
                  </span>
                  <span className="num text-sm font-medium text-ink-900 flex-shrink-0">{formatCurrency(sumItems(g.rows))}</span>
                </button>
                {isOpen && (
                  <ul className="ml-1.5 mb-2 pl-3 border-l-2 border-line">
                    {g.rows.map(r => (
                      <li key={r.key} className="flex items-baseline justify-between gap-3 py-1.5">
                        <span className="min-w-0 text-[13px] text-ink-700 truncate">
                          {r.description}
                          {r.installment && <span className="text-ink-500"> ({r.installment})</span>}
                          {r.estimated && <span className="text-ink-500"> · estimado</span>}
                        </span>
                        <span className={`num text-[13px] flex-shrink-0 ${r.estimated ? 'text-ink-500' : 'text-ink-900'}`}>
                          {formatCurrency(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {data.fixedEstimated.length > 0 && (
        <p className="text-xs text-ink-500 mt-2">
          Los fijos estimados salen de los de {MESES[refPrev.getMonth()]} y {MESES[now.getMonth()]}, con el último monto.
          Cuando los cargues en {mes}, cuenta lo cargado.
        </p>
      )}
    </section>
  )
}
