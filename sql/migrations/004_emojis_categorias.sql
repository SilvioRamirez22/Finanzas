-- 004 · Emoji para cada categoría (2026-09-27)
--
-- Se corre UNA vez en Supabase, DESPUÉS de la 003: SQL Editor → pegar todo → Run.
-- Es seguro correrlo de nuevo: solo cambia las categorías que todavía tienen un
-- ícono viejo (un nombre como "shopping-cart"); una que ya tiene emoji, elegido
-- acá o a mano desde Categorías, no se toca.
--
-- La app muestra el emoji al cargar un gasto, en Movimientos y en Categorías.
-- Una categoría que no está en la lista sigue con su ícono de siempre hasta que
-- se le elija un emoji desde Categorías.

with emojis (nombre, emoji) as (values
  -- madres de gastos
  ('alimentación', '🛒'), ('transporte', '🚌'), ('servicios', '💡'), ('compras', '🛍️'),
  ('salud', '🩺'), ('salidas', '🍻'), ('sofi', '❤️'), ('gatas', '🐱'),
  ('universidad', '🎓'), ('extraordinario', '✨'),
  -- subcategorías
  ('comida', '🍝'), ('pedidos ya', '🛵'), ('comida trabajo', '🥪'),
  ('supermercado', '🧺'), ('restaurante', '🍽️'), ('delivery', '🛵'),
  ('luz', '⚡'), ('gas', '🔥'), ('internet', '🌐'), ('celular', '📱'),
  ('expensas', '🏢'), ('suscripciones', '🔁'), ('streaming', '📺'),
  ('compras bienes', '📦'), ('ropa', '👕'), ('ropa y calzado', '👕'),
  ('gym', '🏋️'), ('farmacia', '💊'), ('fitness', '🏋️'), ('gym y deporte', '🏋️'),
  ('combustible', '⛽'), ('transporte público', '🚇'), ('taxi / uber', '🚕'),
  -- las que trae el alta y quizás sigan activas
  ('vivienda', '🏠'), ('alquiler', '🏠'), ('educación', '📚'),
  ('ocio y entretenimiento', '🎮'), ('otros gastos', '📌'),
  -- ingresos
  ('sueldo', '💼'), ('freelance', '💻'), ('inversiones', '📈'), ('otros ingresos', '💵')
)
update categories c
set icon = e.emoji
from emojis e
where lower(trim(c.name)) = e.nombre
  and c.icon ~ '^[a-z0-9-]+$';


-- Cómo quedó (solo lectura): las categorías activas con su emoji.
select coalesce(p.name || ' › ', '') || c.name as categoria, c.icon as emoji
from categories c
left join categories p on p.id = c.parent_id
where c.is_active
order by c.type, coalesce(p.name, c.name), c.parent_id is not null, c.name;
