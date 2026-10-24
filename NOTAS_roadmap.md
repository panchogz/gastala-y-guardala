# Notas / Roadmap — Gastala y Guardala

## Pendientes

1. ~~Autocompletar OTP desde el mail~~ — resuelto, ver "Resuelto".

2. **Gráficos de evolución con muchos meses.** Hoy no hay límite ni filtro de rango. Con
   el tiempo, la vista mobile se puede saturar visualmente. Cuando el historial crezca,
   agregar un selector de rango (últimos 6/12 meses). No urgente todavía.

3. **[Fase B] Automatización mensual del export a Excel por mail.** La Fase A (botón
   manual) ya está resuelta — ver "Resuelto". La Fase B (mandar el Excel solo, una vez al
   mes, a cada usuario) queda pendiente indefinidamente por decisión propia: por ahora la
   exportación es siempre a pedido del usuario, no automática.

4. ~~Pesos líquidos~~ — implementado, ver "Resuelto". (Número conservado para no romper
   referencias a otros pendientes.)

5. **[Prioridad baja] Alertas de intentos de login fallidos.** Hoy no hay ninguna
   notificación proactiva — hay que entrar manualmente a Supabase → Authentication → Logs.
   Ojo con la factibilidad: no está confirmado que los logs de Auth se puedan consultar
   programáticamente con las credenciales que ya usa el proyecto (anon/service_role);
   podría requerir la Management API de Supabase, con su propio token de acceso. Antes de
   estimar esto como "mismo patrón que el keep-alive", conviene confirmar ese punto.

6. **[Prioridad muy baja, revisar si vale la pena] Login con contraseña como
   alternativa al OTP.** Cada dispositivo/navegador nuevo pide sí o sí el código por mail
   (esto no cambia — es una decisión de seguridad correcta, no una limitación a resolver).
   Se podría sumar una contraseña única vía Supabase Auth para entrar directo en cualquier
   dispositivo sin pasar por el mail, dejando el OTP como recuperación. Técnicamente
   simple. Vale la pena reconsiderar el valor real: para un grupo chico de confianza, un
   tercer método de entrada (sumado a OTP y PIN/biometría) puede generar más confusión
   que beneficio concreto.

7. **[Fase 1 pendiente] Visualización en ambas monedas — Tarjetas.** Hoy "Total a pagar"
   mezcla cuotas en ARS y gastos en dólares ya convertidos, en un solo número en pesos —
   no hay vista en dólares. Falta decidir el diseño: ¿el gráfico muestra dos series por
   tarjeta (una por moneda), o hay un selector que alterna la vista completa? Definir
   antes de tocar código. (La Fase 2, Ahorros, ya está resuelta — ver "Resuelto".)

8. **Export retroactivo (mes anterior, no solo el actual).** La app ya guarda fotos
   mensuales, pero solo cuando el usuario aprieta "Registrar mes" o "Guardar foto" — no es
   automático. Para Tarjetas, el detalle tiene fecha propia, así que se podría reconstruir
   un reporte histórico exacto de cualquier mes filtrando por fecha, incluso sin haberlo
   registrado en su momento. Para Ahorros la reconstrucción no es confiable: los activos
   solo guardan el "precio actual" (se sobreescribe, sin historial), así que un mes pasado
   solo se puede exportar si esa foto puntual fue guardada en su momento. Falta diseñar el
   selector de mes en el modal de export, dejando esta limitación clara para el usuario.

9. **Extensión del análisis de spread a Buenbit — polling en curso.** A partir del
   resultado cerrado de Lemon/Binance P2P (ver "Resuelto"), se decidió sumar Buenbit como
   tercer exchange de referencia, usando el mismo mecanismo (polling cada 3 horas, vía API
   de CriptoYa, que ya venía siendo la fuente real detrás de los datos de Lemon/Binance
   P2P — confirmado por el nombrado de exchanges en el CSV, coincide con la convención de
   CriptoYa). Tarea de Windows a crear con `setup_tarea_windows.bat` →
   `SpreadPollingCripto2`, corriendo `polling_spread_cripto.py`, guardando en
   `spread_polling_data_v2.csv`. Análisis con `analizar_spread_cripto.py` (mismo test de
   hipótesis que el cierre anterior, ya generalizado para cualquier cantidad de
   exchanges). Sigue siendo puramente informativo, mismo alcance que el análisis anterior.

10. **Mejoras a la importación de resúmenes (detectadas al probar con resúmenes reales).**
    La feature base ya está en producción (ver "Resuelto"). Pendientes chicos:
    - **`fecha_cierre` null:** una captura parcial del resumen puede no traerla, y la
      Etapa 2 la necesita para calcular la fecha de compra. Si llega null, pedirla en la
      revisión (input obligatorio, default sugerido: última `fecha_compra`).
    - **`es_suscripcion` editable en la revisión,** no solo el checkbox de incluir: el
      chat no puede distinguir descriptores ambiguos (ej. `MERPAGO*MELI` = MELI+, no una
      compra en Mercado Libre). Permitir mover la fila entre "Un pago" y "Suscripciones".
    - **Deduplicar suscripciones dentro del mismo JSON** (comercio + monto): un resumen
      puede cubrir dos ciclos (ej. LinkedIn cobrado el 22/08 y el 22/09) y hoy se
      crearían dos recurrentes iguales.
    - **Validación contra el total del resumen:** sumar `total_consumos_ars` /
      `total_consumos_usd` (opcionales) al schema y compararlos con la suma de filas en la
      revisión. Detecta errores de lectura (en la prueba, una cuota 12/12 se leyó 12/18
      desde una foto; el PDF la tenía bien).
    - Probado: el PDF es más confiable que capturas/fotos — sugerirlo en las instrucciones.

11. **[Posible mejora, solo si molesta en la práctica] Día de cierre aproximado por
    tarjeta.** Hoy la cuota cambia el día del mes de la compra, no en la fecha de
    cierre de la tarjeta: una compra del 20/10 sigue sumando hasta el 19/11 aunque
    el resumen real la cierre antes o después. Si "Total a pagar" no coincide con
    el resumen de forma molesta, agregar un día de cierre aproximado por tarjeta
    (campo único, se carga una vez). El cierre exacto mes a mes se descartó: cambia
    todos los meses y obliga a una carga manual que se olvida.

## Testeo y QA

1. **Cobertura de pruebas en Android.** Todo lo construido este año (login OTP en PWA,
   Face ID/PIN, splash screens, cola offline) se probó exclusivamente en iPhone. Nunca se
   validó en un dispositivo Android real. Dado que Chrome/Android suele manejar mejor
   estas APIs que Safari/iOS, es poco probable que aparezcan problemas — pero sigue siendo
   una superficie sin comprobar, no solo un detalle menor.

2. **Prueba real de multiusuario con un amigo de verdad.** El aislamiento entre usuarios
   se probó con dos cuentas propias (Gmail e iCloud), nunca con la cuenta de otra
   persona. Antes de considerar el multiusuario "cerrado" del todo, vale la pena una
   prueba con al menos un amigo real. Combina bien con el punto anterior si ese primer
   amigo usa Android.

3. **Avisar a los amigos sobre el acceso administrativo antes de invitarlos.**
   *(Parcialmente resuelto: quedó escrito en la Ayuda, pregunta "¿Quién puede ver
   mis datos?". Falta avisarles en persona antes de que carguen datos.)* Charlado
   en su momento pero nunca convertido en acción: como dueño del proyecto de Supabase,
   el usuario técnicamente puede ver los datos crudos de cualquier usuario, aunque RLS
   los aísle entre ellos en la app. Es una limitación normal de administrar tu propia
   infraestructura, no un bug — pero conviene ser transparente con quien se invite, antes
   de que empiecen a cargar datos.

4. **Vigilar los límites del plan gratis de Supabase a medida que crezca el uso real.**
   Chequeado el 06/08/2026: 8 MB de 5 GB de egress, 27 MB de 500 MB de base de datos (de
   los cuales solo ~416 KB son datos propios — el resto es overhead fijo de Postgres/
   Supabase, no crece con el uso), 3 de 50.000 usuarios activos, 0 de 1 GB de storage.
   Muy lejos de cualquier límite hoy. Igual, vale la pena revisar de vez en cuando el
   dashboard (Settings → Usage) si se suman varios amigos usando la app con frecuencia.

## Deuda técnica

1. **Validación inexistente en la carga inline (desktop).** El alta inserta valores
   vacíos/cero sin validar; la edición de tarjetas solo convierte a número
   (`Number(x) || 0`) y AssetTable manda strings crudos a Postgres. La única
   validación real está en MobileEntryForm (reglas declaradas en la config de
   campos). Unificar si en algún momento se rehace la edición inline.

2. **Capitalización diaria duplicada 4 veces.** `(1 + tna/100/365)^días` está escrita
   a mano en AhorrosView.jsx (x2) y exportXlsx.js (x2). Los helpers nuevos
   (`tnaAMensual` / `mensualATna` en helpers.js) convierten tasas pero no reemplazan
   estas copias. Extraer un helper `saldoConInteres(saldo, tna, dias)` y reusarlo.

3. ~~Columna `tarjeta_config.salario_neto` sin uso~~ — resuelto, ver "Resuelto".

## Docs a actualizar al cerrar cada feature

- `src/content/ayuda.js` (Ayuda y tips "?"): revisar que las respuestas sigan
  coincidiendo con lo que hace el código.
- `GUIA_DE_USO.md` (interna).

## Resuelto

- **Salario neto único por usuario + "% del salario" total (ex deuda técnica 3).**
  El salario pasó de `tarjeta_config` (uno por tarjeta) a la tabla `config_usuario`
  (uno por usuario, `supabase_config_usuario.sql`), editable en una franja arriba de
  las tarjetas con el total de todas y su %. Commit `1147fbd`. La columna vieja
  `tarjeta_config.salario_neto` se eliminó con `supabase_drop_salario_tarjeta.sql`.

- **Cuotas terminadas dejaban de restar (bug).** "Total a pagar" sumaba la cuota de
  compras ya terminadas hasta que se borraban a mano. Fix: `cuotaInfo(row, fecha)`
  en helpers.js como único cálculo de cuotas (tabla, total, proyección y export).
  Compra de N cuotas suma en 1..N, deja de sumar desde N+1. Las fotos ya
  registradas no se recalcularon. Commit `ea9258a`.

- **Compromisos futuros en el gráfico de Tarjetas.** El gráfico de evolución sigue
  3 meses hacia adelante con trazo punteado: cuotas pendientes + recurrentes
  activas ("mínimo ya comprometido", sin compras futuras ni USD). El mes actual
  usa el valor en vivo aunque exista foto. Commit `3dcef70`.

- **Alta de filas vía formulario en mobile (≤640px).** MobileEntryForm genérico,
  bottom sheet, validación mínima propia, compatible con cola offline. Edición
  sigue inline. Commit `daa44e6`.

- **Calculadora "¿Cuotas o contado?".** Simulación mes a mes; resultado principal
  = punto de equilibrio ("conviene en cuotas si tu plata rinde más de X%").
  Tasa de comparación elegible (caja remunerada, inflación esperada, 0%, otra);
  nunca suma inflación y rendimiento. "Cargar como compra" abre el alta precargada.
  Commit `db7afe6`.

- **Menú ⋯ + Ayuda (FAQ) + ayuda contextual.** Header agrupado en un menú;
  FAQ en acordeón desde src/content/ayuda.js; tips "?" en los campos donde
  equivocarse cuesta caro. Selector de vista solo en desarrollo. Commit `0cf2ff1`.

- **Turnstile sin localhost (10/2026).** Se sacó localhost de Hostname Management.
  Para loguearse en local, agregarlo temporalmente y sacarlo al terminar. Las
  test keys de Cloudflare no sirven en este setup: la secret vive en Supabase,
  compartido entre local y producción.

- **Autocompletar OTP desde el mail (ex pendiente 1).** Input del código en Login.jsx con
  `autocomplete="one-time-code"`, `inputMode="numeric"` y `pattern="[0-9]*"`, sin
  `maxLength` fijo (el largo es configurable en Supabase). Con eso solo no alcanzaba: iOS
  ofrecía autocompletar contacto/email en vez del código. Lo que lo destrabó fue el mail:
  plantilla Magic Link de Supabase rehecha al estilo de otros servicios que sí
  autocompletan — asunto con el código y la palabra "código"
  (`{{ .Token }} es tu código de Gastala y Guardala`), código solo y destacado en el
  cuerpo, sin el link de magic link (inútil en la PWA). Funciona con la app de Gmail, sin
  ajustes en el iPhone del usuario. Gotcha: el formato viejo siguió llegando un rato
  después de guardar la plantilla; para verificar qué manda realmente Supabase, mirar
  Resend → Emails, no la bandeja de entrada (Gmail agrupa por asunto).

- **Pesos Líquidos (caja de ahorro remunerada) — ex pendiente 4.** Commit `648ad9a`.
  Cuarto tipo de cuenta de ahorro ("Pesos", acento #C77DFF), mismo mecanismo que
  USD/Stable: saldo + TNA + fecha de último cálculo, interés compuesto diario calculado
  en vivo. Editar la tasa cierra el cálculo con la tasa vieja y reabre con la nueva.
  Editar el saldo (suba o baje) fija ese valor como saldo a hoy y resetea la fecha de
  cálculo — lógica común con USD/Stable (`handleSaldoAportadoBlur`). Antes, bajar el
  saldo no reseteaba la fecha y un retiro real generaba interés retroactivo sobre plata
  que ya no estaba (bug corregido 10/2026; se eliminó la rama "typo").
  Incluido en Resumen, Evolución y export a Excel. Verificado contra el código (10/2026);
  había quedado como pendiente en el roadmap por error. El spec FEATURE_pesos_liquidos.md
  no está en el repo: la referencia es el commit y el código.

- **Importación de resúmenes vía chat de IA externo (ex pendiente 10).** Carga inicial
  de tenencia (Ahorros) y resumen de tarjeta: la app da el prompt, el usuario lo usa en su
  propio chat con el PDF/foto y pega el JSON; pantalla de revisión obligatoria, sin
  backend ni costo. Probado con tenencia de broker (CEDEARs + ONs con precio cada 100 VN)
  y resumen Visa ICBC real. Spec: FEATURE_importacion_resumenes.md. Mejoras detectadas en
  la prueba: ver pendiente 10. De paso: una tarjeta sola ahora ocupa todo el ancho.

- **Actualización de la PWA tras cada deploy.** Síntoma: después de un deploy, la
  pestaña/PWA abierta seguía mostrando la versión vieja hasta limpiar caché o desregistrar
  el service worker. No era caché HTTP (Vercel ya sirve `sw.js` con `must-revalidate`):
  faltaba `clientsClaim` en Workbox, así que el SW nuevo se activaba pero no tomaba
  control de la sesión abierta y nunca se disparaba la recarga. Fix: `clientsClaim: true`
  + `registerType: "prompt"` con aviso "Nueva versión disponible · Recargar" (no recarga
  silenciosa, para no perder un formulario o una importación a medio revisar) + chequeo
  periódico de actualizaciones (cada ~1h y al volver a la app). Confirmado funcionando.

- **Análisis de spread de USDT (cotización de referencia vs. precio real) — Lemon y
  Binance P2P.** Cerrado el 17/08/2026. El polling cada 3 horas (tarea de Windows
  "SpreadPolling", dada de baja al cerrar el análisis) corrió del 8 al 16 de agosto y
  juntó 126 mediciones (63 por exchange, observaciones independientes en el tiempo).
  Resultado, con intervalos de confianza del 95%: Binance P2P +0.16% respecto a la
  referencia ([0.11%, 0.20%]), Lemon -1.39% ([-1.45%, -1.32%]) — bastante más chico que
  la primera estimación puntual (3.25% Lemon / 4.70% Binance P2P), que sobreestimaba el
  spread por un problema metodológico (pseudo-replicación). Nota de calidad de datos: en
  Lemon, ~29% de las lecturas quedaron congeladas en dos bloques largos y contiguos (12.6h
  y 39h) con ask/bid idénticos — causa no determinada con los datos disponibles (puede ser
  que Lemon actualice su propio precio con poca frecuencia, o un problema de caché en el
  polling; no se afirma cuál sin evidencia adicional). No invalida el resultado: el efecto
  es tan grande (Cohen's d = -5.32) que se sostiene igual incluso en el escenario más
  conservador de solo 44 valores distintos. Sigue siendo puramente informativo — no
  dispara ningún cambio de código, el campo "Cotización USDT" se sigue completando a
  mano. Detalle completo (con test de hipótesis formal, tamaño de efecto y chequeo de
  supuestos) en `GUIA_DE_USO.md`, sección "Resultado del análisis", y en el informe
  `analisis_spread_usdt.docx`.

- **Rediseño de USD/Stable con interés compuesto.** Reemplazó el modelo de Costo Total /
  Valor Actual manual (que sugería que USDT fluctúa como un activo especulativo) por
  saldo + tasa **TNA** (Tasa Nominal Anual, con capitalización diaria — confirmado que
  Lemon también publica TNA, no tasa efectiva) + fecha de último cálculo. El saldo se
  "cierra" (capitaliza el interés generado) y se reabre cada vez que se agrega un aporte
  nuevo o se edita la tasa. Iteración de UX: el primer intento usó un botón separado
  "Agregar fondos", que quedó descartado por inconsistente con el resto de la app — se
  rediseñó a un campo "Saldo aportado" siempre visible y editable in place (como
  cualquier otro campo de la app), donde subir el valor manualmente dispara el mismo
  mecanismo de cierre por atrás, sin una acción separada. Mismo mecanismo (fórmula TNA,
  campo inline) que se reutiliza para Pesos Líquidos (ver arriba). Confirmado por
  el usuario.

- **Zoom automático de iOS al enfocar inputs.** Al tocar cualquier input en la PWA
  instalada, Safari disparaba zoom de página y no volvía siempre a escala normal —
  causado por varios inputs con font-size menor a 16px (WebKit hace zoom automático como
  ayuda de accesibilidad en ese caso). Se investigó a fondo antes de decidir: se confirmó
  con evidencia (grep + prueba empírica en iPhone real) que subir el font-size a 16px
  elimina el zoom, pero eso agranda visualmente los campos; se probó compensar con
  `transform: scale()` pero rompió el layout de las tablas en Safari real. Se descartaron
  como causa el meta viewport, algún `transform: scale()` a nivel de contenedor general,
  y problemas de `visualViewport` (ninguno estaba presente). Se encontró como causa
  secundaria real (distinta, no sustituta) el uso de `100vh`/`height: 100%` en vez de
  `100dvh` en Login/LockScreen, causando un salto de layout al abrir el teclado —
  corregido de paso. **Decisión final, consciente:** bloquear el zoom manual del usuario
  (`user-scalable=no`, `maximum-scale=1`) para poder mantener los tamaños de fuente
  compactos sin agrandar nada — se evaluó y aceptó el costo de accesibilidad que esto
  implica (afecta a quien dependa del pinch-zoom para leer, ej. baja visión). No existe
  una alternativa de CSS/JS que evite el zoom automático de WebKit sin bloquear el zoom
  manual o sin agrandar los inputs — es una restricción fija de la plataforma, confirmada
  con investigación, no un bug propio. Confirmado funcionando y con la densidad visual
  compacta original intacta.

- **[Fase 2] Visualización en ambas monedas — Ahorros.** Rediseñado con moneda fija por
  cuenta (no por activo individual, para no sumar campos ni ancho horizontal en mobile):
  al crear una cuenta, se elige su moneda nativa (ARS o USD), no editable después. El
  cálculo de P&L se hace siempre en la moneda nativa de la cuenta, sin conversión — esto
  evita de raíz el problema de "P&L fantasma por movimiento de tipo de cambio" que se
  identificó al diseñar esto (convertir el costo de compra con la cotización de hoy en
  vez de la de cuando se compró distorsiona el resultado). La columna de valor en la
  moneda contraria sigue usando la cotización de hoy, que es correcta para ese caso
  porque se pregunta "cuánto vale ahora". Labels de columnas dinámicos según la moneda de
  cada cuenta. El toggle ARS/USD ya agregado en Evolución Mensual se mantiene. Se intentó
  primero una versión con moneda + fecha de compra por activo individual, pero se revirtió
  por no tener lógica de cálculo conectada todavía (agregaba ancho en mobile sin ningún
  beneficio funcional) — la versión por cuenta resultó más simple y evita ese problema.
  Confirmado funcionando en producción, incluido el export a Excel con cuentas de moneda
  mixta.

- **Export a Excel (Fase A, botón manual).** Dos solapas (Tarjetas y Ahorros), cada una
  con tabla de resumen, tabla de evolución mensual, y gráfico de línea nativo con colores
  por tarjeta/cuenta. En Ahorros, además, dos gráficos de torta nativos (por tipo y por
  cuenta, con nombre y porcentaje como etiqueta). Checkbox de detalle completo,
  independiente por solapa. Backend en Python (openpyxl) vía función serverless de
  Vercel — probado en un preview deploy, no local, por una incompatibilidad entre
  Windows, la herramienta uv y Python 3.14 en el entorno del usuario (resuelta bajando
  a Python 3.12 para uso local; la función en sí corre sin problema en Linux, vía Vercel).
  Ajustes de pulido: ejes con delete=False explícito (una diferencia de comportamiento
  entre openpyxl y Excel real), formato de miles, ancho de columna automático, contorno
  para distinguir colores similares en el gráfico de cuentas. Confirmado funcionando en
  Excel real, con datos reales, mergeado a producción.

- **Densidad de UI mobile.** Reducida entre 15% y 20% en fuentes, paddings y márgenes del
  breakpoint mobile (~640px), sin tocar initial-scale ni user-scalable — el zoom
  manual del usuario sigue intacto. Objetivo logrado: se ve como con zoom manual reducido,
  pero a zoom 100% real. Probado, confirmado, commiteado y pusheado.

- **Desbloqueo biométrico (Face ID/Touch ID) + PIN.** Implementado como capa extra sobre
  la sesión OTP: el setup ofrece Face ID y PIN por igual, con un cartel aclaratorio antes
  de activar biometría (el diálogo nativo de confirmación en cada uso es una restricción
  intencional de WebAuthn, no un bug — no se puede evitar). El prompt de configuración
  reaparece en cada login OTP nuevo, para poder cambiar de método, pero no resetea el
  método ya elegido si se reconfirma el mismo.

- **Alcance de Resumen vs. Evolución Mensual (aclaración, no cambio).** "Resumen" es una
  foto del momento actual, sin filas por mes — a propósito. La tabla de "Evolución
  Mensual" sí muestra múltiples meses (una fila por mes, una columna por cuenta), igual
  que el gráfico correspondiente.

- **Ajuste mobile — Resumen general de ahorros.** Se sacó la palabra "Subtotal" de las
  filas de subtotal (queda solo el nombre, ej. "Balanz" en vez de "Subtotal Balanz") —
  ya se distinguían por negrita/color, la palabra de más generaba un renglón extra
  innecesario en mobile.

- **Limpieza de código post-sesión.** Se sacaron variables sin uso en AhorrosView.jsx
  (usaBolsa/usaCripto/usaUsdt), se confirmó que no quedaron residuos de los intentos
  revertidos (scale de zoom, fecha_compra/moneda_compra por activo), y se renombraron los
  specs desactualizados con prefijo HISTORIAL_ para dejar claro que no reflejan el estado
  actual (ver "Dónde está todo"). Todos los datos de prueba en Supabase se vaciaron —
  nunca se cargaron datos reales, la base quedó lista para empezar de cero.

## Decisiones ya tomadas (para no repreguntar)

- Categorías de ahorro: son cuentas dinámicas, mismo patrón que Tarjetas — no un toggle
  fijo de categorías.
- Borrado de cuentas de ahorro y de tarjetas: ambos son borrado definitivo con cascada
  (irreversible), con un diálogo de confirmación como única traba previa. Decisión
  consciente por simplicidad, no un descuido.
- Multiusuario: login por código OTP, no por magic link — el magic link no persiste la
  sesión en una PWA instalada de iOS.
- DMARC más estricto para el dominio de email: descartado por ahora. El sistema funciona
  igual; en iCloud a veces hay que revisar la carpeta de spam la primera vez.
- **Análisis de spread — no extender a brokers de acciones (Bullmarket, IOL, Balanz).**
  Se evaluó replicar el mismo análisis de Lemon/Binance/Buenbit para acciones, CEDEARs y
  ONs entre estos tres brokers, y se descartó por dos motivos independientes, cualquiera
  de los dos ya alcanza:
  1. **Motivo conceptual (el más fuerte):** las cripto exchanges tienen libros de
     precios independientes entre sí — por eso tiene sentido preguntarse si hay un spread
     sistemático entre ellos. Bullmarket, IOL y Balanz, en cambio, son todos
     intermediarios que enrutan al mismo mercado regulado (BYMA) — el precio de una
     acción, CEDEAR u ON en un instante dado debería ser esencialmente el mismo en los
     tres, salvo microsegundos de latencia. No hay una hipótesis económica razonable de
     "spread sistemático entre brokers" que valga la pena testear ahí — el resultado
     esperable de antemano es no rechazar H0, lo cual no justifica el esfuerzo de
     recolección.
  2. **Motivo práctico:** de los tres, solo IOL tiene una API pública y documentada
     (developers.invertironline.com, con autenticación OAuth vía cuenta propia). Balanz y
     Bullmarket no publican ninguna — conseguir sus precios requeriría scrapear sus
     portales autenticados (clientes.balanz.com, plataforma de Bullmarket), lo cual es
     fràgil (rompe con cualquier cambio de frontend) y cae en zona gris de sus términos de
     uso. Ni siquiera con el motivo conceptual resuelto a favor, sería el mismo nivel de
     esfuerzo que el polling de cripto.
  Si en el futuro surge una razón concreta para dudar de la paridad de precios entre
  estos tres brokers (por ejemplo, una demora de actualización notoria en la práctica),
  vale la pena revisar esta decisión — pero el análisis de spread sistemático no aplica
  de la misma forma que en cripto.
- **Conexión directa con cuentas bancarias/brokers del usuario — descartada (10/2026).**
  Se evaluó como alternativa a la importación de resúmenes (pendiente 10) y se descartó:
  1. **Seguridad:** sin una API oficial con autorización delegada (OAuth), conectar
     implica guardar usuario y contraseña del home banking/broker de cada usuario — un
     riesgo enorme (si se filtra la base, se filtran accesos a cuentas reales), suele
     violar los términos de uso del banco, y se rompe con 2FA/captchas.
  2. **Regulatorio:** en Argentina todavía no hay un esquema de Open Finance operativo
     (el BCRA lo está preparando, con horizonte 2027 según la prensa); cuando exista,
     el acceso sería para entidades reguladas, no para una app personal.
  3. **Única excepción técnica:** IOL tiene API oficial con OAuth, pero cubre un solo
     broker — no justifica el esfuerzo frente a la importación de archivos.
  Revisar si el Open Finance del BCRA termina habilitando acceso para apps de terceros.

## Dónde está todo

- Repo privado en GitHub, con deploy automático en Vercel en cada push a master.
- Historial de specs y addendums de cada etapa, guardados en la raíz del proyecto local
  (no reflejan el estado actual del código, son registro de cómo se llegó hasta acá):
  HISTORIAL_spec_inicial.md, HISTORIAL_addendum_generalizacion.md,
  HISTORIAL_addendum_multiusuario_v2.md, FEATURE_gastos_recurrentes.md,
  FEATURE_export_excel.md, GUIA_keep_alive.md, PLAYBOOK_proyectos_react_supabase.md.
- Spec ya implementado (importación de resúmenes): FEATURE_importacion_resumenes.md;
  versión anterior solo de tenencia: HISTORIAL_importacion_tenencia.md.
- Spec ya implementado, queda como referencia: FEATURE_usdt_interes_compuesto.md.
- Guía procedural vigente (sí refleja el proceso actual): GUIA_deploy_vercel.md.
- Guía de uso para cargar datos correctamente: GUIA_DE_USO.md.
- Polling de spread cripto (Lemon/Binance P2P/Buenbit): `polling_spread_cripto.py`,
  `setup_tarea_windows.bat`, `analizar_spread_cripto.py`.
