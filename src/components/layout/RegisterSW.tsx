'use client'
import { useEffect } from 'react'

// Registra el service worker. Sin esto sw.js se sirve pero nunca corre:
// no hay offline ni instalación de la PWA.
export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(err => console.error('No se pudo registrar el service worker:', err))
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
