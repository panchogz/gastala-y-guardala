import { useState } from "react";

const FIELDS = [
  { key: "usa_cripto", label: "¿Usás Criptomonedas?" },
  { key: "usa_bolsa", label: "¿Usás Bolsa (CEDEARs/ONs)?" },
  { key: "usa_usdt", label: "¿Usás Dólares cripto (USDT)?" },
  { key: "usa_pesos", label: "¿Tenés Pesos líquidos en caja de ahorro?" },
];

export default function ConfigCategorias({ initial, onSave, onCancel, saving, title }) {
  const [values, setValues] = useState({
    usa_cripto: initial?.usa_cripto ?? true,
    usa_bolsa: initial?.usa_bolsa ?? true,
    usa_usdt: initial?.usa_usdt ?? true,
    usa_pesos: initial?.usa_pesos ?? true,
  });

  function toggle(key) {
    setValues((v) => ({ ...v, [key]: !v[key] }));
  }

  return (
    <div className="config-categorias">
      <h3>{title || "¿Qué categorías de ahorro usás?"}</h3>
      <p className="empty">
        Elegí qué secciones querés ver. Podés cambiar esto más adelante con "Editar
        configuración de categorías".
      </p>
      <div className="config-categorias-list">
        {FIELDS.map((f) => (
          <label key={f.key} className="config-checkbox">
            <input type="checkbox" checked={values[f.key]} onChange={() => toggle(f.key)} />
            {f.label}
          </label>
        ))}
      </div>
      <div className="config-categorias-actions">
        {onCancel && (
          <button className="btn-add" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        )}
        <button
          className="btn-register"
          style={{ background: "#35D0A0" }}
          disabled={saving}
          onClick={() => onSave(values)}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
