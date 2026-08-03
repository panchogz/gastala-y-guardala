-- Agrega la cotización de USDT (distinta de CCL/MEP) a la fila única de cotizaciones.
alter table cotizaciones add column if not exists dolar_usdt numeric not null default 1200;
