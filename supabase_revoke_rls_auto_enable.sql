-- rls_auto_enable(): función SECURITY DEFINER ejecutable sin autenticación (rol anon)
-- detectada por el linter de seguridad de Supabase. Ni el usuario ni el desarrollo de
-- este proyecto la reconocen como creada acá — no hay ningún rastro de ella en el
-- código de la app (que ni siquiera usa supabase.rpc() en ningún lugar), ni en el
-- historial de git, ni en ningún .sql versionado de este repo. Se le saca el permiso
-- de ejecución a los roles públicos por seguridad, sin borrar la función en sí (por si
-- hiciera falta investigarla más adelante).

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- El REVOKE de arriba no alcanza solo: Postgres le otorga EXECUTE a PUBLIC por
-- default al crear una función, y anon/authenticated son miembros implícitos de
-- PUBLIC — heredan el permiso por ahí aunque se les revoque a ellos puntualmente.
-- Confirmado: corrimos el REVOKE de arriba y el warning del linter de Supabase
-- siguió apareciendo idéntico, exactamente el síntoma de este caso.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
