'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link2, Unlink } from 'lucide-react'
import { deleteCarteraLink, fetchCarteraSummary, getCarteraLink, parseCarteraCode, saveCarteraLink, type CarteraLink } from '@/lib/cartera'
import { formatCurrency } from '@/lib/format'

// Configuración → Mi Cartera: pegar el código que genera Mi Cartera (Ajustes → Conectar con
// Finanzas). Antes de guardarlo se prueba: si no anda, no se guarda.
export default function CarteraConnect() {
  const [link, setLink] = useState<CarteraLink | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getCarteraLink().then(setLink) }, [])

  async function connect() {
    const parsed = parseCarteraCode(code)
    if (!parsed) {
      toast.error('El código tiene que ser como https://…#mc_… (copialo entero de Mi Cartera)')
      return
    }
    setBusy(true)
    try {
      const s = await fetchCarteraSummary(parsed)
      await saveCarteraLink(parsed)
      setLink(parsed)
      setCode('')
      toast.success(`Conectado: tu cartera vale ${formatCurrency(s.totalArs, 'ARS', true)}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Mi Cartera? Para cortar el acceso del todo, revocá el código en Mi Cartera.')) return
    try {
      await deleteCarteraLink()
      setLink(null)
      toast.success('Desconectado')
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="bg-surface rounded-2xl border border-line p-4">
      <h2 className="text-sm font-medium text-ink-700 mb-1">Mi Cartera (inversiones)</h2>
      {link ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-500">
            Conectada a <span className="text-ink-700">{link.base_url.replace(/^https?:\/\//, '')}</span>. El valor de la cartera
            aparece en Inversiones y suma al patrimonio en Cuentas.
          </p>
          <button onClick={disconnect} className="flex items-center gap-1 text-xs text-neg hover:underline shrink-0">
            <Unlink size={13} /> Desconectar
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-500 mb-3">
            En Mi Cartera andá a Ajustes → <b>Conectar con Finanzas</b>, generá el código y pegalo acá.
          </p>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="https://…#mc_…"
              className="flex-1 min-w-0 border border-line rounded-xl px-3 py-2 text-sm bg-surface" />
            <button onClick={connect} disabled={busy || !code.trim()}
              className="flex items-center gap-1.5 bg-brand text-white px-3 py-2 rounded-xl text-sm hover:bg-brand-hover disabled:opacity-50 transition-colors">
              <Link2 size={14} /> {busy ? 'Probando…' : 'Conectar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
