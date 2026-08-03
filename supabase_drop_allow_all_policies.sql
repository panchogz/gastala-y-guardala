-- Elimina las políticas "allow all for anon" (de antes del multiusuario) que
-- todavía conviven con las nuevas "own_rows" por user_id. Al ser políticas
-- permisivas, Postgres las combina con OR, así que mientras exista "allow all
-- for anon" (qual = true) nadie está realmente aislado por usuario.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'tarjetas', 'tarjeta_cuotas', 'tarjeta_dolares', 'tarjeta_config', 'total_mensual',
      'cotizaciones', 'activos_cripto', 'activos_bolsa', 'activos_usdt',
      'evolucion_mensual', 'ahorros_config'
    ])
  loop
    execute format('drop policy if exists "allow all for anon" on %I;', t);
  end loop;
end $$;
