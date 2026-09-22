# Finanzas Personales

PWA de finanzas personales: Next.js 14 (app router) + Supabase + Tailwind, desplegada en
Vercel desde `main` en GitHub (`SilvioRamirez22/Finanzas`).

## Reglas de trabajo

- **Nada queda solo en una computadora.** La app se usa desde cualquier dispositivo y se
  modifica desde cualquier computadora. Todo cambio se commitea y se sube a GitHub al
  terminar; no dejar commits sin push ni archivos sin commitear.
- **Los datos viven en Supabase**, nunca en el navegador. `localStorage`/`sessionStorage`
  solo para comodidades descartables (hoy: la marca anti-rebote del login).
- Las decisiones y el contexto van en el repo (`docs/`), no en archivos locales ni en la
  memoria de una sesión.
- Las claves van en Vercel, no en el repo (`.env.local` está ignorado).

## Dónde está cada cosa

- `docs/ux/` — auditoría, sistema de diseño, specs y plan por etapas. Empezar por
  `00-RESUMEN.md`; los hallazgos se citan por código (A1, D10, X6…) de `01-AUDITORIA.md`.
- `src/lib/api.ts` — todas las consultas a Supabase.
- `src/store/useAppStore.ts` — estado global. `dataVersion` sube al crear, editar o borrar un
  movimiento (`notifyDataChanged()`); las pantallas se recargan con `useMonthData`.
- `src/lib/useMonthData.ts` — carga por mes con esqueleto, error y recarga en segundo plano.
- Colores y tamaños: tokens en `src/app/globals.css`, mapeados en `tailwind.config.ts`
  (`bg-surface`, `text-ink-500`, `border-line`, `bg-brand`, `text-neg`…). Código nuevo no escribe
  hex ni `gray-*`. El borde es `line` (no `border`, que choca con la utilidad de Tailwind).
- `src/components/ui/` — `Sheet` (diálogo), `States` (esqueleto y error).
- `src/components/forms/QuickAddModal.tsx` — carga y edición de movimientos; aprende de
  `src/lib/quickAddHints.ts` (últimos 90 días en Supabase).
- Seguimiento: `src/app/seguimiento` (carga), `src/components/seguimiento` (gráficos SVG a mano,
  sin librería), `src/lib/seguimiento.ts` (cálculos puros). Colores de gráficos: `--chart-*`,
  `--heat-*`, `--data-*` en `globals.css`.
- Presupuesto: `src/lib/budget.ts` (cálculos puros: tope vigente por mes, escribir "desde" o
  "solo" un mes sin tocar el pasado, resumen del mes). Nunca escribir `budgets` por fuera de
  `planBudgetWrites` + `applyBudgetWrites`.
- SQL: los cambios de base van numerados en `sql/migrations/` y se corren a mano en el SQL Editor
  de Supabase. No correr `sql/INSTALAR_TODO.sql` sobre producción (ver D2).
- Modo oscuro: sigue al sistema con `prefers-color-scheme`; se prueba forzando el esquema oscuro
  en el navegador.

## Verificar

No hay `.env.local` en el repo, así que la app no levanta sin las claves. Para chequear:

```bash
npx tsc --noEmit -p .
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx next build
```

`tsc` hoy marca un error viejo en `src/app/inversiones/page.tsx` (el build lo ignora por
`ignoreBuildErrors`).
