import { useCallback, useEffect, useState } from "react";
import CardPanel from "./CardPanel.jsx";
import TotalMensual from "./TotalMensual.jsx";
import GestionarTarjetas from "./GestionarTarjetas.jsx";
import CuotasOContado from "./CuotasOContado.jsx";
import * as api from "./api.js";

export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Totales en vivo que informa cada CardPanel: { [tarjetaId]: { actual, futuros: [m1, m2, m3] } }.
  // Alimentan el mes actual y los 3 meses a futuro del gráfico de Total mensual.
  const [live, setLive] = useState({});
  const [calcOpen, setCalcOpen] = useState(false);
  // Alta precargada que pidió la calculadora: { tarjetaId, valores } hasta que
  // el CardPanel de esa tarjeta la abre (ver prefillCuota en CardPanel).
  const [prefill, setPrefill] = useState(null);
  const handlePrefillDone = useCallback(() => setPrefill(null), []);

  // Estable (deps []) y sin setear si los números no cambiaron: evita que el
  // efecto de CardPanel que la llama dispare renders en loop.
  const handleTotalsChange = useCallback((tarjetaId, totals) => {
    setLive((prev) => {
      const old = prev[tarjetaId];
      if (!totals) {
        if (!old) return prev;
        const next = { ...prev };
        delete next[tarjetaId];
        return next;
      }
      if (old && old.actual === totals.actual && old.futuros.every((v, i) => v === totals.futuros[i])) {
        return prev;
      }
      return { ...prev, [tarjetaId]: totals };
    });
  }, []);

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

      <GestionarTarjetas tarjetas={tarjetas} onChange={handleTarjetasChange}>
        <button className="btn-import" onClick={() => setCalcOpen(true)}>
          ¿Cuotas o contado?
        </button>
      </GestionarTarjetas>

      {calcOpen && (
        <CuotasOContado
          tarjetas={tarjetas}
          onCargar={(tarjetaId, valores) => {
            setCalcOpen(false);
            setPrefill({ tarjetaId, valores });
          }}
          onClose={() => setCalcOpen(false)}
        />
      )}

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
              onTotalsChange={handleTotalsChange}
              prefillCuota={prefill?.tarjetaId === t.id ? prefill.valores : null}
              onPrefillDone={handlePrefillDone}
            />
          ))}
        </div>
      )}

      <div className="subhead" style={{ marginTop: 28 }}>
        Total mensual
      </div>
      <TotalMensual rows={monthly} tarjetas={tarjetas} live={live} />
    </div>
  );
}
