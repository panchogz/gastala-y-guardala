-- Habilita RLS y agrega políticas "permitir todo" para la anon key.
-- Es seguro en este contexto: app de un solo usuario, la URL de Supabase
-- (con la anon key) no se comparte públicamente.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'cotizaciones',
      'tarjeta_cuotas',
      'tarjeta_dolares',
      'tarjeta_config',
      'total_mensual',
      'activos_cripto',
      'activos_bolsa',
      'activos_usdt',
      'evolucion_mensual'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy "allow all for anon" on %I for all using (true) with check (true);',
      t
    );
  end loop;
end $$;
