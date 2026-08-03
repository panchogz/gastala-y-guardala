export const uid = () => Math.random().toString(36).slice(2, 10);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function fullMonthsBetween(fromISO, toDate) {
  const from = new Date(fromISO + "T00:00:00");
  let months =
    (toDate.getFullYear() - from.getFullYear()) * 12 +
    (toDate.getMonth() - from.getMonth());
  if (toDate.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

export const fmtARS = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

export const fmtUSD = (n) =>
  (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export const fmtPct = (n) =>
  n === null || n === undefined ? "—" : (n * 100).toFixed(1) + "%";

export const mesLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });
};

// Formato compacto para tablas: "8/26" (mes sin cero a la izquierda / año de 2 dígitos).
export const mesLabelCorto = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${m}/${String(y).slice(-2)}`;
};

export const currentMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export const currentMonthKey = () => new Date().toISOString().slice(0, 7);
