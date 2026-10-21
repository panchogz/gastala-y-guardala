// Importación de resúmenes vía chat de IA externo — Etapa 1 (tenencia).
// Ver FEATURE_importacion_resumenes.md. El usuario copia el prompt de abajo,
// lo usa en el chat de IA que ya tenga (junto con su PDF/foto) y pega la
// respuesta en ImportarResumenModal. Acá solo vive lo que no depende de la
// UI: el texto del prompt y la extracción/validación del JSON pegado.
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
