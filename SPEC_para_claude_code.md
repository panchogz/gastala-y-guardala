# Spec: App de Seguimiento Financiero (Tarjetas + Patrimonio)

## Contexto
Reemplaza dos excels personales: uno de seguimiento de compras con tarjeta de crédito en cuotas (Visa/Master), otro de seguimiento de patrimonio (cripto, CEDEARs/ONs, USDT). Ya existe un prototipo funcional en React (sin backend) que valida toda la lógica de cálculo: `finanzas_app.jsx` (adjuntar ese archivo como referencia de UI/lógica al arrancar el proyecto).

## Stack
- **Frontend:** React + Vite. PWA (manifest + service worker) para poder "instalarse" en el celular sin tienda de apps.
- **Backend:** Supabase (Postgres + Auth + API). Un solo usuario (vos), auth por magic link.
- **Hosting:** Vercel o Netlify (deploy gratis, dominio propio opcional).

## Paso 0 — Setup de Supabase (esto lo hacés vos, manualmente, antes de tirarle el prompt a Claude Code)
1. Crear cuenta en supabase.com → "New project".
2. Guardar `Project URL` y `anon public key` (Settings → API).
3. Ejecutar el SQL de abajo en el SQL Editor de Supabase.

## Schema SQL (correr en Supabase)

```sql
-- Cotización de referencia (una fila global)
create table cotizaciones (
  id int primary key default 1,
  dolar_ccl_mep numeric not null default 1200,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into cotizaciones (id, dolar_ccl_mep) values (1, 1200);

-- Tarjetas: compras en cuotas (ARS)
create table tarjeta_cuotas (
  id uuid primary key default gen_random_uuid(),
  tarjeta text not null check (tarjeta in ('visa','master')),
  fecha date not null,
  comercio text,
  monto numeric not null default 0,
  cuotas int not null default 1,
  created_at timestamptz default now()
);

-- Tarjetas: gastos en dólares (contado)
create table tarjeta_dolares (
  id uuid primary key default gen_random_uuid(),
  tarjeta text not null check (tarjeta in ('visa','master')),
  fecha date not null,
  comercio text,
  monto numeric not null default 0,
  created_at timestamptz default now()
);

-- Config por tarjeta (salario neto, cotización usada al momento de cargar)
create table tarjeta_config (
  tarjeta text primary key check (tarjeta in ('visa','master')),
  salario_neto numeric default 0,
  cotizacion numeric default 1200
);
insert into tarjeta_config (tarjeta) values ('visa'), ('master');

-- Total mensual registrado (snapshot manual con el botón "Registrar")
create table total_mensual (
  id uuid primary key default gen_random_uuid(),
  mes date not null, -- primer día del mes
  tarjeta text not null check (tarjeta in ('visa','master')),
  total numeric not null,
  unique (mes, tarjeta)
);

-- Patrimonio: cripto
create table activos_cripto (
  id uuid primary key default gen_random_uuid(),
  activo text not null,
  cantidad numeric not null default 0,
  precio_compra_usd numeric, -- null/0 = opcional
  precio_actual_usd numeric not null default 0,
  created_at timestamptz default now()
);

-- Patrimonio: bolsa (CEDEARs/ONs)
create table activos_bolsa (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  cantidad numeric not null default 0,
  precio_compra_ars numeric,
  precio_actual_ars numeric not null default 0,
  created_at timestamptz default now()
);

-- Patrimonio: dólares cripto (stablecoins)
create table activos_usdt (
  id uuid primary key default gen_random_uuid(),
  activo text not null,
  costo_total_usd numeric,
  valor_actual_usd numeric not null default 0,
  created_at timestamptz default now()
);

-- Evolución mensual (snapshots de patrimonio)
create table evolucion_mensual (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique, -- primer día del mes
  cripto_usd numeric default 0,
  bolsa_usd numeric default 0,
  dolares_usd numeric default 0,
  cripto_ars numeric default 0,
  bolsa_ars numeric default 0,
  dolares_ars numeric default 0
);

-- RLS: como es un solo usuario, se puede simplificar con auth.uid() si querés
-- multi-dispositivo con login, o dejar todo público si solo lo vas a usar vos
-- y confiar en que la URL de Supabase no se comparte. Recomendado: activar RLS
-- + policy que exija auth.uid() = un user_id fijo tuyo, agregando esa columna
-- a cada tabla.
```

## Features (mapeadas 1:1 desde los excels)

### Módulo Tarjetas
- Dos paneles (Visa / Master), cada uno con:
  - Input de salario neto del mes y cotización del dólar (editable, guardados en `tarjeta_config`).
  - Tabla de compras en cuotas: fecha, comercio, monto, nº de cuotas → calculado en el frontend (no en la DB): cuota actual = `min(cuotas, max(1, meses_completos_desde(fecha) + 1))`, cuotas pendientes, monto por cuota, saldo pagado, saldo pendiente.
  - Tabla de gastos en dólares (sin cuotas): fecha, comercio, monto USD → monto en pesos = monto * cotización.
  - Total a pagar = suma(monto por cuota de cuotas activas) + suma(gastos en dólares convertidos).
  - % del salario = total a pagar / salario neto.
  - Botón "Registrar este mes" → hace upsert en `total_mensual` con mes actual, tarjeta, total.
- Vista "Total Mensual": tabla de `total_mensual` agrupada por mes, con columna Visa, Master y Total.

### Módulo Patrimonio
- Input global de cotización dólar CCL/MEP (tabla `cotizaciones`, fila única).
- Tabla Cripto: activo, cantidad, precio compra USD (opcional), precio actual USD → costo total, valor actual USD, P&L, P&L%, valor en ARS, % cartera. Si precio_compra es null/0, mostrar "—" en costo/P&L/P&L% sin romper el resto.
- Tabla Bolsa: mismo patrón en ARS con conversión a USD.
- Tabla Dólares Cripto (USDT): activo/plataforma, costo total USD (opcional), valor actual USD → rendimiento, valor ARS, % cartera.
- Resumen: totales por categoría en USD y ARS + % del patrimonio total (100% automático, sin inputs).
- Evolución Mensual: tabla + gráfico de línea del patrimonio total en USD por mes. Botón "Guardar foto del mes" → upsert en `evolucion_mensual` con los totales actuales del Resumen para el mes en curso.

### Extras que el excel no tenía (mencionar como fase 2, no bloquean el MVP)
- Traer cotización del dólar automáticamente desde dolarapi.com.
- Traer precios de cripto desde CoinGecko API.
- Recordatorio (notificación o email) para registrar el mes antes de que cierre la tarjeta.

## Prompt para pegarle a Claude Code (una vez corrido el SQL en Supabase)

```
Quiero que armes un proyecto React + Vite + Supabase siguiendo el spec adjunto
(SPEC_para_claude_code.md) y usando finanzas_app.jsx como referencia de UI y
lógica de cálculo (hay que portar esa lógica para que lea/escriba de Supabase
en vez de useState local).

Mis credenciales de Supabase están en un .env que voy a crear yo con
VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.

Arrancá por el módulo Tarjetas completo (ambas tablas, cálculos, botón
Registrar) conectado a Supabase, corriendo local con `npm run dev`, antes de
pasar al módulo Patrimonio. Cuando termines cada módulo, mostrame cómo
probarlo antes de seguir.
```
