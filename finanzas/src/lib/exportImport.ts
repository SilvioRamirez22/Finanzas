// lib/exportImport.ts
import * as XLSX from 'xlsx'
import { TransactionFull } from '@/types'
import { formatCurrency } from './format'

// ============================================================
// EXPORTACIÓN
// ============================================================

export function exportTransactionsToExcel(transactions: TransactionFull[], filename = 'finanzas') {
  const rows = transactions.map(t => ({
    Fecha: t.date,
    Descripción: t.description,
    Tipo: t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Transferencia',
    Monto: t.type === 'expense' ? -t.amount : t.amount,
    Categoría: t.category_name || '',
    Subcategoría: t.subcategory_name || '',
    Cuenta: t.account_name,
    'Medio de pago': t.payment_method_name || '',
    Cuotas: t.installments_total > 1 ? `${t.installment_number}/${t.installments_total}` : '',
    Estado: t.status === 'confirmed' ? 'Confirmado' : t.status === 'pending' ? 'Pendiente' : 'Cancelado',
    Notas: t.notes || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 30 },
  ]

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export function exportTransactionsToCSV(transactions: TransactionFull[], filename = 'finanzas') {
  const headers = ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Categoría', 'Subcategoría', 'Cuenta', 'Medio de pago', 'Notas']
  const rows = transactions.map(t => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Transferencia',
    t.type === 'expense' ? -t.amount : t.amount,
    t.category_name || '',
    t.subcategory_name || '',
    t.account_name,
    t.payment_method_name || '',
    `"${(t.notes || '').replace(/"/g, '""')}"`,
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// IMPORTACIÓN
// ============================================================

export interface ImportRow {
  date?: string
  description?: string
  type?: string
  amount?: number | string
  category?: string
  account?: string
  notes?: string
  [key: string]: unknown
}

export interface ImportColumn {
  fileColumn: string
  appField: string | null
}

export async function parseImportFile(file: File): Promise<{ headers: string[]; rows: ImportRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
        const headers = (json[0] as string[]).map(h => String(h))
        const rows = json.slice(1).map(row => {
          const obj: ImportRow = {}
          headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] })
          return obj
        })
        resolve({ headers, rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error leyendo el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

export function mapImportRows(
  rows: ImportRow[],
  mapping: ImportColumn[],
  accounts: { id: string; name: string }[],
  categories: { id: string; name: string }[]
) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.name.toLowerCase(), a.id]))
  const categoryMap = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]))

  return rows
    .map(row => {
      const mapped: Record<string, unknown> = {}
      mapping.forEach(({ fileColumn, appField }) => {
        if (appField) mapped[appField] = row[fileColumn]
      })
      return {
        date: String(mapped.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
        description: String(mapped.description || 'Importado'),
        amount: Math.abs(parseFloat(String(mapped.amount || '0'))),
        type: mapped.type
          ? (String(mapped.type).toLowerCase().includes('ingreso') ? 'income' : 'expense')
          : (parseFloat(String(mapped.amount || '0')) >= 0 ? 'income' : 'expense'),
        account_id: accountMap[String(mapped.account || '').toLowerCase()] || accounts[0]?.id || '',
        category_id: categoryMap[String(mapped.category || '').toLowerCase()] || null,
        notes: String(mapped.notes || '') || null,
        installments_total: 1,
        installment_number: 1,
        status: 'confirmed',
        has_installments: false,
      }
    })
    .filter(r => r.account_id && r.amount > 0)
}
