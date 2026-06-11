'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      setSent(true)
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar el email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Finanzas Personales</h1>
          <p className="text-sm text-gray-500 mt-1">Tu planilla de finanzas 2.0</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📬</span>
            </div>
            <h2 className="font-medium text-gray-900 mb-1">Revisá tu email</h2>
            <p className="text-sm text-gray-500">
              Te enviamos un link mágico a <strong>{email}</strong>.
              Tocá el enlace para ingresar.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-emerald-600 hover:underline"
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-gray-700 mb-1.5 block font-medium">
                Tu email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="hola@ejemplo.com"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Ingresar con email'}
            </button>
            <p className="text-xs text-center text-gray-400">
              Te enviamos un link mágico. Sin contraseñas.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
