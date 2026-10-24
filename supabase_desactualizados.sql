-- Indicador de datos desactualizados: un timestamp de última actualización por
-- campo cargado a mano. Correr en el SQL Editor de Supabase ANTES de desplegar
-- la app que lo usa. Se puede correr más de una vez.
--
-- default now(): las filas existentes quedan con la fecha de hoy (la historia
-- real es desconocida; así no arranca todo en ámbar). RLS sin cambios.

alter table activos_bolsa   add column if not exists precio_actual_at timestamptz not null default now();
alter table activos_cripto  add column if not exists precio_actual_at timestamptz not null default now();
alter table tarjeta_config  add column if not exists cotizacion_at    timestamptz not null default now();
alter table cotizaciones    add column if not exists dolar_ccl_mep_at timestamptz not null default now();
alter table cotizaciones    add column if not exists dolar_usdt_at    timestamptz not null default now();
alter table activos_usdt    add column if not exists tasa_anual_at    timestamptz not null default now();
alter table activos_pesos   add column if not exists tasa_tna_at      timestamptz not null default now();

-- Regla de todos los triggers:
-- - INSERT → now().
-- - UPDATE → now() solo si el valor cambió (IS DISTINCT FROM, ya convertido al
--   tipo de la columna: "4200" y 4200 son iguales). Si no cambió, se conserva
--   NEW.<campo>_at: lo que ya tenía, o lo que mande la app al tocar "Sigue igual".
-- PL/pgSQL no permite NEW.<columna> con nombre dinámico: una función por campo.

create or replace function marcar_precio_actual_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.precio_actual is distinct from old.precio_actual then
    new.precio_actual_at := now();
  end if;
  return new;
end $$;

create or replace function marcar_cotizacion_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.cotizacion is distinct from old.cotizacion then
    new.cotizacion_at := now();
  end if;
  return new;
end $$;

create or replace function marcar_cotizaciones_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.dolar_ccl_mep is distinct from old.dolar_ccl_mep then
    new.dolar_ccl_mep_at := now();
  end if;
  if tg_op = 'INSERT' or new.dolar_usdt is distinct from old.dolar_usdt then
    new.dolar_usdt_at := now();
  end if;
  return new;
end $$;

create or replace function marcar_tasa_anual_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.tasa_anual is distinct from old.tasa_anual then
    new.tasa_anual_at := now();
  end if;
  return new;
end $$;

create or replace function marcar_tasa_tna_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.tasa_tna is distinct from old.tasa_tna then
    new.tasa_tna_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_precio_actual_at on activos_bolsa;
create trigger trg_precio_actual_at before insert or update on activos_bolsa
  for each row execute function marcar_precio_actual_at();

drop trigger if exists trg_precio_actual_at on activos_cripto;
create trigger trg_precio_actual_at before insert or update on activos_cripto
  for each row execute function marcar_precio_actual_at();

drop trigger if exists trg_cotizacion_at on tarjeta_config;
create trigger trg_cotizacion_at before insert or update on tarjeta_config
  for each row execute function marcar_cotizacion_at();

drop trigger if exists trg_cotizaciones_at on cotizaciones;
create trigger trg_cotizaciones_at before insert or update on cotizaciones
  for each row execute function marcar_cotizaciones_at();

drop trigger if exists trg_tasa_anual_at on activos_usdt;
create trigger trg_tasa_anual_at before insert or update on activos_usdt
  for each row execute function marcar_tasa_anual_at();

drop trigger if exists trg_tasa_tna_at on activos_pesos;
create trigger trg_tasa_tna_at before insert or update on activos_pesos
  for each row execute function marcar_tasa_tna_at();
