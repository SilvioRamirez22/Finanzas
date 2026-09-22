'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import toast from 'react-hot-toast'
import Sheet from '@/components/ui/Sheet'
import { getTransactions, createTransactionsBatch, deleteTransactionsByIds } from '@/lib/api'
import { pendingFixed, detectRecurring, statusForDate, type FixedCandidate } from '@/lib/fixed'
import { formatCurrency } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'
import type { TransactionFull } from '@/types'

// Cargar los fijos del mes con un toque (F3): propone los fijos del mes
// anterior que todavía no aparecen; se destilda lo que no va y se corrige el
// monto de lo que cambió (la luz no sale igual todos los meses).

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const pad = (n: number) => String(n).padStart(2, '0')

function range(y: number, m: number) {
  return { date_from: `${y}-${pad(m)}-01`, date_to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` }
}

interface Row {
  c: FixedCandidate<TransactionFull>
  checked: boolean
  amount: string      // dígitos
  detected: boolean   // no estaba marcado como fijo: se repite todos los meses
}

export default function LoadFixedSheet({ open, onClose, year, month }: {
  open: boolean
  onClose: () => void
  year: number
  month: number
}) {
  const notifyDataChanged = useAppStore(s => s.notifyDataChanged)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRows(null)
    setFailed(false)
    const first = new Date(year, month - 4, 1)
    Promise.all([
      // Los 3 meses anteriores: el último para los fijos marcados, los tres
      // para detectar lo que se repite sin estar marcado.
      getTransactions({ date_from: range(first.getFullYear(), first.getMonth() + 1).date_from, date_to: range(prev.year, prev.month).date_to }, 5000, 0),
      getTransactions(range(year, month), 5000, 0),
    ]).then(([b, c]) => {
      if (cancelled) return
      const before = b.data || []
      const cur = c.data || []
      const prevKey = `${prev.year}-${pad(prev.month)}`
      const marked = pendingFixed(before.filter(t => t.date.startsWith(prevKey)), cur, year, month)
      const detected = detectRecurring(before, cur, year, month, new Set(marked.map(m => m.key)))
      const amount = (c: FixedCandidate<TransactionFull>) => String(Math.round(Number(c.source.amount)))
      setRows([
        ...marked.map(c => ({ c, checked: true, amount: amount(c), detected: false })),
        ...detected.map(c => ({ c, checked: false, amount: amount(c), detected: true })),
      ])
    }).catch(e => {
      console.error('Error buscando fijos:', e)
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [open, year, month])

  const chosen = (rows || []).filter(r => r.checked && Number(r.amount) > 0)
  const net = chosen.reduce((s, r) => s + (r.c.source.type === 'income' ? 1 : -1) * Number(r.amount), 0)
  const mes = MESES[month - 1]

  async function load() {
    if (chosen.length === 0) return
    setSaving(true)
    try {
      const ids = await createTransactionsBatch(chosen.map(({ c, amount }) => ({
        type: c.source.type,
        amount: Number(amount),
        date: c.date,
        description: c.source.description,
        account_id: c.source.account_id,
        category_id: c.source.category_id,
        subcategory_id: c.source.subcategory_id,
        payment_method_id: c.source.payment_method_id,
        is_recurring: true,
        status: statusForDate(c.date),
      })))
      notifyDataChanged()
      onClose()
      toast(t => (
        <span className="flex items-center gap-3">
          <span>{ids.length} {ids.length === 1 ? 'fijo cargado' : 'fijos cargados'} en {mes}</span>
          <button className="font-semibold underline underline-offset-2 py-1" onClick={async () => {
            toast.dismiss(t.id)
            try {
              await deleteTransactionsByIds(ids)
              notifyDataChanged()
              toast.success('Listo, no se cargaron')
            } catch (e: any) { toast.error(e.message || 'No se pudo deshacer') }
          }}>
            Deshacer
          </button>
        </span>
      ), { duration: 6000 })
    } catch (e: any) {
      toast.error(e.message || 'No se pudieron cargar')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, patch: Partial<Row>) =>
    setRows(rs => rs && rs.map(r => (r.c.key === key ? { ...r, ...patch } : r)))

  function renderRow({ c, checked, amount }: Row) {
    const t = c.source
    const income = t.type === 'income'
    return (
      <li key={c.key} className="flex items-center gap-3 py-2">
        <button type="button" role="checkbox" aria-checked={checked}
          aria-label={`${checked ? 'No cargar' : 'Cargar'} ${t.description}`}
          onClick={() => update(c.key, { checked: !checked })}
          className="w-11 h-11 -ml-2 flex-shrink-0 flex items-center justify-center">
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? 'bg-brand border-brand text-white' : 'border-line-strong'}`}>
            {checked && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
        <span className={`flex-1 min-w-0 ${checked ? '' : 'opacity-70'}`}>
          <span className="block text-sm text-ink-900 truncate">{t.description}</span>
          <span className="block text-xs text-ink-500 truncate">
            {Number(c.date.slice(8))} {MESES_CORTO[month - 1]}
            {t.category_name && <> · {t.category_name}</>}
            {t.account_name && <> · {t.account_name}</>}
          </span>
        </span>
        <label className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-sm ${income ? 'text-pos' : 'text-ink-500'}`}>{income ? '+$' : '$'}</span>
          <span className="sr-only">Monto de {t.description}</span>
          <input value={amount ? Number(amount).toLocaleString('es-AR') : ''} inputMode="numeric"
            onChange={e => update(c.key, { amount: e.target.value.replace(/\D/g, '').slice(0, 12), checked: true })}
            className="num w-[112px] h-11 rounded-xl border border-line px-2.5 text-right text-base sm:text-sm text-ink-900 outline-none focus:border-brand" />
        </label>
      </li>
    )
  }

  return (
    <Sheet
      open={open}
      title={`Fijos de ${mes}`}
      onRequestClose={onClose}
      footer={rows && rows.length > 0 ? (
        <button type="button" onClick={load} disabled={saving || chosen.length === 0}
          className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:bg-surface-2 disabled:text-ink-500">
          {saving ? 'Cargando…'
            : chosen.length === 0 ? 'Elegí al menos uno'
            : `Cargar ${chosen.length} · ${net < 0 ? '−' : '+'}${formatCurrency(Math.abs(net))}`}
        </button>
      ) : undefined}
    >
      <div className="pb-4">
        {failed ? (
          <p className="text-sm text-neg py-6 text-center">No se pudieron buscar los fijos. Probá de nuevo.</p>
        ) : rows === null ? (
          <div className="space-y-3 py-2" aria-hidden="true">
            {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-ink-900">No falta ningún fijo</p>
            <p className="text-sm text-ink-500 mt-1">
              Todo lo que estaba marcado como fijo en {MESES[prev.month - 1]} ya aparece en {mes}.
              Para sumar otros, marcalos con el ícono ↻ en Movimientos.
            </p>
          </div>
        ) : (
          <>
            {rows.some(r => !r.detected) && (
              <>
                <p className="text-sm text-ink-700 mb-1">
                  Estaban en {MESES[prev.month - 1]} y todavía no aparecen en {mes}. Corregí los montos que cambiaron.
                </p>
                <ul className="divide-y divide-line">{rows.filter(r => !r.detected).map(renderRow)}</ul>
              </>
            )}
            {rows.some(r => r.detected) && (
              <>
                <p className={`text-sm text-ink-700 mb-1 ${rows.some(r => !r.detected) ? 'mt-5' : ''}`}>
                  <b className="font-semibold text-ink-900">Parecen fijos:</b> se repitieron una vez por mes los
                  últimos 3 meses, pero no están marcados. Si los cargás, quedan marcados como fijos.
                </p>
                <ul className="divide-y divide-line">{rows.filter(r => r.detected).map(renderRow)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
