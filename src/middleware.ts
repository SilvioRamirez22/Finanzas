import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Middleware mínimo: solo refresca la cookie de sesión de Supabase,
// pero NO redirige. La protección de rutas la maneja el cliente
// (AppProvider), que sí puede leer la sesión del navegador.
// Esto evita el rebote login -> dashboard -> login.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Nada de tocar el token en las pantallas de auth.
  //    El login no necesita refrescar la sesión y hacerlo ahí era otra
  //    fuente de rebotes: el middleware rotaba el token justo mientras el
  //    cliente estaba guardando el que acababa de recibir.
  if (pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // 2. Los prefetch de Next (<Link>) disparan una request por cada link del
  //    header. Si el access token está vencido, todas intentan refrescarlo a
  //    la vez con el mismo refresh token; Supabase lo rota, la primera gana y
  //    las demás reciben "Already Used", lo que invalida la sesión. En el
  //    celular, con red lenta y la app volviendo de segundo plano, pasaba
  //    seguido y terminaba en el loop de login. Un prefetch no necesita
  //    sesión fresca: lo dejamos pasar sin tocar el token.
  if (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('x-middleware-prefetch') === '1'
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // Solo refresca la sesión, sin redirigir a nadie.
  // Si falla (token rotado, red caída), no rompemos la navegación.
  try {
    await supabase.auth.getUser()
  } catch {}

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|apple-touch-icon\\.png|manifest\\.json|sw.js).*)'],
}
