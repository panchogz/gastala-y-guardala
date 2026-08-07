import { useState } from "react";
import { downloadTarjetasExport } from "../lib/exportXlsx.js";

export default function ExportModal({ onClose }) {
  const [incluirDetalle, setIncluirDetalle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      await downloadTarjetasExport(incluirDetalle);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Exportar a Excel</h3>
        <p className="empty" style={{ marginTop: 0 }}>
          Por ahora exporta solo la solapa de Tarjetas (resumen del mes, evolución mensual
          con gráfico, y detalle opcional). Ahorros se agrega en un paso aparte.
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={incluirDetalle}
            onChange={(e) => setIncluirDetalle(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          Incluir detalle completo de Tarjetas (compras en cuotas, gastos en dólares y
          recurrentes de cada tarjeta)
        </label>

        {error && (
          <div className="error-banner" style={{ marginTop: 14, marginBottom: 0 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}>
          <button
            className="btn-register"
            style={{ background: "#35D0A0", marginTop: 0 }}
            disabled={loading}
            onClick={handleDownload}
          >
            {loading ? "Generando…" : "Descargar"}
          </button>
          <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
