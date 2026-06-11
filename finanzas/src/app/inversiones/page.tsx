'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { getInvestments, upsertInvestment } from '@/lib/api'
import { formatCurrency, formatDate, formatPct } from '@/lib/format'
import { Plus, TrendingUp, TrendingDown, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Investment, InvestmentType } from '@/types'

const typeLabels: Record<InvestmentType, string> = {
  stock: 'Acciones',
  cedear: 'CEDEARs',
  mutual_fund: 'Fondos comunes',
  crypto: 'Criptomonedas',
  bond: 'Bonos',
  other: 'Otros',
}

export default function InversionesPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)

  async function load() {
    setLoading(true)
    try {
      setInvestments(await getInvestments())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalInvested = investments.reduce((s, i) => s + i.buy_price * i.quantity, 0)
  const totalCurrent = investments.reduce((s, i) =>
    s + (i.current_price != null ? i.current_price * i.quantity : i.buy_price * i.quantity), 0)
  const totalPL = totalCurrent - totalInvested
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inversiones</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Invertido</p>
          <p className="text-base font-semibold text-gray-900">{formatCurrency(totalInvested, 'ARS', true)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Valor actual</p>
          <p className="text-base font-semibold text-gray-900">{formatCurrency(totalCurrent, 'ARS', true)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${totalPL >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-500 mb-1">Resultado</p>
          <p className={`text-base font-semibold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatCurrency(totalPL, 'ARS', true)}
          </p>
          <p className={`text-xs ${totalPL >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {formatPct(totalPLPct)}
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {investments.map(inv => {
          const pl = inv.profit_loss || 0
          const plPct = inv.profit_loss_pct || 0
          return (
            <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{inv.ticker}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {typeLabels[inv.type]}
                    </span>
                  </div>
                  {inv.name && <p className="text-sm text-gray-500 mt-0.5">{inv.name}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {inv.quantity} unidades × {formatCurrency(inv.buy_price)} c/u · {formatDate(inv.buy_date)}
                  </p>
                </div>
                <div className="text-right">
                  {inv.current_price != null ? (
                    <>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(inv.current_price * inv.quantity, 'ARS', true)}
                      </p>
                      <p className={`text-xs flex items-center gap-1 justify-end mt-0.5 ${pl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {formatPct(plPct)} ({formatCurrency(pl, 'ARS', true)})
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Sin precio actual</p>
                  )}
                  <button
                    onClick={() => { setEditing(inv); setShowForm(true) }}
                    className="text-xs text-gray-300 hover:text-gray-600 mt-1"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {!loading && investments.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No hay inversiones registradas
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <InvestmentForm
          investment={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function InvestmentForm({ investment, onClose, onSuccess }: {
  investment: Investment | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: investment ? {
      ticker: investment.ticker,
      name: investment.name || '',
      type: investment.type,
      quantity: investment.quantity,
      buy_price: investment.buy_price,
      buy_date: investment.buy_date,
      current_price: investment.current_price || '',
      currency: investment.currency,
      notes: investment.notes || '',
    } : {
      type: 'cedear' as InvestmentType,
      currency: 'ARS',
      buy_date: new Date().toISOString().split('T')[0],
    },
  })
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(data: any) {
    setSubmitting(true)
    try {
      await upsertInvestment({
        ...(investment ? { id: investment.id } : {}),
        ticker: data.ticker.toUpperCase(),
        name: data.name || null,
        type: data.type,
        quantity: parseFloat(data.quantity),
        buy_price: parseFloat(data.buy_price),
        buy_date: data.buy_date,
        current_price: data.current_price ? parseFloat(data.current_price) : null,
        currency: data.currency,
        notes: data.notes || null,
      })
      toast.success(investment ? 'Inversión actualizada' : 'Inversión agregada')
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
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{investment ? 'Editar inversión' : 'Nueva inversión'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ticker / Símbolo</label>
              <input {...register('ticker', { required: true })}
                placeholder="AAPL, GGAL, BTC..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select {...register('type')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre (opcional)</label>
            <input {...register('name')} placeholder="Apple Inc." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
              <input {...register('quantity', { required: true })} type="number" step="0.00000001" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio de compra</label>
              <input {...register('buy_price', { required: true })} type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha de compra</label>
              <input {...register('buy_date')} type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio actual (opc.)</label>
              <input {...register('current_price')} type="number" step="0.01" placeholder="Para calcular rendimiento" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
              <select {...register('currency')} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notas</label>
            <input {...register('notes')} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Guardando...' : investment ? 'Guardar cambios' : 'Agregar inversión'}
          </button>
        </form>
      </div>
    </div>
  )
}
