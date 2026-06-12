'use client'
import { usePathname } from 'next/navigation'
import AppProvider from '@/components/layout/AppProvider'

// Decide si mostrar el menú (AppProvider) o no.
// En las rutas de /auth (login) NO mostramos el menú.
export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith('/auth')

  if (isAuthRoute) {
    // Login y otras pantallas de auth: sin menú
    return <>{children}</>
  }

  // Todas las demás rutas: con menú lateral y carga de datos
  return <AppProvider>{children}</AppProvider>
}
