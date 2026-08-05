import { useState } from "react";
import * as api from "./api.js";

const PALETTE = ["#5B9BE8", "#E8A855", "#35D0A0", "#E85D5D", "#C77DFF", "#4DD0E1"];

const TIPOS = [
  { value: "bolsa", label: "Bolsa" },
  { value: "cripto", label: "Cripto" },
  { value: "usdt", label: "USD / Stable" },
];

function tipoLabel(tipo) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

export default function GestionarCuentas({ cuentas, onChange }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const orden = cuentas.length
        ? Math.max(...cuentas.map((c) => Number(c.orden) || 0)) + 1
        : 0;
      await api.insertCuentaAhorro({ tipo, nombre: nombre.trim(), color, orden });
      setNombre("");
      setColor(PALETTE[0]);
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c) {
    const ok = window.confirm(
      `¿Eliminar "${c.nombre}"? Se van a borrar también todos los activos cargados en esta cuenta. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setError(null);
    try {
      await api.deleteCuentaAhorro(c.id);
      await onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="manage-cards">
      <button className="btn-add" onClick={() => setOpen((o) => !o)}>
        {open ? "Cerrar gestión de cuentas" : "+ Gestionar cuentas de ahorro"}
      </button>

      {open && (
        <div className="manage-cards-panel">
          {error && <div className="error-banner">{error}</div>}

          {cuentas.length > 0 && (
            <ul className="manage-cards-list">
              {cuentas.map((c) => (
                <li key={c.id}>
                  <span className="manage-cards-dot" style={{ background: c.color }} />
                  <span className="manage-cards-name">{c.nombre}</span>
                  <span className="manage-cards-tipo">{tipoLabel(c.tipo)}</span>
                  <button className="btn-del" onClick={() => handleDelete(c)} title="Eliminar cuenta">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="manage-cards-add">
            <input
              type="text"
              placeholder="Nombre de la cuenta (ej. Balanz, Binance, Ualá)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="color-palette">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <button className="btn-add" disabled={saving || !nombre.trim()} onClick={handleAdd}>
              + agregar cuenta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
