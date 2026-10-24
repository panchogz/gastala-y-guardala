import { useState } from "react";
import { parseDecimalInput } from "../lib/helpers.js";
import BottomSheet from "./BottomSheet.jsx";

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
// - initialValues: opcional, { key: valor } que pisa el initial de cada campo
//   (alta precargada desde la calculadora "¿Cuotas o contado?").

function buildInitialValues(fields, overrides = {}) {
  const v = {};
  for (const f of fields) {
    if (overrides[f.key] !== undefined && overrides[f.key] !== null) v[f.key] = String(overrides[f.key]);
    else v[f.key] = typeof f.initial === "function" ? f.initial() : f.initial ?? "";
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

export default function MobileEntryForm({ title, accent, fields, onSubmit, onCancel, initialValues }) {
  const [raw, setRaw] = useState(() => buildInitialValues(fields, initialValues));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
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
    <BottomSheet
      title={title}
      accent={accent}
      onSubmit={handleSubmit}
      actions={
        <>
          <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-register" style={{ background: accent, marginTop: 0 }} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
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
    </BottomSheet>
  );
}
