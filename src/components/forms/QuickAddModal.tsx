'use client'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createTransaction, updateTransactionFromForm, updateInstallments } from '@/lib/api'
import { todayISO, formatCurrency } from '@/lib/format'
import toast from 'react-hot-toast'
import type { TransactionFormData, TransactionFull } from '@/types'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// "2026-09" de una fecha "2026-09-22".
const monthKey = (iso: string) => iso.slice(0, 7)

// "septiembre", o "septiembre 2025" si no es el año de `refYear`.
function monthName(year: number, month: number, refYear: number) {
  return year === refYear ? MESES[month - 1] : `${MESES[month - 1]} ${year}`
}

// La fecha que conviene sugerir para cargar algo en el mes que se está
// mirando: hoy si es este mes, el último día si es un mes pasado, el primero
// si es uno futuro.
function suggestedDate(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = todayISO()
  const key = `${year}-${pad(month)}`
  if (monthKey(today) === key) return today
  if (key < monthKey(today)) return `${key}-${pad(new Date(year, month, 0).getDate())}`
  return `${key}-01`
}

// "31 de agosto"
function dayName(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]}`
}

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
  // Mínimo 1: al editar, 1 cuota = gasto normal. Al crear, las cuotas
  // solo se generan si hay 2 o más.
  installments_total: z.number({ invalid_type_error: 'Ingresá la cantidad de cuotas' }).min(1, 'Mínimo 1').max(120, 'Máximo 120').optional(),
  transfer_to_account_id: z.string().optional(),
  // Tiene que estar en el schema: zod descarta los campos que no conoce.
  is_recurring: z.boolean().optional(),
})

interface QuickAddProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  // Si viene, el formulario edita ese movimiento en vez de crear uno nuevo.
  transaction?: TransactionFull | null
}

// Pasa un movimiento guardado a los valores del formulario.
function formFromTransaction(t: TransactionFull): TransactionFormData {
  return {
    type: t.type,
    amount: String(t.amount),
    date: t.date,
    description: t.description,
    account_id: t.account_id,
    category_id: t.category_id || '',
    subcategory_id: t.subcategory_id || '',
    transfer_to_account_id: t.transfer_to_account_id || '',
    has_installments: false,
    installments_total: t.installments_total,
    is_recurring: t.is_recurring,
  }
}

export default function QuickAddModal({ open, onClose, onSuccess, transaction }: QuickAddProps) {
  const isEdit = !!transaction
  const { accounts, profile, categoriesWithSubs, selectedMonth, setSelectedMonth, notifyDataChanged } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  // Al editar cuotas: copiar los cambios a todo el grupo o solo a esta cuota.
  const [applyToAll, setApplyToAll] = useState(true)
  const amountRef = useRef<HTMLInputElement | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: 'expense',
      date: todayISO(),
      has_installments: false,
      installments_total: 2,
      is_recurring: false,
    },
  })

  const type = watch('type')
  const categoryId = watch('category_id')
  const hasInstallments = watch('has_installments')
  const amountWatch = watch('amount')
  const installmentsWatch = watch('installments_total')
  const dateWatch = watch('date') || ''

  // El mes que se está mirando y el de la fecha del movimiento pueden no
  // coincidir (por ejemplo, revisando agosto y cargando con la fecha de hoy).
  // Si no se avisa, el movimiento se guarda y "desaparece" de la pantalla.
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const viewKey = `${selectedMonth.year}-${pad2(selectedMonth.month)}`
  const dateYear = Number(dateWatch.slice(0, 4))
  const dateMonth = Number(dateWatch.slice(5, 7))
  const dateChanged = !transaction || transaction.date !== dateWatch
  const outsideView = /^\d{4}-\d{2}/.test(dateWatch) && monthKey(dateWatch) !== viewKey && dateChanged
  const viewDate = suggestedDate(selectedMonth.year, selectedMonth.month)

  useEffect(() => {
    if (open) {
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      reset({ type: 'expense', date: todayISO(), has_installments: false, installments_total: 2, is_recurring: false })
      setApplyToAll(true)
    } else if (transaction) reset(formFromTransaction(transaction))
  }, [open, transaction])

  // Datos de cuotas del movimiento que se edita.
  const origTotal = transaction?.installments_total ?? 1
  const editingNumber = origTotal > 1 ? transaction!.installment_number : 1
  const editTotal = Number.isFinite(installmentsWatch) ? Number(installmentsWatch) : origTotal

  const selectedCategory = categoriesWithSubs().find(c => c.id === categoryId)
  const subcategories = selectedCategory?.subcategories || []

  // Si cambia la categoría, la subcategoría anterior ya no corresponde.
  // Sin esto, al editar quedaba guardada una subcategoría de otra categoría.
  const subcategoryId = watch('subcategory_id')
  useEffect(() => {
    if (subcategoryId && !subcategories.some(s => s.id === subcategoryId)) {
      setValue('subcategory_id', '')
    }
  }, [categoryId])

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
      if (transaction) {
        const newTotal = data.installments_total ?? origTotal
        // Pasa por la lógica de cuotas si cambia la cantidad, o si hay que
        // copiar los cambios a todas las cuotas del grupo.
        if (data.type === 'expense' && (newTotal !== origTotal || (origTotal > 1 && applyToAll))) {
          await updateInstallments(transaction, data, newTotal, applyToAll)
        } else {
          await updateTransactionFromForm(transaction.id, data)
        }
        notifySaved('Cambios guardados', data.date)
      } else {
        await createTransaction(data, profile.id)
        notifySaved(
          data.type === 'income' ? 'Ingreso registrado'
            : data.type === 'expense' ? 'Gasto registrado' : 'Transferencia registrada',
          data.date
        )
      }
      notifyDataChanged()
      onSuccess?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // Si lo que se guardó cae fuera del mes que se está mirando, el aviso lo dice
  // y ofrece ir a ese mes. Si cae adentro, el aviso normal alcanza.
  function notifySaved(what: string, date: string) {
    if (monthKey(date) === viewKey) {
      toast.success(what)
      return
    }
    const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7))
    const name = monthName(y, m, selectedMonth.year)
    toast.success(t => (
      <span className="flex items-center gap-3">
        <span>{what} en {name}</span>
        <button
          onClick={() => { setSelectedMonth({ year: y, month: m }); toast.dismiss(t.id) }}
          className="font-semibold underline underline-offset-2 whitespace-nowrap py-1"
        >
          Ver {MESES[m - 1]}
        </button>
      </span>
    ), { duration: 6000 })
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
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
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
            {(hasInstallments || (isEdit && type === 'expense' && editTotal > 1)) && (
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

          {/* Cuotas al editar: cambiar la cantidad y a qué cuotas aplicar. */}
          {isEdit && type === 'expense' && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="edit-installments" className="text-sm text-gray-700">
                  Cantidad de cuotas
                  {origTotal > 1 && (
                    <span className="block text-xs text-gray-400">
                      Estás editando la cuota {editingNumber} de {origTotal}
                    </span>
                  )}
                </label>
                <input
                  id="edit-installments"
                  type="number"
                  min={editingNumber}
                  max={120}
                  inputMode="numeric"
                  {...register('installments_total', { valueAsNumber: true })}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-emerald-400 bg-white"
                />
              </div>
              {errors.installments_total && (
                <p className="text-xs text-red-500">{errors.installments_total.message}</p>
              )}
              {editTotal < editingNumber && (
                <p className="text-xs text-red-500">
                  No puede haber menos de {editingNumber} cuotas: estás editando la cuota {editingNumber}.
                </p>
              )}

              {origTotal > 1 && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={e => setApplyToAll(e.target.checked)}
                    className="rounded mt-0.5"
                  />
                  <span className="text-sm text-gray-700">
                    Aplicar los cambios a todas las cuotas
                    <span className="block text-xs text-gray-400">
                      {applyToAll
                        ? 'Monto, descripción, cuenta, categoría y fechas se copian a todas.'
                        : 'Solo cambia esta cuota.'}
                    </span>
                  </span>
                </label>
              )}

              {editTotal !== origTotal && editTotal >= editingNumber && (
                <p className="text-xs text-emerald-700 font-medium">
                  {editTotal > origTotal
                    ? `Se ${editTotal - origTotal === 1 ? 'agrega 1 cuota' : `agregan ${editTotal - origTotal} cuotas`}, una por mes.`
                    : `Se ${origTotal - editTotal === 1 ? 'borra la última cuota' : `borran las últimas ${origTotal - editTotal} cuotas`}.`}
                  {editTotal > 1 && amountWatch && !isNaN(parseFloat(amountWatch)) &&
                    ` Total: ${editTotal} × ${formatCurrency(parseFloat(amountWatch))} = ${formatCurrency(parseFloat(amountWatch) * editTotal)}`}
                </p>
              )}
            </div>
          )}

          {/* Cuotas (solo al crear) */}
          {type === 'expense' && !isEdit && (
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

          {/* Gasto fijo / recurrente. No aplica a cuotas: esas ya se generan solas. */}
          {type !== 'transfer' && !hasInstallments && (
            <label className="flex items-start gap-2 cursor-pointer bg-indigo-50/60 rounded-xl p-3">
              <input
                type="checkbox"
                {...register('is_recurring')}
                className="rounded mt-0.5"
              />
              <span className="text-sm text-gray-700">
                {type === 'expense' ? 'Gasto fijo' : 'Ingreso fijo'}
                <span className="block text-xs text-gray-400">
                  Se repite todos los meses (expensas, luz, internet...)
                </span>
              </span>
            </label>
          )}

          {/* Aviso de mes: se va a guardar fuera del mes que se está mirando. */}
          {outsideView && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm" role="status">
              <p className="text-amber-900">
                {isEdit ? 'Se va a mover a ' : 'Se va a guardar en '}
                <b>{monthName(dateYear, dateMonth, selectedMonth.year)}</b>
                <span className="text-amber-800"> · estás viendo {monthName(selectedMonth.year, selectedMonth.month, dateYear)}</span>
              </p>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setValue('date', viewDate, { shouldDirty: true })}
                  className="mt-1.5 font-medium text-amber-900 underline underline-offset-2 py-1"
                >
                  Usar {dayName(viewDate)}
                </button>
              )}
            </div>
          )}

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
            {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : type === 'expense' ? 'Registrar gasto' : type === 'income' ? 'Registrar ingreso' : 'Registrar transferencia'}
          </button>
        </form>
      </div>
    </div>
  )
}

