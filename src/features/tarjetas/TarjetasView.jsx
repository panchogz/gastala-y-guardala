import { useCallback, useEffect, useState } from "react";
import CardPanel from "./CardPanel.jsx";
import TotalMensual from "./TotalMensual.jsx";
import GestionarTarjetas from "./GestionarTarjetas.jsx";
import CuotasOContado from "./CuotasOContado.jsx";
import HelpTip from "../../components/HelpTip.jsx";
import { fmtARS, fmtPct, parseNumeroFlexible } from "../../lib/helpers.js";
import * as api from "./api.js";

export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Salario neto único del usuario (config_usuario): texto del input, se
  // guarda al salir del campo. salarioNeto es el número que usan las tarjetas.
  const [salarioStr, setSalarioStr] = useState("");
  const [salarioNeto, setSalarioNeto] = useState(0);
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

  const loadSalario = useCallback(async () => {
    const cfg = await api.fetchConfigUsuario();
    const n = Number(cfg?.salario_neto) || 0;
    setSalarioNeto(n);
    setSalarioStr(n > 0 ? n.toLocaleString("es-AR") : "");
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
        await Promise.all([loadTarjetas(), loadMonthly(), loadSalario()]);
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
  }, [loadTarjetas, loadMonthly, loadSalario]);

  async function handleSalarioBlur() {
    const n = parseNumeroFlexible(salarioStr);
    const nuevo = n !== null && n > 0 ? n : 0;
    setSalarioStr(nuevo > 0 ? nuevo.toLocaleString("es-AR") : "");
    if (nuevo === salarioNeto) return;
    setSalarioNeto(nuevo);
    try {
      await api.saveSalarioNeto(nuevo);
    } catch (e) {
      setError(e.message);
    }
  }

  // Suma en vivo del "Total a pagar" de todas las tarjetas (lo informa cada
  // CardPanel vía onTotalsChange, el mismo dato que usa el gráfico).
  const totalTarjetas = tarjetas.reduce((a, t) => a + (live[t.id]?.actual ?? 0), 0);
  const pctTotal = salarioNeto > 0 ? totalTarjetas / salarioNeto : null;

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
        <>
          <div className="salario-strip">
            <label className="salario-input">
              <span>
                Salario neto <HelpTip id="salario" />
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="—"
                value={salarioStr}
                onChange={(e) => setSalarioStr(e.target.value)}
                onBlur={handleSalarioBlur}
              />
            </label>
            <div className="salario-datos">
              <span>
                Tarjetas <strong>{fmtARS(totalTarjetas)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong style={{ color: pctTotal > 0.3 ? "#E85D5D" : pctTotal === null ? "#8B93A1" : "#E8E6E1" }}>
                  {fmtPct(pctTotal)}
                </strong>{" "}
                del salario
              </span>
            </div>
          </div>
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
                salarioNeto={salarioNeto}
              />
            ))}
          </div>
        </>
      )}

      <div className="subhead" style={{ marginTop: 28 }}>
        Total mensual
      </div>
      <TotalMensual rows={monthly} tarjetas={tarjetas} live={live} />
    </div>
  );
}
