-- Revierte fecha_compra/moneda_compra en activos_bolsa/activos_cripto: se agregaron sin
-- conectar la lógica de cálculo (a la espera del análisis de cotización histórica en
-- curso) y quedaron como columnas sin beneficio funcional. IF EXISTS cubre el caso de
-- que supabase_add_fecha_moneda_compra.sql nunca se haya llegado a correr.

alter table activos_bolsa drop column if exists fecha_compra;
alter table activos_bolsa drop column if exists moneda_compra;
alter table activos_cripto drop column if exists fecha_compra;
alter table activos_cripto drop column if exists moneda_compra;
