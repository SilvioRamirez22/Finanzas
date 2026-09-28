// lib/useCartera.ts — resumen de Mi Cartera para las pantallas (Cuentas, Inversiones).
'use client'
import { useCallback, useEffect, useState } from 'react'
import { fetchCarteraSummary, getCarteraLink, type CarteraLink, type CarteraSummary } from './cartera'

export function useCartera() {
  const [link, setLink] = useState<CarteraLink | null>(null)
  const [summary, setSummary] = useState<CarteraSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const l = await getCarteraLink()
      setLink(l)
      setSummary(l ? await fetchCarteraSummary(l) : null)
    } catch (e: any) {
      setError(e?.message || 'No se pudo leer Mi Cartera')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { link, summary, loading, error, reload: load }
}
