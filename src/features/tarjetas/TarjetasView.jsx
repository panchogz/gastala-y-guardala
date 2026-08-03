import { useCallback, useEffect, useState } from "react";
import CardPanel from "./CardPanel.jsx";
import TotalMensual from "./TotalMensual.jsx";
import GestionarTarjetas from "./GestionarTarjetas.jsx";
import * as api from "./api.js";

export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTarjetas = useCallback(async () => {
    const rows = await api.fetchTarjetas();
    setTarjetas(rows);
  }, []);

  const loadMonthly = useCallback(async () => {
    const rows = await api.fetchMonthly();
    setMonthly(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadTarjetas(), loadMonthly()]);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadTarjetas, loadMonthly]);

  async function handleTarjetasChange() {
    try {
      await Promise.all([loadTarjetas(), loadMonthly()]);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return <div className="loading">Cargando…</div>;
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <GestionarTarjetas tarjetas={tarjetas} onChange={handleTarjetasChange} />

      {tarjetas.length === 0 ? (
        <p className="empty">
          Todavía no agregaste ninguna tarjeta. Usá "Gestionar tarjetas" de arriba para crear la primera.
        </p>
      ) : (
        <div className="grid-2">
          {tarjetas.map((t) => (
            <CardPanel
              key={t.id}
              tarjetaId={t.id}
              name={t.nombre}
              accent={t.color}
              onRegistered={loadMonthly}
            />
          ))}
        </div>
      )}

      <div className="subhead" style={{ marginTop: 28 }}>
        Total mensual
      </div>
      <TotalMensual rows={monthly} tarjetas={tarjetas} />
    </div>
  );
}
