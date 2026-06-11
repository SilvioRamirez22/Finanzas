# Finanzas Personales — Guía de Despliegue

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Hosting:** Vercel (gratis)
- **PWA:** Service Worker + Web App Manifest

---

## Paso 1 — Crear proyecto en Supabase

1. Ir a https://supabase.com → **New Project**
2. Elegir nombre, contraseña y región (preferentemente `South America - São Paulo`)
3. Esperar que inicie (~2 minutos)
4. Ir a **Settings → API** y copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Paso 2 — Ejecutar el schema SQL

En Supabase → **SQL Editor**, ejecutar en orden:

```
1. sql/01_schema.sql       ← Tablas, RLS, triggers
2. sql/02_seed.sql         ← Función seed_user_defaults
3. sql/03_views_functions.sql ← Vistas y funciones de consulta
```

Verificar que no haya errores en ninguno.

---

## Paso 3 — Configurar autenticación

En Supabase → **Authentication → Settings**:

1. Activar **Email (Magic Link)**
2. En **URL Configuration**:
   - Site URL: `https://TU-APP.vercel.app`
   - Redirect URLs: `https://TU-APP.vercel.app/auth/callback`

---

## Paso 4 — Desplegar en Vercel

### Opción A: desde GitHub (recomendado)

1. Subir el proyecto a un repositorio GitHub
2. Ir a https://vercel.com → **New Project**
3. Importar el repositorio
4. En **Environment Variables** agregar:
   ```
   NEXT_PUBLIC_SUPABASE_URL     = tu-url-de-supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY = tu-anon-key
   ```
5. Click en **Deploy**

### Opción B: desde CLI

```bash
npm install -g vercel
cd finanzas-personales
cp .env.example .env.local
# Editar .env.local con tus valores
vercel --prod
```

---

## Paso 5 — Instalar como PWA

### En Android (Chrome)
1. Abrir la app en Chrome
2. Tocar el menú (⋮) → **Agregar a pantalla de inicio**

### En iPhone (Safari)
1. Abrir la app en Safari
2. Tocar el botón compartir → **Agregar a pantalla de inicio**

---

## Estructura de carpetas

```
src/
├── app/
│   ├── (app)/              ← Rutas protegidas (requieren auth)
│   ├── auth/
│   │   ├── login/          ← Página de login
│   │   └── callback/       ← Manejo del magic link
│   ├── dashboard/          ← Dashboard principal
│   ├── movimientos/        ← Lista y filtros de transacciones
│   ├── categorias/         ← CRUD de categorías
│   ├── cuentas/            ← CRUD de cuentas
│   ├── presupuestos/       ← Presupuestos con progress bars
│   ├── inversiones/        ← Módulo de inversiones
│   ├── historico/          ← Análisis histórico y comparativas
│   ├── buscar/             ← Búsqueda avanzada
│   └── configuracion/      ← Exportar, importar, logout
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx   ← Sidebar + navegación mobile
│   │   └── AppProvider.tsx ← Proveedor de datos globales
│   └── forms/
│       └── QuickAddModal.tsx ← Modal de carga rápida (≤10 segundos)
├── lib/
│   ├── api.ts              ← Todas las queries a Supabase
│   ├── format.ts           ← Formateo de moneda, fechas, etc.
│   ├── exportImport.ts     ← Excel/CSV export e import
│   └── supabase/
│       ├── client.ts       ← Cliente para componentes
│       └── server.ts       ← Cliente para Server Components
├── store/
│   └── useAppStore.ts      ← Estado global con Zustand
└── types/
    └── index.ts            ← Todos los tipos TypeScript
sql/
├── 01_schema.sql           ← Schema completo con RLS y triggers
├── 02_seed.sql             ← Categorías y datos iniciales
└── 03_views_functions.sql  ← Vistas y funciones SQL
```

---

## Funcionalidades implementadas

| Funcionalidad | Estado |
|---|---|
| Dashboard con KPIs y gráficos | ✅ |
| Registro rápido de movimientos | ✅ |
| Ingresos / Gastos / Transferencias | ✅ |
| Cuotas automáticas (2–120 cuotas) | ✅ |
| Categorías y subcategorías personalizables | ✅ |
| Múltiples cuentas con saldo propio | ✅ |
| Presupuestos con alertas de color | ✅ |
| Módulo de inversiones (acciones, CEDEARs, crypto) | ✅ |
| Histórico con comparativas mes/año | ✅ |
| Búsqueda avanzada multi-filtro | ✅ |
| Exportación a Excel y CSV | ✅ |
| Importación desde Excel/CSV con mapeo | ✅ |
| PWA instalable (Android + iPhone) | ✅ |
| Offline básico con Service Worker | ✅ |
| Autenticación magic link | ✅ |
| Sincronización en tiempo real (Supabase Realtime) | ✅ |
| Row Level Security (datos privados por usuario) | ✅ |
| Balance automático por cuenta | ✅ (trigger SQL) |
| Responsive mobile-first | ✅ |

---

## Mejoras futuras sugeridas

1. **Carga rápida por voz** — Web Speech API para dictar gastos
2. **Escaneo de tickets** — OCR con la cámara del celular
3. **Notificaciones push** — Alertas de presupuesto excedido
4. **Exportación a PDF** — Resumen mensual tipo estado de cuenta
5. **Modo oscuro** — Toggle dark/light con Tailwind
6. **Gastos recurrentes automáticos** — Generar automáticamente cada período
7. **Múltiples monedas con tipo de cambio** — API de BCRA para USD/ARS
8. **Widget iOS/Android** — Carga rápida sin abrir la app
9. **Compartir con pareja** — Multi-usuario por hogar
10. **Análisis con IA** — Sugerencias de ahorro basadas en historial

---

## Costos estimados

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | Hobby | $0/mes |
| Supabase | Free (500MB, 2 proyectos) | $0/mes |
| **Total** | | **$0/mes** |

El plan gratuito de Supabase es más que suficiente para uso personal (500MB incluyen cientos de miles de transacciones).
