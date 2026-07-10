'use client'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createTransaction } from '@/lib/api'
import { todayISO, formatCurrency } from '@/lib/format'
import toast from 'react-hot-toast'
import type { TransactionFormData } from '@/types'

const schema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Ingresá un monto').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  date: z.string().min(1),
  description: z.string().min(1, 'Agregá una descripción'),
  account_id: z.string().min(1, 'Elegí una cuenta'),
  category_id: z.string().optional(),
  subcategory_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  notes: z.string().optional(),
  has_installments: z.boolean(),
  installments_total: z.number().min(2).max(120).optional(),
  transfer_to_account_id: z.string().optional(),
})

interface QuickAddProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function QuickAddModal({ open, onClose, onSuccess }: QuickAddProps) {
  const { accounts, paymentMethods, profile, categoriesWithSubs } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const amountRef = useRef<HTMLInputElement | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: 'expense',
      date: todayISO(),
      has_installments: false,
      installments_total: 2,
    },
  })

  const type = watch('type')
  const categoryId = watch('category_id')
  const hasInstallments = watch('has_installments')
  const amountWatch = watch('amount')
  const installmentsWatch = watch('installments_total')

  useEffect(() => {
    if (open) {
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) reset({ type: 'expense', date: todayISO(), has_installments: false })
  }, [open])

  const selectedCategory = categoriesWithSubs().find(c => c.id === categoryId)
  const subcategories = selectedCategory?.subcategories || []

  const filteredCategories = categoriesWithSubs().filter(c =>
    type === 'income' ? c.type !== 'expense' : c.type !== 'income'
  )

  // Total estimado si es en cuotas (monto x cantidad)
  const cuotaTotal = hasInstallments && amountWatch && installmentsWatch
    ? parseFloat(amountWatch) * installmentsWatch
    : null

  async function onSubmit(data: TransactionFormData) {
    if (!profile) return
    setSubmitting(true)
    try {
      await createTransaction(data, profile.id)
      toast.success(data.type === 'income' ? 'Ingreso registrado' : 'Gasto registrado')
      onSuccess?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto shadow-xl">

        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo movimiento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">

          {/* Tipo */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-medium">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={`flex-1 py-2.5 transition-colors ${
                  type === t
                    ? t === 'expense' ? 'bg-red-50 text-red-600'
                      : t === 'income' ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'expense' ? 'Gasto' : t === 'income' ? 'Ingreso' : 'Transferencia'}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div>
            <div className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-colors ${
              errors.amount ? 'border-red-300' : 'border-gray-200 focus-within:border-emerald-400'
            }`}>
              <span className="text-2xl text-gray-400 font-light">$</span>
              <input
                {...register('amount')}
                ref={(e) => {
                  register('amount').ref(e)
                  amountRef.current = e
                }}
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                inputMode="decimal"
                className="flex-1 text-3xl font-semibold text-gray-900 outline-none bg-transparent placeholder-gray-300"
              />
            </div>
            {hasInstallments && (
              <p className="text-xs text-gray-500 mt-1">
                Este es el valor de <b>cada cuota</b>
              </p>
            )}
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          {/* Descripción */}
          <div>
            <input
              {...register('description')}
              type="text"
              placeholder="Descripción..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          {/* Fecha + Cuenta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
              <input
                {...register('date')}
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cuenta</label>
              <select
                {...register('account_id')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
              >
                <option value="">Elegir...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {errors.account_id && <p className="text-xs text-red-500 mt-1">Requerido</p>}
            </div>
          </div>

          {/* Categoría + Subcategoría */}
          {type !== 'transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select
                  {...register('category_id')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                >
                  <option value="">Sin categoría</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {subcategories.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subcategoría</label>
                  <select
                    {...register('subcategory_id')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                  >
                    <option value="">Sin sub.</option>
                    {subcategories.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Cuenta destino (transferencia) */}
          {type === 'transfer' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cuenta destino</label>
              <select
                {...register('transfer_to_account_id')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
              >
                <option value="">Elegir destino...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Medio de pago */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Medio de pago</label>
            <select
              {...register('payment_method_id')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
            >
              <option value="">Sin especificar</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          {/* Cuotas */}
          {type === 'expense' && (
            <div className="bg-gray-50 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('has_installments')}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Pago en cuotas</span>
              </label>
              {hasInstallments && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">Cantidad de cuotas</label>
                  <input
                    type="number"
                    min={2}
                    max={120}
                    placeholder="Ej: 12"
                    {...register('installments_total', { valueAsNumber: true })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  />
                  {cuotaTotal !== null && !isNaN(cuotaTotal) && (
                    <p className="text-xs text-emerald-700 mt-2 font-medium">
                      {installmentsWatch} cuotas de {formatCurrency(parseFloat(amountWatch))} = {formatCurrency(cuotaTotal)} total
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Se crean las cuotas futuras automáticamente, una por mes
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div>
            <input
              {...register('notes')}
              type="text"
              placeholder="Notas (opcional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`
              w-full py-3.5 rounded-xl text-white font-medium text-sm transition-colors
              ${type === 'expense' ? 'bg-red-500 hover:bg-red-600'
                : type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-500 hover:bg-blue-600'}
              disabled:opacity-50
            `}
          >
            {submitting ? 'Guardando...' : type === 'expense' ? 'Registrar gasto' : type === 'income' ? 'Registrar ingreso' : 'Registrar transferencia'}
          </button>
        </form>
      </div>
    </div>
  )
}

