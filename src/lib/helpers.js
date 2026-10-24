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

// Parsea números que pueden venir como number (ya ok) o como string con
// formato variado (del JSON pegado de un chat de IA, o de lo que el usuario
// edite a mano en la revisión de importación): símbolos de moneda, separador
// de miles y decimal según cualquiera de las dos convenciones (AR: punto de
// miles / coma decimal, o al revés). Ver FEATURE_importacion_resumenes.md.
// Casos: "1.234,56"->1234.56, "1,234.56"->1234.56, "1234,5"->1234.5,
// "1.234"->1234, "0,00045"->0.00045, "$ 12.500"->12500, ""->null.
export function parseNumeroFlexible(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input === null || input === undefined) return null;

  let s = String(input).trim();
  if (s === "") return null;

  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1).trim();
  }

  s = s.replace(/US\$|ARS|USD|\$/gi, "").replace(/[\s ]/g, "");
  if (s === "") return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  let normalizado;
  if (hasDot && hasComma) {
    // El separador que aparece último es el decimal; el otro, de miles.
    const decimalEsComa = s.lastIndexOf(",") > s.lastIndexOf(".");
    const [miles, decimal] = decimalEsComa ? [".", ","] : [",", "."];
    normalizado = s.split(miles).join("").replace(decimal, ".");
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const partes = s.split(sep);
    const ultima = partes[partes.length - 1];
    // Un solo separador: es decimal, salvo que tenga forma de miles (más de
    // una aparición, o un único grupo de exactamente 3 dígitos detrás).
    const formaDeMiles = partes.length > 2 || ultima.length === 3;
    normalizado = formaDeMiles ? partes.join("") : partes.join(".");
  } else {
    normalizado = s;
  }

  const parsed = parseFloat(normalizado);
  if (!Number.isFinite(parsed)) return null;
  return negativo ? -parsed : parsed;
}

// Parser estricto para inputs numéricos tipeados a mano (MobileEntryForm):
// el único separador permitido (coma o punto) es SIEMPRE decimal. No usar
// parseNumeroFlexible acá: ese interpreta "0,500" como 500 (grupo de miles),
// pensado para texto de resúmenes, no para un teclado decimal.
// ""->null, "12,5"->12.5, "-3.2"->-3.2, "1.234,5"->NaN (inválido).
export function parseDecimalInput(input) {
  const s = String(input ?? "").trim();
  if (s === "") return null;
  if (!/^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return NaN;
  return Number(s.replace(",", "."));
}
