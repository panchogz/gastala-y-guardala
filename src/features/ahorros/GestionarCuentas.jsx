import { useState } from "react";
import * as api from "./api.js";

const PALETTE = ["#5B9BE8", "#E8A855", "#35D0A0", "#E85D5D", "#C77DFF", "#4DD0E1"];

export const TIPOS = [
  { value: "bolsa", label: "Bolsa" },
  { value: "cripto", label: "Cripto" },
  { value: "usdt", label: "USD / Stable" },
  { value: "pesos", label: "Pesos" },
];

export function tipoLabel(tipo) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

const MONEDA_DEFAULT_POR_TIPO = { bolsa: "ARS", cripto: "USD", usdt: "USD", pesos: "ARS" };

export default function GestionarCuentas({ cuentas, onChange }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [moneda, setMoneda] = useState(MONEDA_DEFAULT_POR_TIPO[TIPOS[0].value]);
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editColor, setEditColor] = useState("");

  function startEdit(c) {
    setEditingId(c.id);
    setEditNombre(c.nombre);
    setEditColor(c.color);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(c) {
    if (!editNombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateCuentaAhorro(c.id, { nombre: editNombre.trim(), color: editColor });
      setEditingId(null);
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const orden = cuentas.length
        ? Math.max(...cuentas.map((c) => Number(c.orden) || 0)) + 1
        : 0;
      await api.insertCuentaAhorro({ tipo, nombre: nombre.trim(), color, orden, moneda });
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
              {cuentas.map((c) =>
                editingId === c.id ? (
                  <li key={c.id}>
                    <div className="manage-cards-edit">
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        autoFocus
                      />
                      <div className="color-palette">
                        {PALETTE.map((col) => (
                          <button
                            key={col}
                            type="button"
                            className={`color-swatch ${editColor === col ? "selected" : ""}`}
                            style={{ background: col }}
                            onClick={() => setEditColor(col)}
                            aria-label={col}
                          />
                        ))}
                      </div>
                      <button
                        className="btn-add"
                        disabled={saving || !editNombre.trim()}
                        onClick={() => saveEdit(c)}
                      >
                        Guardar
                      </button>
                      <button type="button" className="login-resend" onClick={cancelEdit} style={{ margin: 0 }}>
                        Cancelar
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={c.id}>
                    <span className="manage-cards-dot" style={{ background: c.color }} />
                    <span className="manage-cards-name">{c.nombre}</span>
                    <span className="manage-cards-tipo">
                      {tipoLabel(c.tipo)} · {c.moneda}
                    </span>
                    <button className="btn-del" onClick={() => startEdit(c)} title="Editar cuenta" style={{ color: "#8B93A1" }}>
                      ✎
                    </button>
                    <button className="btn-del" onClick={() => handleDelete(c)} title="Eliminar cuenta">
                      ×
                    </button>
                  </li>
                )
              )}
            </ul>
          )}

          <div className="manage-cards-add">
            <input
              type="text"
              placeholder="Nombre de la cuenta (ej. Balanz, Binance, Ualá)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <select
              value={tipo}
              onChange={(e) => {
                const t = e.target.value;
                setTipo(t);
                setMoneda(MONEDA_DEFAULT_POR_TIPO[t]);
              }}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} aria-label="Moneda de esta cuenta">
              <option value="ARS">Moneda: ARS</option>
              <option value="USD">Moneda: USD</option>
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
