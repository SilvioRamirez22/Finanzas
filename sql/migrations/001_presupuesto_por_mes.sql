-- 001 · Presupuesto por mes (docs/ux/05-PRESUPUESTO.md §3)
--
-- Se corre UNA vez en Supabase: SQL Editor → pegar todo → Run.
-- Es seguro correrlo de nuevo: no borra nada y no toca las funciones que ya
-- andan en producción (ver D2 en docs/ux/01-AUDITORIA.md).
--
-- Qué agrega:
--   1. month_plans: ingreso esperado y ahorro objetivo de cada mes.
--   2. budgets.rollover: preparado para el "modo sobre" (todavía no se usa).
--   3. Índice para buscar el presupuesto vigente de un mes.
--
-- Los montos por categoría NO necesitan tabla nueva: van en budgets, usando
-- start_date / end_date como intervalo (una fila = "desde este mes, X").

create table if not exists public.month_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  expected_income numeric(14,2),
  savings_target numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

alter table public.month_plans enable row level security;

drop policy if exists "user_own_month_plans" on public.month_plans;
create policy "user_own_month_plans" on public.month_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.budgets add column if not exists rollover boolean not null default false;

create index if not exists budgets_user_category_start_idx
  on public.budgets (user_id, category_id, start_date);

-- Que PostgREST vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';
