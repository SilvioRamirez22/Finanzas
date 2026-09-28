// lib/cartera.ts — conexión con Mi Cartera (la app de inversiones).
// Mi Cartera genera un código de solo lectura (Ajustes → Conectar con Finanzas) con la forma
// "https://<mi-cartera>#mc_…". Acá se guarda en Supabase (tabla cartera_link, migración 002)
// y se usa para pedir el resumen: patrimonio, invertido, liquidez y variación del día.
import { createClient } from './supabase/client'

export interface CarteraLink {
  base_url: string
  token: string
}

export interface CarteraSummary {
  at: string
  date: string
  totalArs: number
  totalUsd: number | null
  investedArs: number
  liquidityArs: number
  dayChangeArs: number | null
  dayChangePct: number | null
  unrealizedArs: number
  mep: number | null
  positions: number
}

/** Separa "https://host#mc_xxx" en dirección y código. Null si no tiene esa forma. */
export function parseCarteraCode(code: string): CarteraLink | null {
  const m = code.trim().match(/^(https?:\/\/[^\s#/]+)\/?#(mc_[A-Za-z0-9_-]{20,})$/)
  return m ? { base_url: m[1], token: m[2] } : null
}

/** El vínculo guardado; null si no hay o si falta correr la migración 002. */
export async function getCarteraLink(): Promise<CarteraLink | null> {
  const { data, error } = await createClient().from('cartera_link').select('base_url, token').maybeSingle()
  if (error) return null
  return data as CarteraLink | null
}

export async function saveCarteraLink(link: CarteraLink) {
  const { error } = await createClient()
    .from('cartera_link')
    .upsert({ ...link, updated_at: new Date().toISOString() })
  if (error) {
    throw new Error(/cartera_link/.test(error.message)
      ? 'Falta correr la migración 002 en Supabase (sql/migrations/002_conexion_cartera.sql)'
      : error.message)
  }
}

export async function deleteCarteraLink() {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return
  const { error } = await createClient().from('cartera_link').delete().eq('user_id', user.id)
  if (error) throw error
}

/** Resumen en vivo de la cartera. Tira con un mensaje legible si el código no sirve. */
export async function fetchCarteraSummary(link: CarteraLink): Promise<CarteraSummary> {
  const res = await fetch(`${link.base_url}/api/finanzas`, {
    headers: { Authorization: `Bearer ${link.token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || `Mi Cartera respondió ${res.status}`)
  return body as CarteraSummary
}
