'use client'
import { useEffect } from 'react'

// Red de seguridad para el service worker fantasma.
//
// Una version vieja de la app registro /sw.js en produccion. Sacar el codigo
// de registro no lo desinstala: el service worker sigue instalado en cada
// telefono que abrio la app, cacheando el HTML de /dashboard y /auth/login.
// Eso es lo que hacia rebotar el login en loop desde el celular.
//
// public/sw.js ya es un kill switch que se desregistra solo, pero eso depende
// de que el navegador se moleste en buscar una version nueva del archivo.
// Esto lo fuerza desde la pagina: si quedo algun service worker registrado,
// lo saca y borra sus caches.
//
// Se puede borrar este componente dentro de unas semanas, cuando ya no queden
// dispositivos con el service worker viejo.
export default function SWCleanup() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations()
      .then(async regs => {
        if (regs.length === 0) return
        await Promise.all(regs.map(r => r.unregister().catch(() => false)))
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      })
      .catch(() => {})
  }, [])

  return null
}
