import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import AssetTable from "./AssetTable.jsx";
import ConfigCategorias from "./ConfigCategorias.jsx";
import { fmtARS, fmtUSD, fmtPct, mesLabel, mesLabelCorto } from "../../lib/helpers.js";
import * as api from "./api.js";

export default function AhorrosView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [ahorrosConfig, setAhorrosConfig] = useState(null);
  const [editandoConfig, setEditandoConfig] = useState(false);

  const [cotizacion, setCotizacion] = useState(1200);
  const [cotizacionUsdt, setCotizacionUsdt] = useState(1200);
  const [cripto, setCripto] = useState([]);
  const [bolsa, setBolsa] = useState([]);
  const [usdt, setUsdt] = useState([]);
  const [evolucion, setEvolucion] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cfg, cot, criptoRows, bolsaRows, usdtRows, evoRows] = await Promise.all([
          api.fetchAhorrosConfig(),
          api.fetchCotizacion(),
          api.criptoApi.fetchAll(),
          api.bolsaApi.fetchAll(),
          api.usdtApi.fetchAll(),
          api.fetchEvolucion(),
        ]);
        if (cancelled) return;
        setAhorrosConfig(cfg);
        setCotizacion(cot?.dolar_ccl_mep ?? 1200);
        setCotizacionUsdt(cot?.dolar_usdt ?? 1200);
        setCripto(criptoRows);
        setBolsa(bolsaRows);
        setUsdt(usdtRows);
        setEvolucion(evoRows);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGuardarConfigCategorias(values) {
    setSavingConfig(true);
    setError(null);
    try {
      await api.saveAhorrosConfig({ ...values, setup_completo: true });
      setAhorrosConfig((c) => ({ ...c, ...values, setup_completo: true }));
      setEditandoConfig(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCotizacionBlur() {
    try {
      await api.saveCotizacion(Number(cotizacion) || 0);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCotizacionUsdtBlur() {
    try {
      await api.saveCotizacionUsdt(Number(cotizacionUsdt) || 0);
    } catch (e) {
      setError(e.message);
    }
  }

  const usaCripto = ahorrosConfig?.usa_cripto ?? true;
  const usaBolsa = ahorrosConfig?.usa_bolsa ?? true;
  const usaUsdt = ahorrosConfig?.usa_usdt ?? true;

  // ---- cripto (usa la cotización USDT, no la CCL/MEP) ----
  const criptoCompute = (r) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precio_compra_usd) || 0;
    const precioActual = Number(r.precio_actual_usd) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    const valorARS = valorActual * (Number(cotizacionUsdt) || 0);
    return { costoTotal, valorActual, pl, plPct, valorARS };
  };
  const criptoTotalUSD = usaCripto
    ? cripto.reduce((a, r) => a + criptoCompute(r).valorActual, 0)
    : 0;

  // ---- bolsa ----
  const bolsaCompute = (r) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precio_compra_ars) || 0;
    const precioActual = Number(r.precio_actual_ars) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    const valorUSD = cotizacion ? valorActual / Number(cotizacion) : 0;
    return { costoTotal, valorActual, pl, plPct, valorUSD };
  };
  const bolsaTotalARS = usaBolsa
    ? bolsa.reduce((a, r) => a + bolsaCompute(r).valorActual, 0)
    : 0;

  // ---- usdt (usa la cotización USDT, no la CCL/MEP) ----
  const usdtCompute = (r) => {
    const costoTotal = Number(r.costo_total_usd) || 0;
    const valorActual = Number(r.valor_actual_usd) || 0;
    const rendimiento = costoTotal ? valorActual - costoTotal : null;
    const valorARS = valorActual * (Number(cotizacionUsdt) || 0);
    return { rendimiento, valorARS };
  };
  const usdtTotalUSD = usaUsdt
    ? usdt.reduce((a, r) => a + (Number(r.valor_actual_usd) || 0), 0)
    : 0;

  const resumen = useMemo(() => {
    const criptoUSD = criptoTotalUSD;
    const bolsaUSD = cotizacion ? bolsaTotalARS / cotizacion : 0;
    const dolaresUSD = usdtTotalUSD;
    const totalUSD = criptoUSD + bolsaUSD + dolaresUSD;
    const criptoARS = criptoUSD * cotizacionUsdt;
    const bolsaARS = bolsaTotalARS;
    const dolaresARS = dolaresUSD * cotizacionUsdt;
    return {
      criptoUSD,
      bolsaUSD,
      dolaresUSD,
      totalUSD,
      criptoARS,
      bolsaARS,
      dolaresARS,
      totalARS: criptoARS + bolsaARS + dolaresARS,
    };
  }, [criptoTotalUSD, bolsaTotalARS, usdtTotalUSD, cotizacion, cotizacionUsdt]);

  const resumenRows = [
    usaBolsa && ["Bolsa", resumen.bolsaUSD, resumen.bolsaARS],
    usaCripto && ["Criptomonedas", resumen.criptoUSD, resumen.criptoARS],
    usaUsdt && ["Dólares cripto", resumen.dolaresUSD, resumen.dolaresARS],
  ].filter(Boolean);

  async function handleGuardarSnapshot() {
    setSaving(true);
    setError(null);
    try {
      await api.guardarSnapshot(resumen);
      const evoRows = await api.fetchEvolucion();
      setEvolucion(evoRows);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const chartData = evolucion.map((m) => {
    const criptoUSD = Number(m.cripto_usd) || 0;
    const bolsaUSD = Number(m.bolsa_usd) || 0;
    const dolaresUSD = Number(m.dolares_usd) || 0;
    return {
      mes: mesLabel(m.mes.slice(0, 7)),
      ...(usaBolsa ? { Bolsa: bolsaUSD } : {}),
      ...(usaCripto ? { Cripto: criptoUSD } : {}),
      ...(usaUsdt ? { "Dólares cripto": dolaresUSD } : {}),
    };
  });

  if (loading) {
    return <div className="loading">Cargando…</div>;
  }

  if (!ahorrosConfig?.setup_completo || editandoConfig) {
    return (
      <ConfigCategorias
        initial={ahorrosConfig}
        onSave={handleGuardarConfigCategorias}
        onCancel={ahorrosConfig?.setup_completo ? () => setEditandoConfig(false) : null}
        saving={savingConfig}
        title={
          ahorrosConfig?.setup_completo
            ? "Editar configuración de categorías"
            : "Antes de empezar: ¿qué categorías de ahorro usás?"
        }
      />
    );
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <div className="stat-row" style={{ marginBottom: 20, alignItems: "flex-end" }}>
        <label className="cotiz-input">
          Cotización dólar (CCL/MEP)
          <input
            type="number"
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
            onBlur={handleCotizacionBlur}
          />
        </label>
        <label className="cotiz-input">
          Cotización USDT
          <input
            type="number"
            value={cotizacionUsdt}
            onChange={(e) => setCotizacionUsdt(e.target.value)}
            onBlur={handleCotizacionUsdtBlur}
          />
        </label>
        <button className="btn-add" onClick={() => setEditandoConfig(true)}>
          Editar configuración de categorías
        </button>
      </div>

      {usaBolsa && (
        <AssetTable
          title="Bolsa (CEDEARs / ONs)"
          accent="#5B9BE8"
          rows={bolsa}
          setRows={setBolsa}
          fields={["ticker", "cantidad", "precio_compra_ars", "precio_actual_ars"]}
          onAdd={() =>
            api.bolsaApi.insert({ ticker: "", cantidad: 0, precio_compra_ars: 0, precio_actual_ars: 0 })
          }
          onUpdate={(id, patch) => api.bolsaApi.update(id, patch)}
          onDelete={(id) => api.bolsaApi.remove(id)}
          columns={[
            { key: "ticker", label: "Ticker", editable: true },
            { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
            { key: "precio_compra_ars", label: "Precio compra (ARS)", editable: true, type: "number", align: "right" },
            { key: "precio_actual_ars", label: "Precio actual (ARS)", editable: true, type: "number", align: "right" },
            { key: "valorActual", label: "Valor actual (ARS)", align: "right", format: fmtARS },
            { key: "pl", label: "P&L", align: "right", format: (v) => (v === null ? "—" : fmtARS(v)) },
            { key: "plPct", label: "P&L %", align: "right", format: (v) => (v === null ? "—" : fmtPct(v)) },
            { key: "valorUSD", label: "Valor (USD)", align: "right", format: fmtUSD },
          ]}
          computeRow={bolsaCompute}
          totalFn={(rows) => ({
            valorActual: rows.reduce((a, r) => a + r.valorActual, 0),
            valorUSD: rows.reduce((a, r) => a + r.valorUSD, 0),
          })}
        />
      )}

      {usaCripto && (
        <AssetTable
          title="Criptomonedas"
          accent="#35D0A0"
          rows={cripto}
          setRows={setCripto}
          fields={["activo", "cantidad", "precio_compra_usd", "precio_actual_usd"]}
          onAdd={() =>
            api.criptoApi.insert({ activo: "", cantidad: 0, precio_compra_usd: 0, precio_actual_usd: 0 })
          }
          onUpdate={(id, patch) => api.criptoApi.update(id, patch)}
          onDelete={(id) => api.criptoApi.remove(id)}
          columns={[
            { key: "activo", label: "Activo", editable: true },
            { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
            { key: "precio_compra_usd", label: "Precio compra (USD)", editable: true, type: "number", align: "right" },
            { key: "precio_actual_usd", label: "Precio actual (USD)", editable: true, type: "number", align: "right" },
            { key: "valorActual", label: "Valor actual (USD)", align: "right", format: fmtUSD },
            { key: "pl", label: "P&L", align: "right", format: (v) => (v === null ? "—" : fmtUSD(v)) },
            { key: "plPct", label: "P&L %", align: "right", format: (v) => (v === null ? "—" : fmtPct(v)) },
            { key: "valorARS", label: "Valor (ARS)", align: "right", format: fmtARS },
          ]}
          computeRow={criptoCompute}
          totalFn={(rows) => ({
            valorActual: rows.reduce((a, r) => a + r.valorActual, 0),
            valorARS: rows.reduce((a, r) => a + r.valorARS, 0),
          })}
        />
      )}

      {usaUsdt && (
        <AssetTable
          title="Dólares cripto (USDT / stablecoins)"
          accent="#E8A855"
          rows={usdt}
          setRows={setUsdt}
          fields={["activo", "costo_total_usd", "valor_actual_usd"]}
          onAdd={() => api.usdtApi.insert({ activo: "", costo_total_usd: 0, valor_actual_usd: 0 })}
          onUpdate={(id, patch) => api.usdtApi.update(id, patch)}
          onDelete={(id) => api.usdtApi.remove(id)}
          columns={[
            { key: "activo", label: "Activo / plataforma", editable: true },
            { key: "costo_total_usd", label: "Costo total (USD)", editable: true, type: "number", align: "right" },
            { key: "valor_actual_usd", label: "Valor actual (USD)", editable: true, type: "number", align: "right" },
            { key: "rendimiento", label: "Rendimiento", align: "right", format: (v) => (v === null ? "—" : fmtUSD(v)) },
            { key: "valorARS", label: "Valor (ARS)", align: "right", format: fmtARS },
          ]}
          computeRow={usdtCompute}
          totalFn={(rows) => ({
            valorActual: rows.reduce((a, r) => a + (Number(r.valor_actual_usd) || 0), 0),
            valorARS: rows.reduce((a, r) => a + r.valorARS, 0),
          })}
        />
      )}

      {resumenRows.length > 0 && (
        <>
          <div className="subhead" style={{ marginTop: 28 }}>
            Resumen general de ahorros
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ textAlign: "right" }}>USD</th>
                  <th style={{ textAlign: "right" }}>ARS</th>
                  <th style={{ textAlign: "right" }}>% del total</th>
                </tr>
              </thead>
              <tbody>
                {resumenRows.map(([label, usd, ars]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td style={{ textAlign: "right" }}>{fmtUSD(usd)}</td>
                    <td style={{ textAlign: "right" }}>{fmtARS(ars)}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtPct(resumen.totalUSD ? usd / resumen.totalUSD : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tbl-total">
                  <td>TOTAL</td>
                  <td style={{ textAlign: "right" }}>{fmtUSD(resumen.totalUSD)}</td>
                  <td style={{ textAlign: "right" }}>{fmtARS(resumen.totalARS)}</td>
                  <td style={{ textAlign: "right" }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            className="btn-register"
            style={{ background: "#35D0A0" }}
            disabled={saving}
            onClick={handleGuardarSnapshot}
          >
            Guardar foto del mes actual en Evolución Mensual
          </button>

          <div className="subhead" style={{ marginTop: 28 }}>
            Evolución mensual de ahorros (USD)
          </div>
          {evolucion.length === 0 ? (
            <p className="empty">
              Todavía no guardaste ninguna foto mensual. Usá el botón "Guardar foto del mes actual" de arriba.
            </p>
          ) : (
            <>
              <div style={{ width: "100%", height: 260, marginBottom: 16 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 64, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A313B" />
                    <XAxis dataKey="mes" stroke="#8B93A1" fontSize={12} padding={{ left: 16, right: 16 }} />
                    <YAxis
                      width={64}
                      stroke="#8B93A1"
                      fontSize={12}
                      label={{ value: "USD", angle: -90, position: "insideLeft", fill: "#8B93A1", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1D232B", border: "1px solid #2A313B", color: "#E8E6E1" }}
                      formatter={(v) => fmtUSD(v)}
                    />
                    <Legend wrapperStyle={{ left: 64, right: 64, width: "auto" }} />
                    {usaBolsa && (
                      <Line type="monotone" dataKey="Bolsa" stroke="#5B9BE8" strokeWidth={2} dot={{ r: 3 }} />
                    )}
                    {usaCripto && (
                      <Line type="monotone" dataKey="Cripto" stroke="#35D0A0" strokeWidth={2} dot={{ r: 3 }} />
                    )}
                    {usaUsdt && (
                      <Line
                        type="monotone"
                        dataKey="Dólares cripto"
                        stroke="#E8A855"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      {usaBolsa && <th style={{ textAlign: "right" }}>Bolsa</th>}
                      {usaCripto && <th style={{ textAlign: "right" }}>Cripto</th>}
                      {usaUsdt && <th style={{ textAlign: "right" }}>Dólares</th>}
                      <th style={{ textAlign: "right" }}>Total USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolucion.map((m) => (
                      <tr key={m.id}>
                        <td>{mesLabelCorto(m.mes.slice(0, 7))}</td>
                        {usaBolsa && <td style={{ textAlign: "right" }}>{fmtUSD(m.bolsa_usd)}</td>}
                        {usaCripto && <td style={{ textAlign: "right" }}>{fmtUSD(m.cripto_usd)}</td>}
                        {usaUsdt && <td style={{ textAlign: "right" }}>{fmtUSD(m.dolares_usd)}</td>}
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {fmtUSD(
                            (usaCripto ? Number(m.cripto_usd) || 0 : 0) +
                              (usaBolsa ? Number(m.bolsa_usd) || 0 : 0) +
                              (usaUsdt ? Number(m.dolares_usd) || 0 : 0)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
