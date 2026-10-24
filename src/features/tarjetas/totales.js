import { cuotaInfo, mismoDiaEnMeses } from "../../lib/helpers.js";

// Única implementación del "Total a pagar" de una tarjeta y de sus
// compromisos de los próximos meses. La usan CardPanel (panel, franja de
// salario y gráfico de Total mensual) y el export a Excel (lib/exportXlsx.js),
// así los números de la app y del Excel no pueden divergir.
//
// - actual: cuotas con una cuota en el mes de `hoy` (cuotaInfo) + gastos en
//   dólares × cotización de la tarjeta + suscripciones activas.
// - futuros: para M+1..M+3, cuotas con una cuota en ese mes (cuotaInfo en la
//   misma fecha k meses después) + suscripciones activas a monto constante.
//   Sin gastos en dólares ni compras en un pago: no están comprometidos a futuro.
export const MESES_COMPROMETIDOS = 3;

export function totalesTarjeta({ cuotas = [], dolares = [], recurrentes = [], cotizacion = 0 }, hoy = new Date()) {
  const cuotasEn = (fecha) =>
    cuotas.reduce((a, r) => {
      const c = cuotaInfo(r, fecha);
      return a + (c.activa ? c.montoPorCuota : 0);
    }, 0);
  const totalCuotas = cuotasEn(hoy);
  const totalDolares = dolares.reduce((a, r) => a + (Number(r.monto) || 0) * (Number(cotizacion) || 0), 0);
  const totalRecurrentes = recurrentes.reduce((a, r) => a + (r.activo ? Number(r.monto) || 0 : 0), 0);
  const futuros = [];
  for (let k = 1; k <= MESES_COMPROMETIDOS; k++) {
    futuros.push(cuotasEn(mismoDiaEnMeses(hoy, k)) + totalRecurrentes);
  }
  return {
    totalCuotas,
    totalDolares,
    totalRecurrentes,
    actual: totalCuotas + totalDolares + totalRecurrentes,
    futuros,
  };
}
