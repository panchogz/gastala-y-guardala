select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tarjetas', 'tarjeta_cuotas', 'tarjeta_dolares', 'tarjeta_config', 'total_mensual',
    'cotizaciones', 'activos_cripto', 'activos_bolsa', 'activos_usdt',
    'evolucion_mensual', 'ahorros_config'
  )
order by tablename, policyname;
