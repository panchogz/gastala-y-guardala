// Calculadora "¿Cuotas o contado?" (Tarjetas). Solo cálculo, sin estado ni
// escrituras. Modelo: simulación mes a mes, no valor presente. Se arranca con
// el precio contado en la mano; cada mes rinde a la tasa i y se paga una
// cuota. Lo que queda tras la última cuota es lo que "sobra" (o falta, si es
// negativo) por haber elegido cuotas. Tasas en fracción mensual (0.03 = 3%).

export const TECHO_MENSUAL = 0.3;
// Con |sobrante| por debajo de esto (relativo al contado) da prácticamente igual.
const UMBRAL_IGUAL = 0.005;

export function simular(contado, cuota, n, i) {
  const filas = [];
  let saldo = contado;
  for (let mes = 1; mes <= n; mes++) {
    const tenes = saldo * (1 + i);
    saldo = tenes - cuota;
    filas.push({ mes, tenes, cuota, teQueda: saldo });
  }
  return { filas, sobrante: saldo };
}

// Tasa mensual i* en la que cuotas y contado dan lo mismo (sobrante = 0).
// El sobrante crece con i, así que se busca por bisección entre 0 y el techo.
// Devuelve { tipo, i?, descuentoPct? }:
// - "descuento": total en cuotas < contado → conviene cuotas aun al 0%.
// - "tasa": i* encontrado (0 si las cuotas no tienen recargo ni descuento).
// - "techo": ni rindiendo TECHO_MENSUAL conviene cuotas.
export function equilibrio(contado, cuota, n) {
  const total = cuota * n;
  const dif = (contado - total) / contado;
  if (Math.abs(dif) < 1e-9) return { tipo: "tasa", i: 0 };
  if (dif > 0) return { tipo: "descuento", descuentoPct: dif * 100 };
  if (simular(contado, cuota, n, TECHO_MENSUAL).sobrante < 0) return { tipo: "techo" };
  let lo = 0;
  let hi = TECHO_MENSUAL;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (simular(contado, cuota, n, mid).sobrante < 0) lo = mid;
    else hi = mid;
  }
  return { tipo: "tasa", i: (lo + hi) / 2 };
}

// "sobra" | "falta" | "igual"
export function veredicto(sobrante, contado) {
  if (Math.abs(sobrante) < UMBRAL_IGUAL * contado) return "igual";
  return sobrante > 0 ? "sobra" : "falta";
}
