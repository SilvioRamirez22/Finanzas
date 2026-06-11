// lib/format.ts
import { format, parseISO, isToday, isYesterday, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from '@/types'

// ---- Moneda ----
export function formatCurrency(amount: number, currency = 'ARS', compact = false): string {
  if (compact && Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(amount)
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-AR').format(n)
}

// ---- Fechas ----
export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return format(date, 'dd MMM yyyy', { locale: es })
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM', { locale: es })
}

export function formatMonthYear(dateStr: string): string {
  return format(parseISO(dateStr), 'MMMM yyyy', { locale: es })
}

export function formatMonth(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM', { locale: es })
}

// ---- Rango de fechas ----
export function getDateRangeFromOption(range: DateRange): { from: Date; to: Date } {
  const now = new Date()
  const to = endOfMonth(now)
  switch (range) {
    case '1m': return { from: startOfMonth(now), to }
    case '3m': return { from: startOfMonth(subMonths(now, 2)), to }
    case '6m': return { from: startOfMonth(subMonths(now, 5)), to }
    case '12m': return { from: startOfMonth(subMonths(now, 11)), to }
    case 'ytd': return { from: new Date(now.getFullYear(), 0, 1), to }
    case 'all': return { from: new Date(2020, 0, 1), to }
  }
}

// ---- Porcentaje ----
export function formatPct(value: number, decimals = 1): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// ---- Variación ----
export function calcVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

// ---- Tipo de transacción ----
export const typeLabels: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
}

export const typeColors: Record<string, string> = {
  income: 'text-green-600',
  expense: 'text-red-500',
  transfer: 'text-blue-500',
}

// ---- Capitalize ----
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ---- Pluralize ----
export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

// ---- Hoy como string ISO ----
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
