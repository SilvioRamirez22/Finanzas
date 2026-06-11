// public/sw.js — Service Worker para PWA offline
const CACHE_NAME = 'finanzas-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') return

  // No cachear llamadas a Supabase/API
  const url = new URL(event.request.url)
  if (url.hostname.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia en cache
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline: servir desde cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Fallback para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard')
          }
          return new Response('Sin conexión', { status: 503 })
        })
      })
  )
})
