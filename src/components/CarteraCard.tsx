'use client'
import Link from 'next/link'
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { CarteraLink, CarteraSummary } from '@/lib/cartera'

// Valor de la cartera de inversiones (Mi Cartera, en vivo). Sin conexión, explica cómo conectarla.
export default function CarteraCard({ link, summary, loading, error, onReload }: {
  link: CarteraLink | null
  summary: CarteraSummary | null
  loading: boolean
  error: string | null
  onReload: () => void
}) {
  if (loading && !summary) {
    return <div className="bg-surface rounded-2xl border border-line p-4 h-[108px] animate-pulse" />
  }
  if (!link) {
    return (
      <div className="bg-surface rounded-2xl border border-line p-4">
        <p className="text-sm font-medium text-ink-900">Cartera de inversiones</p>
        <p className="text-xs text-ink-500 mt-1">
          Conectá Mi Cartera para ver acá lo que tenés invertido en VETA y sumarlo al patrimonio.
        </p>
        <Link href="/configuracion" className="inline-block mt-2 text-sm font-medium text-brand-ink underline underline-offset-2">
          Conectar en Configuración
        </Link>
      </div>
    )
  }
  const up = (summary?.dayChangeArs ?? 0) >= 0
  return (
    <div className="bg-surface rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-ink-500">Cartera de inversiones · Mi Cartera</p>
        <div className="flex items-center gap-2">
          <button onClick={onReload} disabled={loading} aria-label="Actualizar" className="text-ink-500 hover:text-ink-700">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href={link.base_url} target="_blank" rel="noreferrer" aria-label="Abrir Mi Cartera" className="text-ink-500 hover:text-ink-700">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-neg mt-1">{error}</p>
      ) : summary && (
        <>
          <p className="text-xl font-semibold text-ink-900 mt-1">{formatCurrency(summary.totalArs, 'ARS', true)}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1">
            {summary.totalUsd != null && <span className="text-ink-500">{formatCurrency(summary.totalUsd, 'USD')}</span>}
            {summary.dayChangeArs != null && (
              <span className={`flex items-center gap-1 ${up ? 'text-pos' : 'text-neg'}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {up ? '+' : '−'}{formatCurrency(Math.abs(summary.dayChangeArs), 'ARS', true)}
                {summary.dayChangePct != null && ` (${up ? '+' : '−'}${Math.abs(summary.dayChangePct).toLocaleString('es-AR')}%)`} hoy
              </span>
            )}
            <span className="text-ink-500">
              invertido {formatCurrency(summary.investedArs, 'ARS', true)} · liquidez {formatCurrency(summary.liquidityArs, 'ARS', true)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
