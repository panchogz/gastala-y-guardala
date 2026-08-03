-- Otorga permisos a nivel de tabla a los roles anon/authenticated.
-- RLS (policies) controla QUÉ filas se ven; esto controla si el rol
-- puede tocar la tabla en absoluto. Sin esto, Postgres tira
-- "permission denied for table X" antes incluso de evaluar RLS.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- para que los inserts con id serial/uuid default sigan funcionando
grant usage, select on all sequences in schema public to anon, authenticated;

-- para que futuras tablas hereden estos permisos automáticamente
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
