import { useEffect, useRef, useState } from "react";
import { parseDecimalInput } from "../lib/helpers.js";

// Alta de filas vía bottom sheet en mobile (≤640px). Genérico: cada tabla le
// pasa la definición de sus campos; el insert lo hace onSubmit con la misma
// función de alta que usa el "+ agregar" de desktop (cola offline incluida).
//
// Props:
// - title, accent
// - fields: [{ key, label, type: "text"|"number"|"date", required, min, gt,
//   nonZero, integer, initial }]. Reglas (solo números): min (≥), gt (>),
//   nonZero (≠ 0), integer. initial: valor o función que lo devuelve.
// - onSubmit(values): async; si tira error se muestra en el form y queda
//   abierto. Opcionales vacíos NO van en values, así la función de alta usa
//   su default de siempre.
// - onCancel()

function initialValues(fields) {
  const v = {};
  for (const f of fields) {
    v[f.key] = typeof f.initial === "function" ? f.initial() : f.initial ?? "";
  }
  return v;
}

// Un número puede ser negativo solo si ninguna regla lo impide (montos de
// tarjeta: reintegros/bonificaciones). El teclado decimal de iOS no tiene "-",
// por eso esos campos llevan un botón ±.
const allowsNegative = (f) => f.min === undefined && f.gt === undefined;

export function validateEntry(fields, raw) {
  const values = {};
  const errors = {};
  for (const f of fields) {
    const input = String(raw[f.key] ?? "").trim();
    if (input === "") {
      if (f.required) errors[f.key] = "Obligatorio";
      continue;
    }
    if (f.type !== "number") {
      values[f.key] = input;
      continue;
    }
    const n = parseDecimalInput(input);
    if (Number.isNaN(n)) errors[f.key] = "Número inválido";
    else if (f.integer && !Number.isInteger(n)) errors[f.key] = "Tiene que ser un número entero";
    else if (f.min !== undefined && n < f.min) errors[f.key] = `Tiene que ser ≥ ${f.min}`;
    else if (f.gt !== undefined && n <= f.gt) errors[f.key] = `Tiene que ser mayor a ${f.gt}`;
    else if (f.nonZero && n === 0) errors[f.key] = "No puede ser 0";
    else values[f.key] = n;
  }
  return { values, errors };
}

export default function MobileEntryForm({ title, accent, fields, onSubmit, onCancel }) {
  const [raw, setRaw] = useState(() => initialValues(fields));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef(null);

  // iOS: con el teclado abierto el viewport de layout no se achica, así que un
  // fixed con bottom:0 queda tapado. Se ajusta el overlay al visualViewport
  // (zona realmente visible) para que el pie con "Guardar" quede arriba del
  // teclado. Sin visualViewport queda el 100dvh del CSS.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = overlayRef.current;
    if (!vv || !el) return;
    const update = () => {
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Sin scroll del fondo mientras el sheet está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function setField(key, val) {
    setRaw((r) => ({ ...r, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleSign(key) {
    const s = String(raw[key] ?? "").trim();
    setField(key, s.startsWith("-") ? s.slice(1) : `-${s}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    const { values, errors: errs } = validateEntry(fields, raw);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" ref={overlayRef}>
      <form className="sheet-box" style={{ borderTopColor: accent }} onSubmit={handleSubmit} noValidate>
        <h3 className="sheet-title" style={{ color: accent }}>{title}</h3>
        <div className="sheet-body">
          {fields.map((f) => {
            const negable = f.type === "number" && allowsNegative(f);
            return (
              <label key={f.key} className="sheet-field">
                <span>
                  {f.label}
                  {!f.required && <span className="sheet-optional"> (opcional)</span>}
                </span>
                <div className="sheet-input-row">
                  {negable && (
                    <button
                      type="button"
                      className="sheet-sign"
                      onClick={() => toggleSign(f.key)}
                      aria-label="Cambiar signo"
                    >
                      ±
                    </button>
                  )}
                  <input
                    type={f.type === "date" ? "date" : "text"}
                    inputMode={f.type === "number" ? (f.integer ? "numeric" : "decimal") : undefined}
                    autoComplete="off"
                    value={raw[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    aria-invalid={!!errors[f.key]}
                  />
                </div>
                {errors[f.key] && <span className="sheet-error">{errors[f.key]}</span>}
              </label>
            );
          })}
          {submitError && <div className="error-banner">{submitError}</div>}
        </div>
        <div className="sheet-actions">
          <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-register" style={{ background: accent, marginTop: 0 }} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
