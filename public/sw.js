// public/sw.js — INTERRUPTOR DE APAGADO (kill switch)
//
// Una version anterior de la app registraba este service worker y cacheaba
// TODO, incluido el HTML de /dashboard y /auth/login. El registro se saco del
// codigo despues, pero eso NO desinstala un service worker ya instalado: sigue
// vivo en el telefono para siempre, interceptando cada navegacion y sirviendo
// un HTML viejo que apunta a chunks de JS que ya no existen en el servidor.
// Resultado: el celular entraba al dashboard, no podia leer la sesion y
// rebotaba al login en loop.
//
// Este archivo ya no cachea nada. Lo unico que hace es borrar todo lo que
// habia guardado, desregistrarse y recargar las pestanias abiertas. Se sirve
// con Cache-Control: no-store (ver next.config.js), asi que el service worker
// viejo lo descarga solo en la siguiente visita y se suicida.
//
// NO volver a agregar un fetch handler que cachee HTML: si se quiere offline,
// cachear unicamente assets estaticos (/_next/static/...) y nunca navegaciones
// ni nada de /auth.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Borrar todos los caches que dejo la version anterior.
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))

      // 2. Desregistrarse.
      await self.registration.unregister()

      // 3. Recargar las pestanias abiertas para que salgan del control del SW.
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        try { client.navigate(client.url) } catch {}
      }
    })()
  )
})

// Sin fetch handler: todas las requests van directo a la red.
