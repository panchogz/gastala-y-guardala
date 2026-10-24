# Guía de uso — Gastala y Guardala

Instrucciones y consideraciones para vos (o cualquier otro usuario) al cargar datos,
pensadas para que los números que ves reflejen la realidad y no una distorsión de cómo
se calculan.

## Tarjetas

- **Compras en cuotas:** cargá el monto total de la compra (no el valor de cada cuota),
  la app calcula sola cuánto pagaste y cuánto te falta según la fecha.
- **Gastos en dólares:** se cargan en dólares, y hoy se convierten a pesos usando la
  cotización que vos mismo actualizás en el panel de cada tarjeta — no una cotización
  histórica del momento de la compra. Si no actualizás ese campo seguido, el monto en
  pesos que ves puede quedar desactualizado.
- **Suscripciones/recurrentes:** una vez cargadas, se suman automáticamente cada mes sin
  que tengas que volver a cargarlas — solo tocalas si cambia el monto o querés pausarlas.
- **"Total a pagar" suma pesos y dólares convertidos en un solo número.** Es a
  propósito: el saldo en dólares se paga con dólares comprados con el sueldo, así que
  es un gasto en pesos más. Para que el número sea fiel, cargá en la cotización de la
  tarjeta el precio al que comprás los dólares. El "% del salario" se calcula contra
  ese total completo, con un único salario neto que se carga arriba de las tarjetas:
  cada tarjeta muestra su %, y la franja de arriba el total de todas las tarjetas.
- **Gráfico y tabla de Total mensual:** el gráfico muestra una ventana fija de meses
  calendario: los 2 meses anteriores, el actual y los 3 próximos (punteados, lo ya
  comprometido). El mes actual se calcula en vivo; un mes que no registraste queda como
  hueco, la línea no se une. La tabla de la app muestra los últimos 12 meses registrados,
  con "Total 12 meses" (suma solo esas filas). Las filas "Comprometido" van aparte, en
  gris, y no entran en ningún total. El Excel trae toda la historia, y también las filas
  "Comprometido" fuera de los totales.

## Ahorros

- **Cuentas:** cada cuenta que creás (Balanz, Binance, Lemon, etc.) tiene un tipo fijo
  (Bolsa, Cripto, USD/Stable o Pesos) **y una moneda fija** (ARS o USD), ambos elegidos al
  crearla y no editables después — si te equivocás, hay que borrar la cuenta y crearla de
  nuevo (esto borra los activos cargados en ella, revisá antes de borrar).
- **La moneda es por cuenta, no por activo individual.** Todos los activos que cargues
  dentro de una misma cuenta comparten su moneda — por ejemplo, si creaste "Balanz" en
  USD, todos los tickers que cargues ahí van a pedirte precio de compra y precio actual
  en dólares, sin importar que sea Bolsa. Las columnas de la tabla muestran la moneda
  correspondiente en el encabezado, así que no hay que adivinar.
- **Precio de compra y precio actual:** son los dos datos que más impactan el cálculo de
  P&L (ganancia o pérdida) — cargalos con cuidado, un error ahí se propaga a todos los
  totales y gráficos. Se calculan siempre en la moneda nativa de la cuenta, sin conversión
  — así se evita que el P&L quede distorsionado por el movimiento del dólar en el medio
  (ver el recuadro de abajo).
- **La columna de "Valor en la otra moneda"** sí convierte usando la cotización de hoy —
  eso es correcto, porque responde "cuánto vale esto ahora", una pregunta que se contesta
  con la tasa actual. Lo que la app no hace (a propósito) es convertir el costo de compra
  a la otra moneda, porque ahí sí haría falta la cotización de cuando compraste, no la de
  hoy — ver el próximo punto.

> **Por qué el P&L no se convierte entre monedas.** Si convertís manualmente "a mano" un
> costo de compra viejo usando el dólar de hoy, el número te va a quedar inflado o
> deflactado según cuánto se movió el dólar desde entonces — no representa lo que
> realmente pagaste. Por eso la app calcula la ganancia/pérdida siempre en la moneda
> original de la compra, sin mezclar.

- **Gráfico y tabla de Evolución mensual:** el gráfico muestra una ventana fija de 6 meses
  calendario (los 5 anteriores y el actual), sin proyección. El mes actual se calcula en
  vivo; un mes sin foto guardada queda como hueco. La tabla de la app muestra los últimos
  12 meses con foto; el Excel trae toda la historia.

## USD/Stable y Pesos Líquidos — interés compuesto con TNA

Estas dos secciones (USDT/Lemon/Binance en dólares, y cajas remuneradas en pesos) usan el
mismo mecanismo: en vez de que vos calcules el rendimiento a mano, la app lo hace sola,
componiendo día a día.

**Cómo cargar:**
- **Saldo aportado:** el campo siempre muestra tu saldo actual (capital + interés ya
  ganado) — no un campo que se vacía después de usarlo. Para agregar plata nueva, editá
  ese mismo campo y poné el monto total que corresponde ahora (saldo viejo + lo nuevo que
  metiste), no solo lo que agregaste.
- **TNA (Tasa Nominal Anual):** la tasa que te muestra el banco/billetera — cargala tal
  cual la ves ahí, sin convertir nada vos mismo. La app asume capitalización diaria, que
  es como funcionan la gran mayoría de estos productos en Argentina.
- **Sos vos quien actualiza la tasa cuando cambia** — la app no tiene forma de enterarse
  sola de que Lemon o tu banco bajaron o subieron el rendimiento. Si te avisan un cambio,
  entrá y editá el campo de TNA apenas te enteres, para que el cálculo sea preciso desde
  ese momento.

**Cómo se calcula, por si te interesa el detalle:**
No hay ningún proceso corriendo en segundo plano ni una carga periódica — el cálculo es
**en vivo**, cada vez que abrís o refrescás la pantalla. La app mira cuántos días pasaron
desde la última vez que se "cerró" el cálculo, y aplica la fórmula de interés compuesto
diario con la TNA vigente. El "Saldo actual" que ves siempre está al día (literalmente,
actualizado al día — no calcula intradiario, solo por días completos).

**Qué pasa cuando agregás plata o cambiás la tasa:** la app "cierra" el cálculo hasta ese
momento (todo el interés generado hasta ahí queda incorporado al capital) y arranca de
cero desde ese instante con el capital nuevo. Nada de lo que ya pasó se recalcula — el
interés de ahí en adelante compone sobre el total nuevo (capital viejo + interés ya
ganado + lo que agregaste), nunca se pierde ni se reinicia lo acumulado.

## USDT / Dólares cripto — cotización de referencia (en revisión aparte)

Distinto al punto anterior (que es sobre el rendimiento), esto es sobre **la cotización
del dólar que usás para convertir a pesos**. Al cargar un activo de tipo USDT, el campo
"Cotización USDT" lo completás vos a mano — pero el número de referencia que copiás
**no necesariamente coincide con el precio real** al que operás en tu plataforma puntual
(Lemon, Binance, etc.), porque exchanges distintos tienen su propio margen (spread) sobre
la cotización de referencia.

**Qué significa esto en la práctica:** si necesitás precisión en un monto puntual, revisá
y corregí manualmente la cotización antes de confiar en el número — no asumas que el
valor de referencia es exacto al centavo.

### Resultado del análisis (cerrado — 17 de agosto de 2026)

El polling (tarea de Windows "SpreadPolling", ya dada de baja) corrió cada 3 horas del 8
al 16 de agosto de 2026, y juntó 126 mediciones (63 independientes por exchange) contra
la cotización de referencia del día. A diferencia del primer chequeo puntual (que
comparaba un solo dato contra una serie histórica — pseudo-replicación, no válido
estadísticamente), estas sí son observaciones independientes en el tiempo.

**Test de hipótesis (por exchange, t-test de una muestra contra 0):**

H0: el spread promedio respecto a la referencia es 0% (sin diferencia sistemática).
H1: el spread promedio es distinto de 0%. Nivel de significancia α = 0.05, test a dos
colas.

| Exchange     | n  | gl | Media  | Desvío est. | Error est. | IC 95%              | t       | p-valor    | Decisión        |
|--------------|----|----|--------|-------------|------------|----------------------|---------|------------|-----------------|
| Binance P2P  | 63 | 62 | +0.156%| 0.175%      | 0.022%     | [0.112%, 0.200%]     | 7.07    | 1.6×10⁻⁹   | Se rechaza H0   |
| Lemon        | 63 | 62 | -1.386%| 0.261%      | 0.033%     | [-1.452%, -1.320%]   | -42.24  | 2.1×10⁻⁴⁷  | Se rechaza H0   |

En los dos casos el p-valor es muchísimo menor que α = 0.05, así que se rechaza H0: el
spread es estadísticamente distinto de cero, en ambos exchanges. El tamaño de efecto
(Cohen's d) es 0.89 en Binance P2P (efecto grande) y -5.32 en Lemon (efecto enorme) — no
es solo "significativo", es una diferencia grande en magnitud relativa a la variabilidad
de las mediciones.

**Chequeo de supuestos.** El test de Shapiro-Wilk sobre los residuos rechaza normalidad
estricta en ambos exchanges (Binance P2P: p < 0.001; Lemon: p = 0.038) — con n = 63 el
t-test sigue siendo razonablemente robusto por el teorema central del límite, pero como
verificación adicional se corrió también el test no paramétrico de Wilcoxon (signed-rank,
que no asume normalidad): Binance P2P p = 1.3×10⁻⁸, Lemon p = 5.1×10⁻¹². Misma
conclusión por las dos vías — se rechaza H0 en ambos casos.

Los dos números de spread terminaron bastante más chicos que la primera estimación
puntual (3.25% Lemon / 4.70% Binance P2P), que sobreestimaba por el problema metodológico
ya mencionado (pseudo-replicación).

**Nota de calidad de datos:** en Lemon, 18 de las 63 mediciones (~29%) llegaron con
exactamente el mismo precio que la medición anterior. No son repeticiones sueltas al
azar: son dos bloques largos y contiguos (uno de 6 mediciones / 12.6 horas, otro de 14
mediciones / 39 horas) donde ask y bid quedaron congelados de forma idéntica. No se pudo
determinar la causa con los datos disponibles — es compatible tanto con que Lemon
(exchange "normal", no P2P) simplemente no actualice su propio precio con esa frecuencia,
como con un problema de caché en la infraestructura de polling, y no corresponde afirmar
una u otra cosa sin evidencia adicional (por ejemplo, headers HTTP de esas requests
puntuales). En cualquier caso, esto reduce algo la independencia estricta que asume el
test (quedan 44 valores de precio distintos), pero no cambia la conclusión: el efecto es
tan grande (Cohen's d = -5.32) que sigue siendo significativo incluso en el escenario más
conservador de n=44.

**Qué hacer con esto en la práctica (sin cambios de código):** el campo "Cotización USDT"
se sigue completando a mano, como siempre — este análisis no dispara ningún
auto-completado. Como referencia rápida al cargar un activo: restale ~1.4% a la
cotización de referencia si vas a operar en Lemon, o usala casi tal cual si vas a operar
en Binance P2P.

## Regla general para toda la app

Ningún número que veas en Resumen, Evolución Mensual o los gráficos reemplaza tu propio
criterio si algo se ve raro — sobre todo mientras haya piezas del cálculo en revisión
(como la de arriba). Ante la duda, revisá el dato cargado en el origen (la fila de la
compra) antes de asumir que el total está mal.
