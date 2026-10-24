// Indicador de datos desactualizados: valores cargados a mano que, si quedan
// viejos, distorsionan los totales sin que se note. Cada campo tiene su
// <campo>_at en la base (lo mantiene un trigger: ver supabase_desactualizados.sql).
// Umbrales en un solo lugar.

export const UMBRAL_DIAS = {
  precio: 7, // precio actual de activos de Bolsa y Cripto
  cotizacion: 7, // cotización de cada tarjeta, CCL/MEP y USDT
  tna: 30, // TNA de USD/Stable y de Pesos Líquidos
};

const MS_DIA = 24 * 60 * 60 * 1000;

// Días completos desde `at` hasta `ahora`.
export function diasDesde(at, ahora = new Date()) {
  return Math.floor((ahora.getTime() - new Date(at).getTime()) / MS_DIA);
}

// Estado del dato para el punto ámbar, o null si está al día.
// - sinFila: no hay fila guardada (tarjeta o usuario sin cotización): se está
//   usando un valor por defecto.
// - valor 0/null en precios y cotizaciones: "Sin cargar" (la TNA en 0 puede ser
//   real y no se marca).
// - pasado el umbral (días completos ≥ umbral): "Sin actualizar hace X días",
//   el único caso que se puede confirmar con "Sigue igual".
export function estadoDato({ tipo, valor, at, sinFila = false, valorDefecto, fmt = String }, ahora = new Date()) {
  if (sinFila) {
    return { motivo: "sin-fila", texto: `Todavía no la cargaste: se está usando ${fmt(valorDefecto)} por defecto` };
  }
  if (tipo !== "tna" && (valor === null || valor === undefined || valor === "" || Number(valor) === 0)) {
    return { motivo: "sin-cargar", texto: "Sin cargar" };
  }
  if (!at) return null;
  const dias = diasDesde(at, ahora);
  if (dias < UMBRAL_DIAS[tipo]) return null;
  return { motivo: "viejo", dias, texto: `Sin actualizar hace ${dias} días` };
}

// Marca de "actualizado ahora" para el estado local (la base la pone el trigger).
export const ahoraISO = () => new Date().toISOString();
