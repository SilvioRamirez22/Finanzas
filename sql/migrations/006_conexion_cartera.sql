-- 006 · Conexión con Mi Cartera (github.com/SilvioRamirez22/Cartera)
--
-- Se corre UNA vez en Supabase: SQL Editor → pegar todo → Run. Es seguro correrlo de nuevo.
--
-- Guarda la dirección de Mi Cartera y el código de solo lectura que se genera allá
-- (Ajustes → Conectar con Finanzas). Con eso Finanzas suma el valor de la cartera de
-- inversiones al patrimonio (Cuentas) y lo muestra en Inversiones.

create table if not exists public.cartera_link (
  user_id    uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  base_url   text not null,
  token      text not null,
  updated_at timestamptz not null default now()
);

alter table public.cartera_link enable row level security;

drop policy if exists "user_own_cartera_link" on public.cartera_link;
create policy "user_own_cartera_link" on public.cartera_link
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on public.cartera_link to authenticated;
