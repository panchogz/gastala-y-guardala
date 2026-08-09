# Addendum: Tarjetas dinámicas + categorías de ahorro opcionales

Este paso va ANTES del addendum de multiusuario. Acá dejamos de tener "visa" y "master"
fijos y pasamos a una lista de tarjetas que el usuario arma él mismo, más un toggle para
mostrar/ocultar las categorías de ahorro que no use.

## Paso 1 — Migración SQL

```sql
-- 1. Tabla de tarjetas: cada una con nombre libre y un color para la UI
create table tarjetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  color text not null default '#5B9BE8',
  orden int not null default 0,
  created_at timestamptz default now()
);

-- 2. Migrar tus datos de prueba actuales (Visa/Master) a filas reales en "tarjetas"
insert into tarjetas (nombre, color, orden) values ('Visa', '#5B9BE8', 0), ('Master', '#E8A855', 1);

-- 3. Agregar tarjeta_id a las tablas que hoy usan el texto 'visa'/'master'
alter table tarjeta_cuotas add column tarjeta_id uuid references tarjetas(id);
alter table tarjeta_dolares add column tarjeta_id uuid references tarjetas(id);
alter table total_mensual add column tarjeta_id uuid references tarjetas(id);

update tarjeta_cuotas set tarjeta_id = (select id from tarjetas where nombre = 'Visa') where tarjeta = 'visa';
update tarjeta_cuotas set tarjeta_id = (select id from tarjetas where nombre = 'Master') where tarjeta = 'master';
update tarjeta_dolares set tarjeta_id = (select id from tarjetas where nombre = 'Visa') where tarjeta = 'visa';
update tarjeta_dolares set tarjeta_id = (select id from tarjetas where nombre = 'Master') where tarjeta = 'master';
update total_mensual set tarjeta_id = (select id from tarjetas where nombre = 'Visa') where tarjeta = 'visa';
update total_mensual set tarjeta_id = (select id from tarjetas where nombre = 'Master') where tarjeta = 'master';

-- 4. Sacar las columnas viejas de texto, ya no hacen falta
alter table tarjeta_cuotas drop column tarjeta;
alter table tarjeta_dolares drop column tarjeta;
alter table total_mensual drop column tarjeta;
alter table tarjeta_cuotas alter column tarjeta_id set not null;
alter table tarjeta_dolares alter column tarjeta_id set not null;
alter table total_mensual alter column tarjeta_id set not null;

-- 5. tarjeta_config: la primary key pasa a ser tarjeta_id en vez de tarjeta (texto)
alter table tarjeta_config add column tarjeta_id uuid references tarjetas(id);
update tarjeta_config set tarjeta_id = (select id from tarjetas where nombre = 'Visa') where tarjeta = 'visa';
update tarjeta_config set tarjeta_id = (select id from tarjetas where nombre = 'Master') where tarjeta = 'master';
alter table tarjeta_config drop constraint tarjeta_config_pkey;
alter table tarjeta_config drop column tarjeta;
alter table tarjeta_config add primary key (tarjeta_id);

-- 6. Ajustar el unique constraint de total_mensual para que use tarjeta_id
alter table total_mensual drop constraint if exists total_mensual_mes_tarjeta_key;
alter table total_mensual add constraint total_mensual_mes_tarjeta_id_key unique (mes, tarjeta_id);

-- 7. Configuración de categorías de ahorro activas (una sola fila por ahora, sin
--    multiusuario todavía — cuando migremos a multiusuario esto pasa a ser una fila por
--    usuario, igual que el resto)
create table ahorros_config (
  id int primary key default 1,
  usa_cripto boolean not null default true,
  usa_bolsa boolean not null default true,
  usa_usdt boolean not null default true,
  usa_pesos boolean not null default true,
  setup_completo boolean not null default false,
  constraint single_row check (id = 1)
);
insert into ahorros_config (id) values (1);
```

## Paso 2 — Prompt para Claude Code

```
Quiero generalizar dos partes de la app para que no queden hardcodeadas a mis tarjetas y
categorías específicas, ya que otras personas van a usar la misma app con configuraciones
distintas (una sola tarjeta, tres tarjetas, solo caja de ahorro sin cripto ni bolsa, etc.).
Ya corrí la migración SQL correspondiente (ADDENDUM_generalizacion.md).

MÓDULO TARJETAS — de fijo (Visa/Master) a lista dinámica:
1. Ya no hay "Visa" y "Master" hardcodeados en el código. En su lugar, leer la tabla
   "tarjetas" de Supabase (columnas: id, nombre, color, orden) y renderizar un CardPanel
   por cada fila, ordenado por "orden".
2. Agregar una pantalla/sección de "Gestionar tarjetas": permite agregar una tarjeta nueva
   (nombre + elegir color de una paleta fija de 5-6 colores) y eliminar una existente
   (con confirmación, ya que borrarla debería borrar en cascada sus compras en cuotas y
   gastos en dólares asociados — usar ON DELETE CASCADE en las foreign keys o manejarlo
   explícitamente).
3. Todas las referencias en el código a "visa" y "master" como valores fijos deben
   reemplazarse por el tarjeta_id dinámico correspondiente.

MÓDULO AHORROS — categorías opcionales:
1. Leer la tabla "ahorros_config" (fila única por ahora) al cargar la app.
2. Si "setup_completo" es false, mostrar una pantalla de configuración inicial simple:
   checkboxes para "¿Usás Criptomonedas?", "¿Usás Bolsa (CEDEARs/ONs)?", "¿Usás Dólares
   cripto (USDT)?", "¿Tenés Pesos líquidos en caja de ahorro?" — todos marcados por
   default. Al confirmar, guardar los valores en ahorros_config y marcar
   setup_completo = true.
3. Si "setup_completo" es true, no mostrar esta pantalla — ir directo a la app, y ocultar
   por completo (no solo visualmente, no renderizar) las secciones de Cripto, Bolsa, USDT
   o Pesos líquidos según los booleanos de ahorros_config. Las secciones ocultas no deben
   afectar los cálculos del Resumen ni de Evolución Mensual (simplemente no suman nada si
   están desactivadas).
4. Agregar un botón de "Editar configuración de categorías" en algún lugar visible de la
   pantalla de Ahorros, que reabra ese mismo formulario de checkboxes para cambiar la
   elección más adelante sin perder los datos ya cargados en las categorías que se
   mantengan activas.

Empezá por el módulo Tarjetas (lista dinámica), probalo funcionando local, y recién después
seguí con el toggle de categorías de Ahorros.
```

## Qué falta después de esto
Con esta generalización lista, recién ahí correspondería aplicar el `ADDENDUM_multiusuario.md`
— pero ese documento va a necesitar un ajuste menor: donde decía `tarjeta_config` con
`primary key (user_id, tarjeta)`, ahora tiene que ser `primary key (user_id, tarjeta_id)`,
y la tabla `tarjetas` también necesita su propio `user_id` (cada usuario arma su propia
lista de tarjetas, no comparten una lista global). Cuando lleguemos a ese paso te doy la
versión actualizada del addendum de multiusuario para que coincida con este nuevo esquema.
