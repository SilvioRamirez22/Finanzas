'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getExpensesByCategory, getBudgets, upsertBudget, deleteBudget, getTransactions } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Budget, CategoryExpense } from '@/types'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function monthRange(y: number, m: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(y, m, 0).getDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
}
function shiftMonth(y: number, m: number, delta: number) {
  let mm = m + delta, yy = y
  while (mm > 12) { mm -= 12; yy++ }
  while (mm < 1) { mm += 12; yy-- }
  return { year: yy, month: mm }
}

export default function PresupuestosPage() {
  const { categories, budgets, setBudgets, selectedMonth } = useAppStore()
  const { year, month } = selectedMonth

  const [cats, setCats] = useState<CategoryExpense[]>([])
  const [history, setHistory] = useState<{ label: string; pct: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = monthRange(year, month)
      const [c, b] = await Promise.all([
        getExpensesByCategory(from, to),
        getBudgets(),
      ])
      setCats((c || []).filter(x => x.total > 0))
      setBudgets(b || [])

      // Cumplimiento de los últimos 6 meses
      const hist: { label: string; pct: number }[] = []
      const totalBudget = (b || []).reduce((s, x) => s + Number(x.amount), 0)
      for (let i = 5; i >= 0; i--) {
        const mm = shiftMonth(year, month, -i)
        const r = monthRange(mm.year, mm.month)
        const { data } = await getTransactions({ date_from: r.from, date_to: r.to, type: 'expense' }, 5000, 0)
        const spent = (data || []).reduce((s, t) => s + Number(t.amount), 0)
        hist.push({
          label: MESES_CORTO[mm.month - 1],
          pct: totalBudget > 0 ? (spent / totalBudget) * 100 : 0,
        })
      }
      setHistory(hist)
    } finally {
      setLoading(false)
    }
  }, [year, month, setBudgets])

  useEffect(() => { load() }, [load])

  // Filas con presupuesto
  const rows = useMemo(() => {
    return budgets.map(b => {
      const spent = cats.find(c => c.category_id === b.category_id)?.total || 0
      const amount = Number(b.amount)
      const pct = amount > 0 ? (spent / amount) * 100 : 0
      return { budget: b, name: b.category?.name || '—', spent, amount, pct, diff: spent - amount }
    }).sort((a, b) => b.pct - a.pct)
  }, [budgets, cats])

  const totalBudget = rows.reduce((s, r) => s + r.amount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const globalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const overCount = rows.filter(r => r.pct > 100).length

  // Categorías sin presupuesto
  const budgetedIds = new Set(budgets.map(b => b.category_id))
  const noBudget = cats.filter(c => !budgetedIds.has(c.category_id))
  const noBudgetTotal = noBudget.reduce((s, c) => s + c.total, 0)

  const nextMonth = shiftMonth(year, month, 1)
  const goodMonths = history.filter(h => h.pct > 0 && h.pct <= 100).length
  const monthsWithData = history.filter(h => h.pct > 0).length

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-4">
      {/* IZQUIERDA */}
      <div className="space-y-4">
        {/* Presupuesto usado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] tracking-wide text-gray-400 font-medium">PRESUPUESTO USADO</p>
            <button onClick={() => setEditing(true)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Editar presupuestos
            </button>
          </div>
          {totalBudget === 0 ? (
            <div className="py-6">
              <p className="text-sm text-gray-400">
                Todavía no definiste presupuestos. Tocá <b>Editar presupuestos</b> para asignar un monto mensual por categoría.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-4xl font-semibold text-gray-900 tracking-tight">
                  {globalPct.toFixed(0)}%
                </span>
                <span className="text-sm text-gray-500"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                  {formatCurrency(totalSpent)} de {formatCurrency(totalBudget)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {totalSpent <= totalBudget
                  ? <>Te sobraron <b className="text-emerald-800">{formatCurrency(totalBudget - totalSpent)}</b></>
                  : <>Te pasaste por <b className="text-red-600">{formatCurrency(totalSpent - totalBudget)}</b></>}
                {overCount > 0 && <> · {overCount} {overCount === 1 ? 'categoría se pasó' : 'categorías se pasaron'}</>}
              </p>
              <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${globalPct > 100 ? 'bg-red-600' : 'bg-emerald-700'}`}
                  style={{ width: `${Math.min(globalPct, 100)}%` }} />
              </div>
            </>
          )}
        </div>

        {/* Por categoría */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Por categoría</h3>
            <span className="text-xs text-gray-400">Ordenado por desvío</span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-300 py-8 text-center">Sin presupuestos definidos</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map(r => {
                const over = r.pct > 100
                const warn = r.pct > 90
                return (
                  <div key={r.budget.id} className="py-3 flex items-center gap-4">
                    <div className="w-40 flex-shrink-0">
                      <p className="text-sm text-gray-800">{r.name}</p>
                      <p className="text-[11px] text-gray-400"
                         style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                        {formatCurrency(r.spent)} / {formatCurrency(r.amount)}
                      </p>
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden relative">
                      <div className={`h-full ${over ? 'bg-red-600' : warn ? 'bg-amber-500' : 'bg-emerald-700'}`}
                        style={{ width: `${Math.min(r.pct, 100)}%` }} />
                      <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: '100%' }} />
                    </div>
                    <span className={`w-14 text-right text-sm ${over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {r.pct.toFixed(0)}%
                    </span>
                    <span className={`w-28 text-right text-sm ${over ? 'text-red-600' : 'text-gray-500'}`}
                          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      {over ? `+${formatCurrency(r.diff)}` : `${formatCurrency(-r.diff)} libre`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sin presupuesto */}
        {noBudget.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900">Sin presupuesto</h3>
            <p className="text-sm text-gray-500 mt-1"
               style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {formatCurrency(noBudgetTotal)} <span style={{ fontFamily: 'inherit' }} className="font-sans">
                en {noBudget.length} {noBudget.length === 1 ? 'categoría quedó' : 'categorías quedaron'} fuera del plan.
              </span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {noBudget.slice(0, 12).map(c => (
                <span key={c.category_id}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600">
                  {c.category_name} <span className="text-gray-400"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {formatCurrency(c.total)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DERECHA */}
      <div className="space-y-4">
        {/* Cumplimiento */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cumplimiento</h3>
          {totalBudget === 0 ? (
            <p className="text-sm text-gray-300 py-6 text-center">Definí presupuestos para ver el historial</p>
          ) : (
            <>
              <div className="flex items-end gap-2 h-24">
                {history.map((h, i) => {
                  const over = h.pct > 100
                  const height = Math.max(Math.min(h.pct, 130), 8)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded-sm ${
                        h.pct === 0 ? 'bg-gray-200' : over ? 'bg-red-600' : 'bg-emerald-700'
                      }`} style={{ height: `${(height / 130) * 100}%` }} />
                      <span className="text-[11px] text-gray-400">{h.label}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Cerraste dentro del presupuesto <b>{goodMonths}</b> de los últimos {monthsWithData || 6} meses.
              </p>
            </>
          )}
        </div>

        {/* Sugerencias */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Para {MESES[nextMonth.month - 1]}
          </h3>
          {rows.length === 0 && noBudget.length === 0 ? (
            <p className="text-sm text-gray-300 py-4 text-center">Sin sugerencias todavía</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.filter(r => r.pct > 100).slice(0, 2).map(r => (
                <Suggestion key={r.budget.id}
                  title={r.name}
                  detail={`Se pasó este mes · subir a ${formatCurrency(Math.ceil(r.spent / 10000) * 10000)}`}
                  onApply={async () => {
                    await upsertBudget({ id: r.budget.id, category_id: r.budget.category_id, amount: Math.ceil(r.spent / 10000) * 10000, period: 'monthly' })
                    toast.success('Presupuesto actualizado')
                    load()
                  }} />
              ))}
              {rows.filter(r => r.pct < 70 && r.pct > 0).slice(0, 1).map(r => (
                <Suggestion key={r.budget.id}
                  title={r.name}
                  detail={`Usás el ${r.pct.toFixed(0)}% · bajar a ${formatCurrency(Math.ceil(r.spent * 1.15 / 10000) * 10000)}`}
                  onApply={async () => {
                    await upsertBudget({ id: r.budget.id, category_id: r.budget.category_id, amount: Math.ceil(r.spent * 1.15 / 10000) * 10000, period: 'monthly' })
                    toast.success('Presupuesto actualizado')
                    load()
                  }} />
              ))}
              {noBudget.slice(0, 2).map(c => (
                <Suggestion key={c.category_id}
                  title={c.category_name}
                  detail={`${formatCurrency(c.total)} sin presupuesto · crear uno`}
                  onApply={async () => {
                    await upsertBudget({ category_id: c.category_id, amount: Math.ceil(c.total * 1.1 / 10000) * 10000, period: 'monthly' })
                    toast.success('Presupuesto creado')
                    load()
                  }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar presupuestos */}
      {editing && (
        <EditBudgets
          categories={categories.filter(c => !c.parent_id && c.type !== 'income')}
          budgets={budgets}
          cats={cats}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      )}
    </div>
  )
}

function Suggestion({ title, detail, onApply }: { title: string; detail: string; onApply: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-800">{title}</p>
        <p className="text-[11px] text-gray-400">{detail}</p>
      </div>
      <button onClick={onApply}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 flex-shrink-0">
        Aplicar
      </button>
    </div>
  )
}

function EditBudgets({ categories, budgets, cats, onClose, onSaved }: {
  categories: any[]; budgets: Budget[]; cats: CategoryExpense[]
  onClose: () => void; onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    budgets.forEach(b => { v[b.category_id] = String(b.amount) })
    return v
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      for (const cat of categories) {
        const val = values[cat.id]
        const existing = budgets.find(b => b.category_id === cat.id)
        const num = val ? parseFloat(val) : 0
        if (num > 0) {
          await upsertBudget({
            ...(existing ? { id: existing.id } : {}),
            category_id: cat.id, amount: num, period: 'monthly',
          })
        } else if (existing) {
          await deleteBudget(existing.id)
        }
      }
      toast.success('Presupuestos guardados')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Editar presupuestos mensuales</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-gray-100">
          {categories.map(c => {
            const gastoActual = cats.find(x => x.category_id === c.id)?.total || 0
            return (
              <div key={c.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{c.name}</p>
                  {gastoActual > 0 && (
                    <p className="text-[11px] text-gray-400">
                      gastaste {formatCurrency(gastoActual)} este mes
                    </p>
                  )}
                </div>
                <input
                  type="number"
                  value={values[c.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [c.id]: e.target.value }))}
                  placeholder="Sin límite"
                  className="w-36 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-emerald-500"
                />
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
