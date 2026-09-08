import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import RootShell from '@/components/layout/RootShell'
import SWCleanup from '@/components/layout/SWCleanup'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finanzas Personales',
  description: 'Tu app de finanzas personales',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finanzas',
  },
}

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  // maximumScale: 1 impedia hacer zoom con los dedos: mala accesibilidad y,
  // en iOS, no evitaba nada porque el zoom al tocar un input se arregla con
  // font-size 16px (ver globals.css), no bloqueando el gesto.
  maximumScale: 5,
  userScalable: true,
  // Deja que el contenido llegue debajo del notch; los paddings safe-area
  // de globals.css se encargan del resto.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SWCleanup />
        <RootShell>{children}</RootShell>
        <Toaster
          position="bottom-center"
          containerStyle={{
            // Arriba de la barra de navegacion inferior del celular.
            bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
          }}
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#1f2937',
              color: '#fff',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
