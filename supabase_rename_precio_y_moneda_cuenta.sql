-- Ahorros: mueve la selección de moneda de "por activo" a "por cuenta".
-- 1. Saca el sufijo de moneda de las columnas de precio en activos_bolsa/activos_cripto
--    (ya no tiene sentido: la moneda ahora la define la cuenta, no la categoría).
-- 2. Agrega cuentas_ahorro.moneda ('ARS'|'USD'), backfillea según el tipo actual de cada
--    cuenta (bolsa -> ARS, cripto/usdt -> USD, mismo default que ya usaba la app) y la
--    deja NOT NULL.

alter table activos_bolsa rename column precio_compra_ars to precio_compra;
alter table activos_bolsa rename column precio_actual_ars to precio_actual;
alter table activos_cripto rename column precio_compra_usd to precio_compra;
alter table activos_cripto rename column precio_actual_usd to precio_actual;

alter table cuentas_ahorro add column if not exists moneda text check (moneda in ('ARS','USD'));
update cuentas_ahorro set moneda = case when tipo = 'bolsa' then 'ARS' else 'USD' end where moneda is null;
alter table cuentas_ahorro alter column moneda set default 'ARS';
alter table cuentas_ahorro alter column moneda set not null;
