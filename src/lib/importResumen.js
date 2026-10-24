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
total_consumos_ars / total_consumos_usd: el total de consumos del período que muestra el
resumen en cada moneda (solo consumos: sin pagos, impuestos, intereses ni saldo anterior),
o null si el resumen no lo muestra.

{
  "tipo": "tarjeta",
  "fecha_cierre": "YYYY-MM-DD",
  "total_consumos_ars": "número o null",
  "total_consumos_usd": "número o null",
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

// Fecha YYYY-MM-DD que además existe en el calendario (descarta 2026-02-30).
export function esFechaValida(f) {
  if (!fechaOnull(f)) return false;
  const [y, m, d] = f.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

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
  // fecha_cierre null o inválida ya no corta la importación: la revisión la
  // pide (campo obligatorio) antes de habilitar "Importar".
  const fecha_cierre = esFechaValida(json.fecha_cierre) ? json.fecha_cierre : null;
  const totalOnull = (v) => {
    const n = parseNumeroFlexible(v);
    return n !== null && n > 0 ? n : null;
  };

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

  return {
    fecha_cierre,
    total_consumos_ars: totalOnull(json.total_consumos_ars),
    total_consumos_usd: totalOnull(json.total_consumos_usd),
    consumos,
    descartadas,
  };
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

// ---------------------------------------------------------------------------
// Revisión de un resumen de tarjeta (Etapa 2). Funciones puras: el modal solo
// muestra lo que devuelven. Ver FEATURE_importacion_resumenes.md.
//
// Una fila de revisión guarda los datos base del consumo y el grupo destino:
// cuotas_curso | un_pago | dolares | recurrentes. La fecha no se guarda
// calculada: sale de fechaDeFila(fila, fechaCierre), así se recalcula en vivo
// si el usuario corrige la fecha de cierre (salvo que la haya editado a mano,
// fechaManual). El dedupe de suscripciones tampoco se guarda: lo calcula
// dedupeSuscripciones() en cada render, así que mover filas lo reevalúa solo.
// ---------------------------------------------------------------------------

const norm = (t) => String(t || "").trim().toLowerCase();

// true si ya existe una fila con el mismo nombre (comercio/concepto, trim +
// case-insensitive) y el mismo monto (±1 centavo, por redondeos).
function existeDuplicado(lista, campo, nombre, monto) {
  const n = norm(nombre);
  return (lista || []).some(
    (r) => norm(r[campo]) === n && Math.abs((Number(r.monto) || 0) - (Number(monto) || 0)) < 0.01
  );
}

// Fecha de cierre sugerida cuando el resumen no la trae: la compra más reciente.
export function fechaCierreSugerida(consumos) {
  const fechas = consumos.map((c) => c.fecha_compra).filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1] : "";
}

// Aplica todo lo que depende del grupo destino: tildado por defecto, notas y
// chequeo de duplicados contra lo ya cargado en la tarjeta. Se usa al armar las
// filas y al moverlas entre Un pago y Suscripciones.
function aplicarGrupo(fila, grupo, existingRows) {
  const ex = existingRows || {};
  const notasInfo = [];
  let notaWarn = null;
  let checked = true;
  if (grupo === "recurrentes") {
    if (existeDuplicado(ex.recurrentes, "concepto", fila.comercio, fila.monto)) {
      notaWarn = `Ya existe una suscripción "${fila.comercio}" con ese monto`;
      checked = false;
    }
  } else if (grupo === "dolares") {
    if (fila.esSuscripcionUsd) {
      notasInfo.push("Suscripción en USD: se importa como gasto en dólares (no hay recurrentes en esa moneda)");
    }
    if (existeDuplicado(ex.dolares, "comercio", fila.comercio, fila.monto)) {
      notaWarn = `Ya existe un gasto en dólares "${fila.comercio}" con ese monto`;
      checked = false;
    }
  } else if (grupo === "cuotas_curso") {
    if (fila.fecha_compra) notasInfo.push(`Compra original: ${fila.fecha_compra}`);
    if (fila.cuota_actual === fila.cuotas_total) notasInfo.push("Última cuota");
    if (existeDuplicado(ex.cuotas, "comercio", fila.comercio, fila.monto)) {
      notaWarn = `Ya existe una compra "${fila.comercio}" con ese monto`;
      checked = false;
    }
  } else {
    // un_pago: viene destildada (ya está en el resumen que se está mirando).
    checked = false;
    notasInfo.push("Ya están en este resumen; importalo solo si todavía no lo pagaste");
    if (existeDuplicado(ex.cuotas, "comercio", fila.comercio, fila.monto)) {
      notaWarn = `Ya existe una compra "${fila.comercio}" con ese monto`;
    }
  }
  return {
    ...fila,
    grupo,
    checked,
    cuotas: grupo === "cuotas_curso" ? fila.cuotas_total : 1,
    notasInfo,
    notaWarn,
    color: notaWarn ? "yellow" : null,
  };
}

// Reparte los consumos del resumen en los 4 grupos de revisión.
export function construirFilasTarjeta(consumos, existingRows) {
  return consumos.map((c, i) => {
    let grupo;
    if (c.es_suscripcion && c.moneda !== "USD") grupo = "recurrentes";
    else if (c.moneda === "USD") grupo = "dolares";
    else if (c.cuotas_total > 1) grupo = "cuotas_curso";
    else grupo = "un_pago";
    const base = {
      key: `c${i}`,
      orden: i,
      comercio: c.comercio,
      moneda: c.moneda,
      // En cuotas se carga el monto TOTAL de la compra (cuota × cantidad).
      monto: grupo === "cuotas_curso" ? c.monto_cuota * c.cuotas_total : c.monto_cuota,
      cuota_actual: c.cuota_actual,
      cuotas_total: c.cuotas_total,
      fecha_compra: c.fecha_compra,
      fechaManual: null,
      esSuscripcionUsd: c.es_suscripcion && c.moneda === "USD",
    };
    return aplicarGrupo(base, grupo, existingRows);
  });
}

// Fecha efectiva de una fila con la fecha de cierre actual. Cuotas: fecha tal
// que la cuota actual de la app coincida con la del resumen (cierre − (cuota
// actual − 1) meses). Un pago / dólares: la de compra o, si no hay, la de cierre.
export function fechaDeFila(fila, fechaCierre) {
  if (fila.fechaManual) return fila.fechaManual;
  const cierre = esFechaValida(fechaCierre) ? fechaCierre : null;
  if (fila.grupo === "recurrentes") return null;
  if (fila.grupo === "cuotas_curso") return cierre ? restarMeses(cierre, fila.cuota_actual - 1) : null;
  return fila.fecha_compra ?? cierre;
}

// Dedupe de suscripciones dentro del mismo resumen: agrupa las filas de
// Suscripciones por comercio normalizado; queda visible una principal por grupo
// (la de fecha de compra más reciente; sin fechas, la última del resumen) con
// una nota, y el resto queda oculto y no se importa.
// Devuelve { ocultas: Set<key>, notas: Map<key, texto>, miembros: Map<key, key[]> }.
export function dedupeSuscripciones(filas) {
  const grupos = new Map();
  for (const f of filas) {
    if (f.grupo !== "recurrentes") continue;
    const k = norm(f.comercio);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  }
  const ocultas = new Set();
  const notas = new Map();
  const miembros = new Map();
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const principal = [...lista].sort(
      (a, b) => (a.fecha_compra || "").localeCompare(b.fecha_compra || "") || a.orden - b.orden
    )[lista.length - 1];
    const mismoMonto = lista.every((f) => Math.abs((Number(f.monto) || 0) - (Number(principal.monto) || 0)) < 0.01);
    notas.set(
      principal.key,
      mismoMonto
        ? `Aparece ${lista.length} veces en el resumen`
        : "Monto cambió en el período: se usa el último"
    );
    miembros.set(principal.key, lista.map((f) => f.key));
    for (const f of lista) if (f !== principal) ocultas.add(f.key);
  }
  return { ocultas, notas, miembros };
}

// Mueve una fila entre Un pago y Suscripciones (solo ARS). Si es la principal
// de una suscripción repetida y va a Un pago, se mueve el grupo completo: cada
// ocurrencia queda como fila propia (en un pago son cobros distintos).
export function moverFila(filas, key, existingRows) {
  const fila = filas.find((f) => f.key === key);
  if (!fila || fila.moneda === "USD") return filas;
  const destino = fila.grupo === "recurrentes" ? "un_pago" : fila.grupo === "un_pago" ? "recurrentes" : null;
  if (!destino) return filas;
  const aMover = new Set(
    destino === "un_pago" ? dedupeSuscripciones(filas).miembros.get(key) || [key] : [key]
  );
  return filas.map((f) => (aMover.has(f.key) ? aplicarGrupo(f, destino, existingRows) : f));
}

// Filas tildadas y no ocultas por el dedupe, ya con fecha y listas para insertar.
export function filasAImportar(filas, fechaCierre) {
  const { ocultas } = dedupeSuscripciones(filas);
  const sel = filas.filter((f) => f.checked && !ocultas.has(f.key));
  return {
    cuotas: sel
      .filter((f) => f.grupo === "cuotas_curso" || f.grupo === "un_pago")
      .map((f) => ({
        fecha: fechaDeFila(f, fechaCierre),
        comercio: f.comercio,
        monto: Number(f.monto) || 0,
        cuotas: Number(f.cuotas) || 1,
      })),
    dolares: sel
      .filter((f) => f.grupo === "dolares")
      .map((f) => ({ fecha: fechaDeFila(f, fechaCierre), comercio: f.comercio, monto: Number(f.monto) || 0 })),
    recurrentes: sel
      .filter((f) => f.grupo === "recurrentes")
      .map((f) => ({ concepto: f.comercio, monto: Number(f.monto) || 0, activo: true })),
  };
}

// Compara, por moneda, la suma de monto_cuota de TODOS los consumos leídos
// (tildados o no, antes del dedupe) contra el total que informa el resumen.
// Devuelve un aviso por moneda con diferencia > 1%; total null → nada.
export function avisosTotal(consumos, totales) {
  const avisos = [];
  for (const [moneda, total] of [
    ["ARS", totales.total_consumos_ars],
    ["USD", totales.total_consumos_usd],
  ]) {
    if (!total) continue;
    const leido = consumos.filter((c) => c.moneda === moneda).reduce((a, c) => a + c.monto_cuota, 0);
    if (Math.abs(leido - total) / total > 0.01) avisos.push({ moneda, leido, total });
  }
  return avisos;
}
