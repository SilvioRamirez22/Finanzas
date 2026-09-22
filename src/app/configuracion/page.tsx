'use client'
import { useState, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { parseImportFile, mapImportRows, exportTransactionsToExcel, exportTransactionsToCSV } from '@/lib/exportImport'
import { getAllTransactionsForExport } from '@/lib/api'
import { createTransaction } from '@/lib/api'
import { formatCurrency, todayISO } from '@/lib/format'
import { Download, Upload, LogOut, ChevronRight, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ImportColumn } from '@/lib/exportImport'

const APP_FIELDS = [
  { value: 'date', label: 'Fecha' },
  { value: 'description', label: 'Descripción' },
  { value: 'amount', label: 'Monto' },
  { value: 'type', label: 'Tipo (Ingreso/Gasto)' },
  { value: 'category', label: 'Categoría' },
  { value: 'account', label: 'Cuenta' },
  { value: 'notes', label: 'Notas' },
]

export default function ConfiguracionPage() {
  const { profile, accounts, categories } = useAppStore()
  const [importStep, setImportStep] = useState<'idle' | 'mapping' | 'preview' | 'done'>('idle')
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importRows, setImportRows] = useState<any[]>([])
  const [mapping, setMapping] = useState<ImportColumn[]>([])
  const [mappedRows, setMappedRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { headers, rows } = await parseImportFile(file)
      setImportHeaders(headers)
      setImportRows(rows)
      setMapping(headers.map(h => ({ fileColumn: h, appField: guessField(h) })))
      setImportStep('mapping')
    } catch (err: any) {
      toast.error('Error leyendo el archivo: ' + err.message)
    }
  }

  function guessField(header: string): string | null {
    const h = header.toLowerCase()
    if (h.includes('fecha') || h.includes('date')) return 'date'
    if (h.includes('desc') || h.includes('concepto') || h.includes('detalle')) return 'description'
    if (h.includes('monto') || h.includes('importe') || h.includes('amount')) return 'amount'
    if (h.includes('tipo') || h.includes('type')) return 'type'
    if (h.includes('categ')) return 'category'
    if (h.includes('cuenta') || h.includes('account')) return 'account'
    if (h.includes('nota') || h.includes('obs')) return 'notes'
    return null
  }

  function applyMapping() {
    const rows = mapImportRows(importRows, mapping, accounts, categories)
    setMappedRows(rows)
    setImportStep('preview')
  }

  async function confirmImport() {
    if (!profile) return
    setImporting(true)
    let ok = 0; let fail = 0
    for (const row of mappedRows) {
      try {
        await createTransaction(row, profile.id)
        ok++
      } catch { fail++ }
    }
    toast.success(`${ok} movimientos importados${fail > 0 ? ` (${fail} errores)` : ''}`)
    setImportStep('done')
    setImporting(false)
  }

  async function handleExportAll() {
    try {
      const txs = await getAllTransactionsForExport()
      exportTransactionsToExcel(txs, 'finanzas_completo')
      toast.success('Exportación lista')
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-ink-900">Configuración</h1>

      {/* Perfil */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <h2 className="text-sm font-medium text-ink-700 mb-3">Cuenta</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-pos font-medium text-sm">
            {profile?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">{profile?.full_name || 'Usuario'}</p>
            <p className="text-xs text-ink-500">{profile?.email}</p>
          </div>
        </div>
      </div>

      {/* Exportación */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <h2 className="text-sm font-medium text-ink-700 mb-3">Exportar datos</h2>
        <div className="space-y-2">
          <button onClick={handleExportAll}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors group">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-ink-500" />
              <span className="text-sm text-ink-700">Exportar todo a Excel</span>
            </div>
            <ChevronRight size={14} className="text-ink-500 group-hover:text-ink-500" />
          </button>
        </div>
      </div>

      {/* Importación */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <h2 className="text-sm font-medium text-ink-700 mb-3">Importar movimientos</h2>

        {importStep === 'idle' && (
          <div>
            <p className="text-xs text-ink-500 mb-3">
              Importá movimientos desde un archivo Excel (.xlsx) o CSV (.csv).
              Podrás mapear las columnas antes de confirmar.
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-line-strong hover:border-brand text-sm text-ink-500 hover:text-pos transition-colors w-full justify-center">
              <Upload size={16} />
              Seleccionar archivo
            </button>
          </div>
        )}

        {importStep === 'mapping' && (
          <div>
            <p className="text-sm font-medium text-ink-700 mb-3">
              Mapeo de columnas ({importRows.length} filas detectadas)
            </p>
            <div className="space-y-2 mb-4">
              {mapping.map((m, i) => (
                <div key={m.fileColumn} className="flex items-center gap-2">
                  <span className="text-xs text-ink-500 w-32 truncate">{m.fileColumn}</span>
                  <span className="text-ink-500">→</span>
                  <select value={m.appField || ''}
                    onChange={e => {
                      const newMap = [...mapping]
                      newMap[i] = { ...newMap[i], appField: e.target.value || null }
                      setMapping(newMap)
                    }}
                    className="flex-1 border border-line rounded-lg px-2 py-1.5 text-xs bg-surface">
                    <option value="">Ignorar columna</option>
                    {APP_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImportStep('idle')}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-500 hover:bg-surface-2 transition-colors">
                Cancelar
              </button>
              <button onClick={applyMapping}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm hover:bg-brand-hover transition-colors">
                Previsualizar
              </button>
            </div>
          </div>
        )}

        {importStep === 'preview' && (
          <div>
            <p className="text-sm font-medium text-ink-700 mb-3">
              Vista previa — {mappedRows.length} movimientos listos para importar
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {mappedRows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-line">
                  <span className="text-ink-500 w-20">{r.date}</span>
                  <span className="flex-1 text-ink-700 truncate">{r.description}</span>
                  <span className={r.type === 'income' ? 'text-pos' : 'text-neg'}>
                    {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount, 'ARS', true)}
                  </span>
                </div>
              ))}
              {mappedRows.length > 20 && (
                <p className="text-xs text-ink-500 text-center py-1">
                  ...y {mappedRows.length - 20} más
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImportStep('mapping')}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-500 hover:bg-surface-2">
                Volver
              </button>
              <button onClick={confirmImport} disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {importing ? 'Importando...' : `Importar ${mappedRows.length} movimientos`}
              </button>
            </div>
          </div>
        )}

        {importStep === 'done' && (
          <div className="text-center py-4">
            <p className="text-sm text-pos font-medium mb-2">¡Importación completada!</p>
            <button onClick={() => setImportStep('idle')}
              className="text-sm text-ink-500 hover:text-ink-700 underline">
              Importar otro archivo
            </button>
          </div>
        )}
      </div>

      {/* Datos de la app */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <h2 className="text-sm font-medium text-ink-700 mb-3">Resumen de datos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="bg-surface-2 rounded-xl p-3">
            <p className="text-lg font-semibold text-ink-900">{accounts.length}</p>
            <p className="text-xs text-ink-500">Cuentas</p>
          </div>
          <div className="bg-surface-2 rounded-xl p-3">
            <p className="text-lg font-semibold text-ink-900">
              {categories.filter(c => !c.parent_id).length}
            </p>
            <p className="text-xs text-ink-500">Categorías</p>
          </div>
          <div className="bg-surface-2 rounded-xl p-3">
            <p className="text-lg font-semibold text-ink-900">
              {categories.filter(c => c.parent_id).length}
            </p>
            <p className="text-xs text-ink-500">Subcategorías</p>
          </div>
        </div>
      </div>

      {/* Versión y logout */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full text-sm text-neg hover:text-neg py-1">
          <LogOut size={16} />
          Cerrar sesión
        </button>
        <p className="text-xs text-ink-500 mt-3">Finanzas Personales v1.0.0</p>
      </div>
    </div>
  )
}
