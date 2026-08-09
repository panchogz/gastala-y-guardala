# Addendum: Multiusuario con login (magic link) — v2, ajustado a tarjetas dinámicas

Esta es la versión actualizada del addendum de multiusuario, ya con el esquema que quedó
después de generalizar Tarjetas (tabla `tarjetas` + `tarjeta_id`) y de agregar
`ahorros_config`. Reemplaza al `ADDENDUM_multiusuario.md` anterior — usá este.

## Paso 1 — Migración SQL

```sql
-- 1. Sacar las policies de desarrollo
drop policy if exists "allow_all_dev" on cotizaciones;
drop policy if exists "allow_all_dev" on tarjeta_cuotas;
drop policy if exists "allow_all_dev" on tarjeta_dolares;
drop policy if exists "allow_all_dev" on tarjeta_config;
drop policy if exists "allow_all_dev" on total_mensual;
drop policy if exists "allow_all_dev" on activos_cripto;
drop policy if exists "allow_all_dev" on activos_bolsa;
drop policy if exists "allow_all_dev" on activos_usdt;
drop policy if exists "allow_all_dev" on evolucion_mensual;
drop policy if exists "allow_all_dev" on tarjetas;
drop policy if exists "allow_all_dev" on ahorros_config;

-- 2. Agregar user_id a todas las tablas que todavía no lo tienen
alter table tarjetas add column user_id uuid references auth.users(id) default auth.uid();
alter table tarjeta_cuotas add column user_id uuid references auth.users(id) default auth.uid();
alter table tarjeta_dolares add column user_id uuid references auth.users(id) default auth.uid();
alter table total_mensual add column user_id uuid references auth.users(id) default auth.uid();
alter table activos_cripto add column user_id uuid references auth.users(id) default auth.uid();
alter table activos_bolsa add column user_id uuid references auth.users(id) default auth.uid();
alter table activos_usdt add column user_id uuid references auth.users(id) default auth.uid();
alter table evolucion_mensual add column user_id uuid references auth.users(id) default auth.uid();

-- 3. tarjeta_config: la primary key pasa a ser (user_id, tarjeta_id)
alter table tarjeta_config drop constraint tarjeta_config_pkey;
alter table tarjeta_config add column user_id uuid references auth.users(id) default auth.uid();
alter table tarjeta_config add primary key (user_id, tarjeta_id);

-- 4. cotizaciones: deja de ser fila única global, pasa a ser una fila por usuario
alter table cotizaciones drop constraint if exists single_row;
alter table cotizaciones drop column if exists id;
alter table cotizaciones add column user_id uuid references auth.users(id) primary key default auth.uid();

-- 5. ahorros_config: deja de ser fila única global, pasa a ser una fila por usuario
alter table ahorros_config drop constraint if exists single_row;
alter table ahorros_config drop column if exists id;
alter table ahorros_config add column user_id uuid references auth.users(id) primary key default auth.uid();

-- 6. Ajustar unique constraints para que incluyan user_id
alter table total_mensual drop constraint if exists total_mensual_mes_tarjeta_id_key;
alter table total_mensual add constraint total_mensual_user_mes_tarjeta_key unique (user_id, mes, tarjeta_id);
alter table evolucion_mensual drop constraint if exists evolucion_mensual_mes_key;
alter table evolucion_mensual add constraint evolucion_mensual_user_mes_key unique (user_id, mes);

-- 7. Policies nuevas: cada usuario solo ve y edita sus propias filas
create policy "own_rows" on tarjetas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on cotizaciones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on tarjeta_cuotas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on tarjeta_dolares for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on tarjeta_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on total_mensual for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on activos_cripto for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on activos_bolsa for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on activos_usdt for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on evolucion_mensual for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on ahorros_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Antes de correr esto:** con lo que tenés cargado hoy (las tarjetas Visa/Master de prueba,
NIKE/ADIDAS, la config de Ahorros), todas esas filas van a quedar con `user_id = null` hasta
que las actualices con tu propio UUID. Conseguí tu UUID así: logueate una vez en la app
(cuando tengas el login armado en el Paso 2) y andá a Supabase → Authentication → Users,
copiá el UUID de tu usuario, y corré:

```sql
update tarjetas set user_id = 'tu-uuid-aca' where user_id is null;
update tarjeta_cuotas set user_id = 'tu-uuid-aca' where user_id is null;
update tarjeta_dolares set user_id = 'tu-uuid-aca' where user_id is null;
update tarjeta_config set user_id = 'tu-uuid-aca' where user_id is null;
update total_mensual set user_id = 'tu-uuid-aca' where user_id is null;
update activos_cripto set user_id = 'tu-uuid-aca' where user_id is null;
update activos_bolsa set user_id = 'tu-uuid-aca' where user_id is null;
update activos_usdt set user_id = 'tu-uuid-aca' where user_id is null;
update evolucion_mensual set user_id = 'tu-uuid-aca' where user_id is null;
update ahorros_config set user_id = 'tu-uuid-aca' where user_id is null;
```

(Este paso de "reclamar" las filas viejas se hace una sola vez, después del primer login,
y antes de intentar usar la app con RLS ya activo — si no, ni vos vas a poder ver esas
filas, porque no tienen tu user_id todavía.)

## Paso 2 — Prompt para Claude Code

```
Quiero agregar autenticación multiusuario a este proyecto usando Supabase Auth con magic
link (passwordless, por email). Ya corrí la migración SQL (ADDENDUM_multiusuario_v2.md)
que agrega user_id a todas las tablas y policies de RLS por usuario.

Necesito:
1. Una pantalla de login simple: input de email, botón "Enviarme el link", y un mensaje de
   "revisá tu correo" después de enviarlo. Usar supabase.auth.signInWithOtp().
2. Que la app entera quede detrás de ese login: si no hay sesión activa, mostrar solo la
   pantalla de login. Usar supabase.auth.onAuthStateChange() para reaccionar a login/logout.
3. Un botón de "Cerrar sesión" visible en algún lugar de la interfaz (header, junto al
   título).
4. Todas las consultas y inserts que ya existen (tarjetas, cuotas, gastos en dólares,
   activos, evolución, configuración de ahorros) deben incluir automáticamente el user_id
   de la sesión activa, sin pedirlo en ningún formulario — se completa solo al insertar.
5. La pantalla de "setup inicial" de Ahorros (checkboxes de categorías) y la de "Gestionar
   tarjetas" deben seguir funcionando igual, pero ahora quedan por usuario: un usuario
   nuevo que se loguea por primera vez ve todo vacío (sin tarjetas, sin configuración de
   ahorros hecha), no ve nada de lo que yo cargué.

No hace falta pantalla de registro separada: con magic link, el primer login de un email
nuevo ya crea la cuenta.
```

## Flujo para tus amigos
1. Le pasás la URL de la app deployada.
2. Ponen su email, reciben el link, entran.
3. Ven la pantalla de "setup inicial": cargan sus propias tarjetas y eligen qué categorías
   de ahorro usan.
4. Desde ahí en más, cada uno ve y edita solo lo suyo.
