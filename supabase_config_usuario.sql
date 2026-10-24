-- Salario neto único por usuario (reemplaza a tarjeta_config.salario_neto,
-- que la app deja de usar; la columna vieja se elimina más adelante).
-- Correr en el SQL Editor de Supabase ANTES de desplegar la app que lo usa.

create table if not exists config_usuario (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  salario_neto numeric not null default 0
);

alter table config_usuario enable row level security;

create policy "own_rows" on config_usuario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on config_usuario to anon, authenticated;

-- Inicializa con el salario más alto no vacío entre las tarjetas de cada usuario.
insert into config_usuario (user_id, salario_neto)
select user_id, max(salario_neto)
from tarjeta_config
where user_id is not null and salario_neto > 0
group by user_id
on conflict (user_id) do nothing;
