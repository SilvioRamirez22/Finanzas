'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'

// Carga los datos de una pantalla que dependen del mes elegido y los mantiene
// al dia:
//
// - Al cambiar de mes, `data` vuelve a null hasta que llegan los del mes nuevo.
//   Antes se seguian viendo los numeros del mes anterior como si fueran los
//   nuevos; ahora la pantalla muestra el esqueleto.
// - Cuando se guarda, edita o borra un movimiento (dataVersion), recarga en
//   segundo plano: los numeros viejos quedan en pantalla hasta que llegan los
//   nuevos, sin parpadeo.
// - Si el mes cambia rapido, una respuesta vieja que llega tarde se descarta.
// - Si falla, `error` lo dice. Si ya habia datos del mes, se conservan.
export function useMonthData<T>(fetcher: (year: number, month: number) => Promise<T>) {
  const year = useAppStore(s => s.selectedMonth.year)
  const month = useAppStore(s => s.selectedMonth.month)
  const dataVersion = useAppStore(s => s.dataVersion)
  const key = `${year}-${month}`

  const [state, setState] = useState<{ key: string; data: T | null; error: Error | null }>(
    { key: '', data: null, error: null }
  )
  const reqId = useRef(0)
  // El fetcher suele ser una funcion nueva en cada render: la leemos de un ref
  // para no recargar en cada render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(async () => {
    const id = ++reqId.current
    setState(s => (s.key === key ? { ...s, error: null } : { key, data: null, error: null }))
    try {
      const data = await fetcherRef.current(year, month)
      if (id === reqId.current) setState({ key, data, error: null })
    } catch (e) {
      console.error('Error cargando datos del mes:', e)
      if (id === reqId.current) {
        const error = e instanceof Error ? e : new Error('No se pudieron cargar los datos')
        setState(s => ({ ...s, key, error }))
      }
    }
  }, [year, month, key])

  useEffect(() => { reload() }, [reload, dataVersion])

  const current = state.key === key
  // Cambios locales (por ejemplo, marcar un gasto como fijo) sin recargar.
  const setData = useCallback((update: (prev: T) => T) => {
    setState(s => (s.data === null ? s : { ...s, data: update(s.data) }))
  }, [])

  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    reload,
    setData,
  }
}
