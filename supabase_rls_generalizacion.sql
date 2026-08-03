-- RLS + grants para las tablas nuevas de la generalización (tarjetas, ahorros_config).
-- Mismo criterio que el resto de la app: acceso completo para anon/authenticated.

do $$
declare
  t text;
begin
  for t in select unnest(array['tarjetas', 'ahorros_config'])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy "allow all for anon" on %I for all using (true) with check (true);',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on tarjetas, ahorros_config to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
