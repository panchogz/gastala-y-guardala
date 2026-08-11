import * as api from "../features/tarjetas/api.js";
import * as ahorrosApi from "../features/ahorros/api.js";
import { fullMonthsBetween, currentMonthKey, todayISO } from "./helpers.js";

// El export no reusa el estado ya cargado en TarjetasView/CardPanel (queda
// repartido por tarjeta dentro de cada CardPanel, no centralizado) — vuelve a
// pedir los datos directo a la API para no tener que levantar ese estado por
// toda la jerarquía de componentes. Sigue sin tocar Supabase desde el backend:
// todo el armado del JSON pasa por acá, en el cliente ya autenticado.

async function buildCuotaDetalle(tarjetaId) {
  const rows = await api.fetchCuotas(tarjetaId);
  const today = new Date();
  return rows.map((r) => {
    const cuotaActual = Math.min(
      Number(r.cuotas) || 1,
      Math.max(1, fullMonthsBetween(r.fecha, today) + 1)
    );
    const cuotasPendientes = (Number(r.cuotas) || 1) - cuotaActual;
    const montoPorCuota = (Number(r.monto) || 0) / (Number(r.cuotas) || 1);
    const saldoPagado = montoPorCuota * cuotaActual;
    return {
      fecha: r.fecha,
      comercio: r.comercio || "",
      monto: Number(r.monto) || 0,
      cuotas: Number(r.cuotas) || 1,
      cuotaActual,
      cuotasPendientes,
      montoPorCuota,
      saldoPagado,
    };
  });
}

async function buildDolarDetalle(tarjetaId, cotizacion) {
  const rows = await api.fetchDolares(tarjetaId);
  return rows.map((r) => ({
    fecha: r.fecha,
    comercio: r.comercio || "",
    monto: Number(r.monto) || 0,
    montoARS: (Number(r.monto) || 0) * (Number(cotizacion) || 0),
  }));
}

async function buildRecurrenteDetalle(tarjetaId) {
  const rows = await api.fetchRecurrentes(tarjetaId);
  return rows.map((r) => ({
    concepto: r.concepto || "",
    monto: Number(r.monto) || 0,
    activo: !!r.activo,
  }));
}

export async function buildTarjetasExportPayload(incluirDetalleTarjetas) {
  const [tarjetasRows, monthlyRows] = await Promise.all([api.fetchTarjetas(), api.fetchMonthly()]);

  const tarjetas = await Promise.all(
    tarjetasRows.map(async (t) => {
      const base = { id: t.id, nombre: t.nombre, color: t.color, orden: Number(t.orden) || 0 };
      if (!incluirDetalleTarjetas) {
        return { ...base, cuotas: [], dolares: [], recurrentes: [] };
      }
      const cfg = await api.fetchConfig(t.id);
      const cotizacion = Number(cfg?.cotizacion) || 0;
      const [cuotas, dolares, recurrentes] = await Promise.all([
        buildCuotaDetalle(t.id),
        buildDolarDetalle(t.id, cotizacion),
        buildRecurrenteDetalle(t.id),
      ]);
      return { ...base, cuotas, dolares, recurrentes };
    })
  );

  const byMonth = {};
  for (const r of monthlyRows) {
    const key = r.mes.slice(0, 7);
    byMonth[key] ??= {};
    byMonth[key][r.tarjeta_id] = Number(r.total) || 0;
  }
  const totalMensual = Object.keys(byMonth)
    .sort()
    .map((mes) => {
      const porTarjeta = byMonth[mes];
      const total = Object.values(porTarjeta).reduce((a, v) => a + v, 0);
      return { mes, porTarjeta, total };
    });

  return { tarjetas, totalMensual, incluirDetalleTarjetas };
}

// ---------------------------------------------------------------------------
// Ahorros — misma idea que Tarjetas arriba: se pide todo de nuevo a la API en
// vez de reusar el estado de AhorrosView, y se replica acá la misma lógica de
// cálculo por tipo (bolsa/cripto/usdt) para que el resumen de 3 niveles del
// Excel quede idéntico al que se ve en la app.
// ---------------------------------------------------------------------------

const TIPO_ORDEN_AHORRO = { bolsa: 0, cripto: 1, usdt: 2, pesos: 3 };
const porTipoYNombreAhorro = (a, b) =>
  TIPO_ORDEN_AHORRO[a.tipo] - TIPO_ORDEN_AHORRO[b.tipo] || (a.nombre || "").localeCompare(b.nombre || "", "es");

function apiForTipoAhorro(tipo) {
  if (tipo === "bolsa") return ahorrosApi.bolsaApi;
  if (tipo === "cripto") return ahorrosApi.criptoApi;
  if (tipo === "pesos") return ahorrosApi.pesosApi;
  return ahorrosApi.usdtApi;
}

function activoLabel(cuenta, r) {
  return (cuenta.tipo === "bolsa" ? r.ticker : r.activo) || "—";
}

function computeBolsaAhorro(r, cuenta, cotizacion) {
  const cantidad = Number(r.cantidad) || 0;
  const precioCompra = Number(r.precio_compra) || 0;
  const precioActual = Number(r.precio_actual) || 0;
  const costoTotal = precioCompra ? cantidad * precioCompra : null;
  const valorActual = cantidad * precioActual;
  const pl = costoTotal !== null ? valorActual - costoTotal : null;
  const plPct = costoTotal ? pl / costoTotal : null;
  let usd, ars;
  if (cuenta.moneda === "USD") {
    usd = valorActual;
    ars = valorActual * (Number(cotizacion) || 0);
  } else {
    ars = valorActual;
    usd = cotizacion ? valorActual / Number(cotizacion) : 0;
  }
  return { cantidad, precioCompra, precioActual, valorActual, pl, plPct, usd, ars };
}

function computeCriptoAhorro(r, cuenta, cotizacionUsdt) {
  const cantidad = Number(r.cantidad) || 0;
  const precioCompra = Number(r.precio_compra) || 0;
  const precioActual = Number(r.precio_actual) || 0;
  const costoTotal = precioCompra ? cantidad * precioCompra : null;
  const valorActual = cantidad * precioActual;
  const pl = costoTotal !== null ? valorActual - costoTotal : null;
  const plPct = costoTotal ? pl / costoTotal : null;
  let usd, ars;
  if (cuenta.moneda === "ARS") {
    ars = valorActual;
    usd = cotizacionUsdt ? valorActual / Number(cotizacionUsdt) : 0;
  } else {
    usd = valorActual;
    ars = valorActual * (Number(cotizacionUsdt) || 0);
  }
  return { cantidad, precioCompra, precioActual, valorActual, pl, plPct, usd, ars };
}

function diasEntreAhorro(desdeISO, hastaISO) {
  if (!desdeISO) return 0;
  const ms = new Date(hastaISO) - new Date(desdeISO);
  return Math.max(0, Math.round(ms / 86400000));
}

// Mismo cálculo de interés compuesto diario que AhorrosView.jsx (ver ese
// archivo para el detalle): saldo_usd es el capital cerrado a
// fecha_ultimo_calculo, saldoActual lo capitaliza día a día hasta hoy.
function computeUsdtAhorro(r, cotizacionUsdt) {
  const saldoUsd = Number(r.saldo_usd) || 0;
  const tasaAnual = Number(r.tasa_anual) || 0;
  const dias = diasEntreAhorro(r.fecha_ultimo_calculo, todayISO());
  const saldoActual = saldoUsd * Math.pow(1 + tasaAnual / 100 / 365, dias);
  const rendimiento = saldoActual - saldoUsd;
  const ars = saldoActual * (Number(cotizacionUsdt) || 0);
  return { costoTotal: saldoUsd, valorActual: saldoActual, rendimiento, usd: saldoActual, ars };
}

// Mismo cálculo pero en ARS (caja de ahorro remunerada) — misma fórmula de
// interés compuesto diario, saldo_ars/tasa_tna en vez de saldo_usd/tasa_anual,
// convertido a USD con la cotización dólar (CCL/MEP) en vez de la de USDT.
function computePesosAhorro(r, cotizacion) {
  const saldoArs = Number(r.saldo_ars) || 0;
  const tasaTna = Number(r.tasa_tna) || 0;
  const dias = diasEntreAhorro(r.fecha_ultimo_calculo, todayISO());
  const saldoActual = saldoArs * Math.pow(1 + tasaTna / 100 / 365, dias);
  const rendimiento = saldoActual - saldoArs;
  const usd = cotizacion ? saldoActual / Number(cotizacion) : 0;
  return { costoTotal: saldoArs, valorActual: saldoActual, rendimiento, usd, ars: saldoActual };
}

function cuentaCompute(cuenta, rows, cotizacion, cotizacionUsdt) {
  const compute =
    cuenta.tipo === "bolsa"
      ? (r) => computeBolsaAhorro(r, cuenta, cotizacion)
      : cuenta.tipo === "cripto"
      ? (r) => computeCriptoAhorro(r, cuenta, cotizacionUsdt)
      : cuenta.tipo === "pesos"
      ? (r) => computePesosAhorro(r, cotizacion)
      : (r) => computeUsdtAhorro(r, cotizacionUsdt);
  const enriched = rows.map((r) => ({ ...r, ...compute(r) }));
  return {
    enriched,
    usd: enriched.reduce((a, r) => a + r.usd, 0),
    ars: enriched.reduce((a, r) => a + r.ars, 0),
  };
}

export async function buildAhorrosExportPayload(incluirDetalleAhorros) {
  const [cot, cuentasRows, evolucionRows] = await Promise.all([
    ahorrosApi.fetchCotizacion(),
    ahorrosApi.fetchCuentasAhorro(),
    ahorrosApi.fetchEvolucionCuentas(),
  ]);
  const cotizacion = Number(cot?.dolar_ccl_mep) || 1200;
  const cotizacionUsdt = Number(cot?.dolar_usdt) || 1200;

  const cuentasOrdenadas = [...cuentasRows].sort(porTipoYNombreAhorro);
  const activosPorCuenta = Object.fromEntries(
    await Promise.all(
      cuentasOrdenadas.map(async (c) => [c.id, await apiForTipoAhorro(c.tipo).fetchAll(c.id)])
    )
  );

  const cuentaTotales = Object.fromEntries(
    cuentasOrdenadas.map((c) => [
      c.id,
      cuentaCompute(c, activosPorCuenta[c.id] || [], cotizacion, cotizacionUsdt),
    ])
  );
  const totalUSD = Object.values(cuentaTotales).reduce((a, t) => a + t.usd, 0);
  const totalARS = Object.values(cuentaTotales).reduce((a, t) => a + t.ars, 0);

  const gruposPorTipo = ["bolsa", "cripto", "usdt", "pesos"]
    .map((tipo) => cuentasOrdenadas.filter((c) => c.tipo === tipo))
    .filter((lista) => lista.length > 0);

  const grupos = gruposPorTipo.map((lista) => {
    const subtotalUSD = lista.reduce((a, c) => a + cuentaTotales[c.id].usd, 0);
    const subtotalARS = lista.reduce((a, c) => a + cuentaTotales[c.id].ars, 0);
    return {
      tipo: lista[0].tipo,
      subtotalUSD,
      subtotalARS,
      pctTotal: totalUSD ? subtotalUSD / totalUSD : 0,
      cuentas: lista.map((c) => {
        const { enriched, usd, ars } = cuentaTotales[c.id];
        const activos = [...enriched]
          .map((a) => ({
            label: activoLabel(c, a),
            usd: a.usd,
            ars: a.ars,
            pctCuenta: usd ? a.usd / usd : 0,
            pctTotal: totalUSD ? a.usd / totalUSD : 0,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "es"));
        return {
          nombre: c.nombre,
          color: c.color,
          totalUSD: usd,
          totalARS: ars,
          pctTotal: totalUSD ? usd / totalUSD : 0,
          showSubtotal: lista.length > 1,
          activos,
        };
      }),
    };
  });

  const mesesEvolucion = [...new Set(evolucionRows.map((r) => r.mes))].sort();
  const cuentaIdsEnEvolucion = [...new Set(evolucionRows.map((r) => r.cuenta_id))];
  const evolucionMensual = mesesEvolucion.map((mes) => {
    const porCuenta = {};
    let total = 0;
    for (const id of cuentaIdsEnEvolucion) {
      const row = evolucionRows.find((r) => r.mes === mes && r.cuenta_id === id);
      if (row) {
        const val = Number(row.valor_usd) || 0;
        porCuenta[id] = val;
        total += val;
      }
    }
    return { mes: mes.slice(0, 7), porCuenta, total };
  });

  const cuentas = cuentasOrdenadas.map((c) => {
    const { enriched } = cuentaTotales[c.id];
    const activos = incluirDetalleAhorros
      ? [...enriched]
          .map((a) =>
            c.tipo === "usdt" || c.tipo === "pesos"
              ? {
                  label: activoLabel(c, a),
                  costoTotal: a.costoTotal,
                  valorActual: a.valorActual,
                  rendimiento: a.rendimiento,
                }
              : {
                  label: activoLabel(c, a),
                  cantidad: a.cantidad,
                  precioCompra: a.precioCompra,
                  precioActual: a.precioActual,
                  valorActual: a.valorActual,
                  pl: a.pl,
                  plPct: a.plPct,
                }
          )
          .sort((a, b) => a.label.localeCompare(b.label, "es"))
      : [];
    return { id: c.id, nombre: c.nombre, tipo: c.tipo, moneda: c.moneda, color: c.color, activos };
  });

  return {
    ahorros: { resumen: { grupos, totalUSD, totalARS }, evolucionMensual, cuentas },
    incluirDetalleAhorros: !!incluirDetalleAhorros,
  };
}

export async function downloadExport(incluirDetalleTarjetas, incluirDetalleAhorros) {
  const [tarjetasPayload, ahorrosPayload] = await Promise.all([
    buildTarjetasExportPayload(incluirDetalleTarjetas),
    buildAhorrosExportPayload(incluirDetalleAhorros),
  ]);
  const payload = { ...tarjetasPayload, ...ahorrosPayload };

  const res = await fetch("/api/export-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error || "";
    } catch {
      /* respuesta no era JSON, se ignora */
    }
    throw new Error(detail || `No se pudo generar el Excel (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GastalaYGuardala_${currentMonthKey()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
