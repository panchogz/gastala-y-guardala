select
  tc.table_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
  and tc.table_name in (
    'tarjetas', 'tarjeta_cuotas', 'tarjeta_dolares', 'tarjeta_config', 'total_mensual',
    'cotizaciones', 'activos_cripto', 'activos_bolsa', 'activos_usdt',
    'evolucion_mensual', 'ahorros_config'
  )
group by tc.table_name, tc.constraint_type, tc.constraint_name
order by tc.table_name, tc.constraint_type;
