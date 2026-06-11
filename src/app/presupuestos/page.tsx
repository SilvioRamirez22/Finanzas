'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { getBudgets, upsertBudget, deleteBudget, getExpensesByCategory } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency } from '@/lib/format'
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Budget } from '@/types'

export default function PresupuestosPage() {
  const { categories } = useAppStore()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [spentMap, setSpentMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)

  async function load() {
    setLoading(true)
    try {
      const now = new Date()
      const [buds, cats] = await Promise.all([
        getBudgets(),
        getExpensesByCategory(
          format(startOfMonth(now), 'yyyy-MM-dd'),
          format(endOfMonth(now), 'yyyy-MM-dd')
        )
      ])
      setBudgets(buds)
      const map: Record<string, number> = {}
      cats.forEach(c => { map[c.category_id] = c.total })
      setSpentMap(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(b: Budget) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    try {
      await deleteBudget(b.id)
      toast.success('Presupuesto eliminado')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spentMap[b.category_id] || 0), 0)

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Presupuestos</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {/* Resumen global */}
      {budgets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Presupuesto total del mes</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                totalSpent > totalBudget ? 'bg-red-500' :
                totalSpent > totalBudget * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {totalSpent <= totalBudget
              ? `Disponible: ${formatCurrency(totalBudget - totalSpent)}`
              : `Excedido en: ${formatCurrency(totalSpent - totalBudget)}`
            }
          </p>
        </div>
      )}

      {/* Lista de presupuestos */}
      <div className="space-y-2">
        {budgets.map(b => {
          const spent = spentMap[b.category_id] || 0
          const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
          const over = pct > 100
          const warn = pct > 80
          const cat = b.category

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 group transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {cat && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: (cat.color || '#888') + '20' }}>
                      <i className={`ti ti-${cat.icon || 'tag'}`}
                        style={{ fontSize: 14, color: cat.color || '#888' }} />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cat?.name || 'Categoría'}</p>
                    <p className="text-xs text-gray-400 capitalize">{b.period === 'monthly' ? 'Mensual' : 'Anual'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {over ? <AlertCircle size={16} className="text-red-500" /> :
                   warn ? <AlertTriangle size={16} className="text-amber-500" /> :
                   <CheckCircle size={16} className="text-emerald-500" />}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(b); setShowForm(true) }}
                      className="p-1 text-gray-300 hover:text-blue-500 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(b)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-gray-500'}`}>
                  {formatCurrency(spent)} gastados
                </span>
                <span className="text-gray-400">
                  {pct.toFixed(0)}% de {formatCurrency(b.amount)}
                </span>
              </div>

              {over && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠ Excediste el presupuesto en {formatCurrency(spent - b.amount)}
                </p>
              )}
            </div>
          )
        })}

        {!loading && budgets.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <p>No hay presupuestos definidos.</p>
            <p className="text-xs mt-1">Creá uno para controlar tus gastos por categoría.</p>
          </div>
        )}
      </div>

      {showForm && (
        <BudgetForm
          budget={editing}
          categories={categories.filter(c => !c.parent_id && c.type !== 'income')}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function BudgetForm({ budget, categories, onClose, onSuccess }: {
  budget: Budget | null
  categories: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isNew = !budget?.id
  const { register, handleSubmit } = useForm({
    defaultValues: {
      category_id: budget?.category_id || '',
      amount: budget?.amount || '',
      period: budget?.period || 'monthly',
    }
  })
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(data: any) {
    setSubmitting(true)
    try {
      await upsertBudget({
        ...(budget?.id ? { id: budget.id } : {}),
        category_id: data.category_id,
        amount: parseFloat(data.amount),
        period: data.period,
        start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      })
      toast.success(isNew ? 'Presupuesto creado' : 'Presupuesto actualizado')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{isNew ? 'Nuevo presupuesto' : 'Editar presupuesto'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <select {...register('category_id', { required: true })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
              <option value="">Elegir categoría...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Monto presupuestado</label>
            <input {...register('amount', { required: true })} type="number" step="100"
              placeholder="200000"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Período</label>
            <select {...register('period')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Guardando...' : isNew ? 'Crear presupuesto' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
