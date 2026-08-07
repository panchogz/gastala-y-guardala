import { useState } from "react";
import { downloadExport } from "../lib/exportXlsx.js";

export default function ExportModal({ onClose }) {
  const [incluirDetalleTarjetas, setIncluirDetalleTarjetas] = useState(false);
  const [incluirDetalleAhorros, setIncluirDetalleAhorros] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      await downloadExport(incluirDetalleTarjetas, incluirDetalleAhorros);
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
          Exporta las solapas de Tarjetas (resumen del mes, evolución mensual con gráfico) y
          Ahorros (resumen por tipo/cuenta, distribución y evolución mensual), con detalle
          opcional en cada una.
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={incluirDetalleTarjetas}
            onChange={(e) => setIncluirDetalleTarjetas(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          Incluir detalle completo de Tarjetas (compras en cuotas, gastos en dólares y
          recurrentes de cada tarjeta)
        </label>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={incluirDetalleAhorros}
            onChange={(e) => setIncluirDetalleAhorros(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          Incluir detalle completo de Ahorros (activos de cada cuenta con precio de compra,
          precio actual y P&L)
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
