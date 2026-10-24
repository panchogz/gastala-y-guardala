-- Elimina tarjeta_config.salario_neto: desde el salario único por usuario
-- (config_usuario, ver supabase_config_usuario.sql) la app ya no la usa.
-- Correr en el SQL Editor de Supabase DESPUÉS de desplegar este commit.
alter table tarjeta_config drop column if exists salario_neto;
