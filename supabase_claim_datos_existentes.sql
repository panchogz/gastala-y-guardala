-- Ejecutar DESPUÉS de haber iniciado sesión al menos una vez con tu email real.
-- Reasigna a tu usuario todos los datos que cargaste antes de que existiera login
-- (hoy tienen user_id = NULL, por eso las políticas RLS no te los muestran).

-- 1) Buscá tu user_id (reemplazá el email si usaste otro):
select id as mi_user_id from auth.users where email = 'panchgonzalez12@gmail.com';

-- 2) Copiá ese uuid y pegalo en el :user_id de abajo, después corré todo el bloque:
do $$
declare
  my_id uuid := '00000000-0000-0000-0000-000000000000'; -- <- reemplazar por el uuid del paso 1
begin
  update tarjetas set user_id = my_id where user_id is null;
  update tarjeta_cuotas set user_id = my_id where user_id is null;
  update tarjeta_dolares set user_id = my_id where user_id is null;
  update tarjeta_config set user_id = my_id where user_id is null;
  update total_mensual set user_id = my_id where user_id is null;
  update activos_cripto set user_id = my_id where user_id is null;
  update activos_bolsa set user_id = my_id where user_id is null;
  update activos_usdt set user_id = my_id where user_id is null;
  update evolucion_mensual set user_id = my_id where user_id is null;
  -- cotizaciones y ahorros_config ya tienen user_id NOT NULL (PK), así que si tenían
  -- datos previos a la migración probablemente ya se perdieron o nunca tuvieron fila;
  -- se recrean solos con valores por defecto la primera vez que uses la app logueado.
end $$;
