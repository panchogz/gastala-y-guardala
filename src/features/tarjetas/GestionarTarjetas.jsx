import { useState } from "react";
import * as api from "./api.js";

const PALETTE = ["#5B9BE8", "#E8A855", "#35D0A0", "#E85D5D", "#C77DFF", "#4DD0E1"];

export default function GestionarTarjetas({ tarjetas, onChange, children }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editColor, setEditColor] = useState("");

  function startEdit(t) {
    setEditingId(t.id);
    setEditNombre(t.nombre);
    setEditColor(t.color);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(t) {
    if (!editNombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTarjeta(t.id, { nombre: editNombre.trim(), color: editColor });
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
      const orden = tarjetas.length
        ? Math.max(...tarjetas.map((t) => Number(t.orden) || 0)) + 1
        : 0;
      await api.insertTarjeta({ nombre: nombre.trim(), color, orden });
      setNombre("");
      setColor(PALETTE[0]);
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    const ok = window.confirm(
      `¿Eliminar "${t.nombre}"? Se van a borrar también todas sus compras en cuotas, gastos en dólares y el historial de totales mensuales asociados. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setError(null);
    try {
      await api.deleteTarjeta(t.id);
      await onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="manage-cards">
      {/* children: acciones extra en la misma línea (calculadora "¿Cuotas o contado?"). */}
      <div className="calc-bar">
        <button className="btn-add" style={{ marginTop: 0 }} onClick={() => setOpen((o) => !o)}>
          {open ? "Cerrar gestión de tarjetas" : "+ Gestionar tarjetas"}
        </button>
        {children}
      </div>

      {open && (
        <div className="manage-cards-panel">
          {error && <div className="error-banner">{error}</div>}

          {tarjetas.length > 0 && (
            <ul className="manage-cards-list">
              {tarjetas.map((t) =>
                editingId === t.id ? (
                  <li key={t.id}>
                    <div className="manage-cards-edit">
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        autoFocus
                      />
                      <div className="color-palette">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`color-swatch ${editColor === c ? "selected" : ""}`}
                            style={{ background: c }}
                            onClick={() => setEditColor(c)}
                            aria-label={c}
                          />
                        ))}
                      </div>
                      <button
                        className="btn-add"
                        disabled={saving || !editNombre.trim()}
                        onClick={() => saveEdit(t)}
                      >
                        Guardar
                      </button>
                      <button type="button" className="login-resend" onClick={cancelEdit} style={{ margin: 0 }}>
                        Cancelar
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={t.id}>
                    <span className="manage-cards-dot" style={{ background: t.color }} />
                    <span className="manage-cards-name">{t.nombre}</span>
                    <button className="btn-del" onClick={() => startEdit(t)} title="Editar tarjeta" style={{ color: "#8B93A1" }}>
                      ✎
                    </button>
                    <button className="btn-del" onClick={() => handleDelete(t)} title="Eliminar tarjeta">
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
              placeholder="Nombre de la tarjeta (ej. Visa, Naranja X)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
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
              + agregar tarjeta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
