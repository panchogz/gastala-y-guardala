select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tarjetas', 'tarjeta_cuotas', 'tarjeta_dolares', 'tarjeta_config', 'total_mensual',
    'cotizaciones', 'activos_cripto', 'activos_bolsa', 'activos_usdt',
    'evolucion_mensual', 'ahorros_config'
  )
order by table_name, ordinal_position;
