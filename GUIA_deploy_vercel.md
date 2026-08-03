# Guía: Deploy a Vercel

## Requisito previo
El proyecto tiene que estar en un repositorio de GitHub (Vercel se conecta a GitHub
directamente, no subís archivos a mano). Si Claude Code no lo inicializó como repo git
todavía, pedile que lo haga y subilo a un repo nuevo en tu cuenta de GitHub (puede ser
privado, Vercel funciona igual con repos privados).

## Paso 1 — Crear el proyecto en Vercel
1. Entrá a vercel.com, creá cuenta con tu cuenta de GitHub (más simple, te autoriza el
   acceso a los repos de una).
2. **Add New → Project**.
3. Elegí el repo de tu app.
4. Vercel detecta solo que es un proyecto Vite/React — no deberías tener que tocar el
   "Framework Preset" ni el "Build Command", los toma automático.

## Paso 2 — Variables de entorno
**No subas tu `.env` a GitHub** (por eso el `.gitignore` lo excluye) — en Vercel las cargás
por separado, a mano, en la interfaz:

1. En la pantalla de configuración del proyecto (antes de deployar, o después en
   **Settings → Environment Variables**), agregá una por una:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TURNSTILE_SITE_KEY`
2. Dejalas marcadas para los tres entornos (Production, Preview, Development) salvo que
   tengas una razón para separarlas.
3. Click en **Deploy**.

A los pocos minutos, Vercel te da una URL tipo `tu-proyecto.vercel.app` — ya es HTTPS real,
funcionando.

## Paso 3 — Conectar tu dominio propio (opcional pero recomendado)
Ya que compraste un dominio para Resend, podés usar el mismo (o un subdominio) para la app:
1. En Vercel: **Settings → Domains → Add**.
2. Escribís tu dominio (o algo como `app.tudominio.com` si preferís separar el email del
   dominio raíz).
3. Vercel te muestra los registros DNS que hay que agregar (un `CNAME` o `A record`,
   distinto a los de Resend, no se pisan entre sí).
4. Los cargás en el panel DNS de tu dominio (Cloudflare, si lo compraste ahí).
5. Esperás a que Vercel confirme la verificación (icono verde).

## Paso 4 — Actualizar las URLs en Supabase (importante, sin esto el login no anda en producción)
El magic link necesita saber a qué URL redirigir después de que alguien hace click en el
mail. Como ahora tenés una URL real (no más `localhost`):

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** cambiala de `http://localhost:5173` a tu URL de Vercel o tu dominio
   propio (ej. `https://app.tudominio.com`).
3. **Redirect URLs:** agregá esa misma URL a la lista de permitidas (podés dejar también
   `http://localhost:5173` en la lista mientras sigas necesitando probar local, Supabase
   permite varias).

## Paso 5 — Actualizar el dominio permitido en Turnstile
1. Cloudflare → Turnstile → tu site → Settings → **Domains**.
2. Agregá tu dominio de producción (`app.tudominio.com` o `tu-proyecto.vercel.app`) a la
   lista, sin sacar `localhost` si lo seguís necesitando para desarrollo.

## Paso 6 — Confirmar el sender de Resend con el dominio final
Si conectaste un subdominio distinto en Vercel al que usaste para verificar Resend (por
ejemplo, Resend verificado en `tudominio.com` pero la app corriendo en
`app.tudominio.com`), no hay problema — son cosas independientes: el dominio de Resend es
solo de dónde salen los mails, no tiene que coincidir con dónde vive la app.

## Paso 7 — Probar todo el circuito en producción
1. Entrá a la URL real (no localhost).
2. Probá el login completo: email → Turnstile → magic link → click en el mail → te
   redirige de vuelta a la app ya logueado.
3. Confirmá que ves tus datos (los que reclamaste con tu UUID en la migración de
   multiusuario).
4. Desde el celu, instalá la PWA desde esta URL real (Safari → compartir → "Agregar a
   pantalla de inicio") — recién acá, con HTTPS real, el Service Worker se activa
   correctamente para el modo offline.

## Redeploys posteriores
Una vez conectado, cualquier cambio que Claude Code haga y subas a GitHub (`git push`)
dispara un redeploy automático en Vercel — no hay que repetir ningún paso de configuración,
salvo que agregues una variable de entorno nueva en el futuro (esa sí hay que cargarla a
mano en Vercel una vez).
