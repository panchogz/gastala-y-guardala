// Importación de resúmenes vía chat de IA externo — tenencia (Etapa 1) y
// tarjeta (Etapa 2). Ver FEATURE_importacion_resumenes.md. El usuario copia
// el prompt de abajo, lo usa en el chat de IA que ya tenga (junto con su
// PDF/foto) y pega la respuesta en ImportarResumenModal. Acá solo vive lo
// que no depende de la UI: el texto del prompt y la extracción/validación
// del JSON pegado.
import { parseNumeroFlexible } from "./helpers.js";

const PROMPT_HEADER = `Vas a extraer datos de un resumen financiero argentino que te adjunto (PDF o fotos).
Reglas:
- Devolvé SOLO un bloque de código JSON, sin texto antes ni después.
- Usá exactamente la estructura de abajo. Si un dato no figura, poné null; no inventes.
- Números como número JSON con punto decimal (1.234,56 → 1234.56). Sin símbolos.
- Fechas en formato YYYY-MM-DD.
- No incluyas números de tarjeta o cuenta, DNI/CUIT, nombres ni domicilios.`;

export const PROMPT_TENENCIA = `${PROMPT_HEADER}

Es un resumen de tenencia de un broker o exchange. Incluí solo posiciones (acciones,
CEDEARs, bonos, ONs, FCI, cripto). Excluí totales, saldo disponible en pesos o dólares, y
movimientos.
Bonos y ONs: si el precio está expresado cada 100 nominales, dividilo por 100 (tanto
precio_compra como precio_actual) para que cantidad × precio_actual = valor_total.

{
  "tipo": "tenencia",
  "fecha_documento": "YYYY-MM-DD o null",
  "activos": [
    {
      "ticker": "ej. AAPL, GGAL, AL30, BTC",
      "cantidad": 0,
      "moneda": "ARS o USD (moneda de los precios de esta fila) o null",
      "precio_compra": "precio promedio de compra o null",
      "precio_actual": "precio actual o null",
      "valor_total": "valor total de la posición o null"
    }
  ]
}`;

export const PROMPT_TARJETA = `${PROMPT_HEADER}

Es un resumen de tarjeta de crédito. Incluí solo consumos. Excluí pagos, saldo anterior,
intereses, impuestos (IVA, percepciones, sellos), comisiones y totales.

{
  "tipo": "tarjeta",
  "fecha_cierre": "YYYY-MM-DD",
  "consumos": [
    {
      "fecha_compra": "YYYY-MM-DD o null",
      "comercio": "texto",
      "moneda": "ARS o USD",
      "monto_cuota": "monto cobrado en ESTE resumen",
      "cuota_actual": "número (1 si es en un pago)",
      "cuotas_total": "número (1 si es en un pago)",
      "es_suscripcion": "true si es un servicio recurrente (streaming, apps, gimnasio, etc.), si no false"
    }
  ]
}`;

const SIN_RESULTADO =
  "No se encontró un resultado válido. Asegurate de copiar la respuesta completa del chat.";

// 1) bloque ```json ... ``` (o ``` ... ```) si hay uno; si no, desde el
// primer "{" hasta el último "}". JSON.parse sobre eso.
export function extraerJson(texto) {
  if (!texto || !texto.trim()) throw new Error(SIN_RESULTADO);

  const bloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidato = bloque ? bloque[1] : null;
  if (!candidato) {
    const inicio = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    if (inicio !== -1 && fin > inicio) candidato = texto.slice(inicio, fin + 1);
  }
  if (!candidato) throw new Error(SIN_RESULTADO);

  try {
    return JSON.parse(candidato);
  } catch {
    throw new Error(SIN_RESULTADO);
  }
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const fechaOnull = (f) => (typeof f === "string" && FECHA_RE.test(f) ? f : null);

// Valida la forma general y descarta filas inválidas en vez de rechazar todo
// el JSON. Lo que es específico de la cuenta destino (moneda, duplicados,
// consistencia precio/valor_total) se resuelve en la revisión, no acá.
export function validarTenencia(json) {
  if (!json || typeof json !== "object" || json.tipo !== "tenencia") {
    const otro = json?.tipo === "tarjeta" ? "tarjeta" : "otro tipo";
    throw new Error(`Esta respuesta es de un resumen de ${otro}, no de tenencia.`);
  }
  if (!Array.isArray(json.activos)) {
    throw new Error("El JSON no tiene el formato esperado (falta la lista de activos).");
  }

  let descartadas = 0;
  const activos = [];
  for (const a of json.activos) {
    if (!a || typeof a !== "object") {
      descartadas++;
      continue;
    }
    const ticker = typeof a.ticker === "string" ? a.ticker.trim() : "";
    const cantidad = parseNumeroFlexible(a.cantidad);
    if (!ticker || cantidad === null || cantidad <= 0) {
      descartadas++;
      continue;
    }
    const moneda = a.moneda === "ARS" || a.moneda === "USD" ? a.moneda : null;
    activos.push({
      ticker,
      cantidad,
      moneda,
      precio_compra: parseNumeroFlexible(a.precio_compra),
      precio_actual: parseNumeroFlexible(a.precio_actual),
      valor_total: parseNumeroFlexible(a.valor_total),
    });
  }

  return { fecha_documento: fechaOnull(json.fecha_documento), activos, descartadas };
}

// Misma idea que validarTenencia: valida la forma general y descarta
// consumos inválidos contando cuántos. moneda sin "USD" literal se asume
// ARS (coincide con el default de la cuenta en pesos, mayoría de los
// casos). cuota_actual/cuotas_total se normalizan a enteros ≥1 y
// cuota_actual nunca mayor a cuotas_total. Agrupar por tipo de gasto
// (cuotas en curso / un pago / dólares / suscripción) y calcular fecha/monto
// es cosa de la revisión en el modal, que conoce la tarjeta destino.
export function validarTarjeta(json) {
  if (!json || typeof json !== "object" || json.tipo !== "tarjeta") {
    const otro = json?.tipo === "tenencia" ? "tenencia" : "otro tipo";
    throw new Error(`Esta respuesta es de un resumen de ${otro}, no de tarjeta.`);
  }
  if (!Array.isArray(json.consumos)) {
    throw new Error("El JSON no tiene el formato esperado (falta la lista de consumos).");
  }
  const fecha_cierre = fechaOnull(json.fecha_cierre);
  if (!fecha_cierre) {
    throw new Error("El JSON no tiene una fecha de cierre válida (fecha_cierre).");
  }

  let descartadas = 0;
  const consumos = [];
  for (const c of json.consumos) {
    if (!c || typeof c !== "object") {
      descartadas++;
      continue;
    }
    const comercio = typeof c.comercio === "string" ? c.comercio.trim() : "";
    const monto_cuota = parseNumeroFlexible(c.monto_cuota);
    if (!comercio || monto_cuota === null || monto_cuota <= 0) {
      descartadas++;
      continue;
    }
    const moneda = c.moneda === "USD" ? "USD" : "ARS";
    const cuotaActualRaw = parseNumeroFlexible(c.cuota_actual);
    const cuotasTotalRaw = parseNumeroFlexible(c.cuotas_total);
    const cuotas_total = cuotasTotalRaw && cuotasTotalRaw >= 1 ? Math.round(cuotasTotalRaw) : 1;
    let cuota_actual = cuotaActualRaw && cuotaActualRaw >= 1 ? Math.round(cuotaActualRaw) : 1;
    if (cuota_actual > cuotas_total) cuota_actual = cuotas_total;
    consumos.push({
      fecha_compra: fechaOnull(c.fecha_compra),
      comercio,
      moneda,
      monto_cuota,
      cuota_actual,
      cuotas_total,
      es_suscripcion: c.es_suscripcion === true,
    });
  }

  return { fecha_cierre, consumos, descartadas };
}

// Resta n meses a una fecha ISO (YYYY-MM-DD) conservando el día del mes
// (clampeado al último día si el mes resultante es más corto). La revisión
// de compras en cuotas la usa para fecha = fecha_cierre − (cuota_actual−1)
// meses, de forma que fullMonthsBetween(fecha, hoy)+1 (CardPanel.jsx) dé la
// misma cuota_actual que informó el resumen.
export function restarMeses(fechaISO, n) {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDate();
  d.setDate(1); // evita que setMonth se "pase" de mes por overflow de día
  d.setMonth(d.getMonth() - n);
  const ultimoDiaDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDiaDelMes));
  return d.toISOString().slice(0, 10);
}
