'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { getCategories, upsertCategory, deleteCategory, reorderCategories } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import { Plus, Edit2, Trash2, X, ChevronRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Category, CategoryType } from '@/types'

const typeOpts: { value: CategoryType; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'both', label: 'Ambos' },
]

const COLORS = ['#1D9E75','#378ADD','#D85A30','#534AB7','#BA7517','#E24B4A','#D4537E','#888780','#5DCAA5','#85B7EB']
const ICONS = ['tag','shopping-cart','car','home','heart','school','device-gamepad','bolt','coffee','briefcase','shirt','barbell','tool','wifi','cash','trending-up','gift','flame','shield','building']

export default function CategoriasPage() {
  const { setCategories: setStoreCategories } = useAppStore()
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [expandedParent, setExpandedParent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense')

  async function load() {
    setLoading(true)
    try {
      const data = await getCategories()
      setCats(data)
      setStoreCategories(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(cat: Category) {
    const hasSubs = cats.some(c => c.parent_id === cat.id)
    if (hasSubs) {
      toast.error('Eliminá las subcategorías primero')
      return
    }
    if (!confirm(`¿Eliminar "${cat.name}"?`)) return
    try {
      await deleteCategory(cat.id)
      toast.success('Categoría eliminada')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const roots = cats.filter(c => !c.parent_id && c.type !== 'income')
  const rootsIncome = cats.filter(c => !c.parent_id && c.type !== 'expense')
  const displayed = activeTab === 'expense' ? roots : rootsIncome

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Categorías</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {(['expense', 'income'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t === 'expense' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-1.5">
        {displayed.map(cat => {
          const subs = cats.filter(c => c.parent_id === cat.id)
          const isExpanded = expandedParent === cat.id
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:border-gray-200 group">
                <GripVertical size={14} className="text-gray-200 cursor-grab" />
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0"
                  style={{ background: cat.color }}>
                  <i className={`ti ti-${cat.icon}`} style={{ fontSize: 14 }} />
                </div>
                <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
                {subs.length > 0 && (
                  <button onClick={() => setExpandedParent(isExpanded ? null : cat.id)}
                    className="text-xs text-gray-400 flex items-center gap-1">
                    {subs.length} subs
                    <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(cat); setShowForm(true) }}
                    className="p-1 text-gray-300 hover:text-blue-500 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(cat)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Subcategorías */}
              {isExpanded && subs.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-100 px-3 py-2 ml-6 mt-1 hover:border-gray-200 group">
                  <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs flex-shrink-0"
                    style={{ background: sub.color }}>
                    <i className={`ti ti-${sub.icon}`} style={{ fontSize: 12 }} />
                  </div>
                  <span className="flex-1 text-sm text-gray-600">{sub.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(sub); setShowForm(true) }}
                      className="p-1 text-gray-300 hover:text-blue-500 transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(sub)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Agregar subcategoría */}
              {isExpanded && (
                <button
                  onClick={() => { setEditing({ parent_id: cat.id } as any); setShowForm(true) }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 ml-6 mt-1 px-3 py-1.5"
                >
                  <Plus size={12} /> Agregar subcategoría
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!loading && displayed.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No hay categorías. Creá la primera.
        </div>
      )}

      {showForm && (
        <CategoryForm
          category={editing}
          parentCategories={cats.filter(c => !c.parent_id)}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function CategoryForm({ category, parentCategories, onClose, onSuccess }: {
  category: Category | null
  parentCategories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isNew = !category?.id
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      name: category?.name || '',
      parent_id: category?.parent_id || '',
      type: category?.type || 'expense' as CategoryType,
      color: category?.color || COLORS[0],
      icon: category?.icon || 'tag',
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const selectedColor = watch('color')
  const selectedIcon = watch('icon')

  async function onSubmit(data: any) {
    setSubmitting(true)
    try {
      await upsertCategory({
        ...(category?.id ? { id: category.id } : {}),
        name: data.name,
        parent_id: data.parent_id || null,
        type: data.type as CategoryType,
        color: data.color,
        icon: data.icon,
      })
      toast.success(isNew ? 'Categoría creada' : 'Categoría actualizada')
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
          <h2 className="font-semibold">{isNew ? 'Nueva categoría' : 'Editar categoría'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <input {...register('name', { required: true })}
              placeholder="Ej: Supermercado"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select {...register('type')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                {typeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subcategoría de</label>
              <select {...register('parent_id')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-400">
                <option value="">Ninguna (categoría raíz)</option>
                {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Colores */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Íconos */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} type="button"
                  onClick={() => setValue('icon', ic)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    selectedIcon === ic ? 'text-white' : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                  }`}
                  style={selectedIcon === ic ? { background: selectedColor } : {}}>
                  <i className={`ti ti-${ic}`} style={{ fontSize: 16 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: selectedColor }}>
              <i className={`ti ti-${selectedIcon} text-white`} style={{ fontSize: 16 }} />
            </div>
            <span className="text-sm text-gray-700">{watch('name') || 'Vista previa'}</span>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Guardando...' : isNew ? 'Crear categoría' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
