import * as api from "../features/tarjetas/api.js";
import { fullMonthsBetween, currentMonthKey } from "./helpers.js";

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

export async function downloadTarjetasExport(incluirDetalleTarjetas) {
  const payload = await buildTarjetasExportPayload(incluirDetalleTarjetas);

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
