import { useCallback, useEffect, useMemo, useState } from "react";
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
import GestionarCuentas from "./GestionarCuentas.jsx";
import { fmtARS, fmtUSD, fmtPct, mesLabel, mesLabelCorto } from "../../lib/helpers.js";
import * as api from "./api.js";

function apiForTipo(tipo) {
  if (tipo === "bolsa") return api.bolsaApi;
  if (tipo === "cripto") return api.criptoApi;
  return api.usdtApi;
}

export default function AhorrosView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [cuentas, setCuentas] = useState([]);
  const [activosPorCuenta, setActivosPorCuenta] = useState({});

  const [cotizacion, setCotizacion] = useState(1200);
  const [cotizacionUsdt, setCotizacionUsdt] = useState(1200);
  const [evolucion, setEvolucion] = useState([]);

  const loadCuentas = useCallback(async () => {
    const rows = await api.fetchCuentasAhorro();
    setCuentas(rows);
    const entries = await Promise.all(
      rows.map(async (c) => [c.id, await apiForTipo(c.tipo).fetchAll(c.id)])
    );
    setActivosPorCuenta(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cot, evoRows] = await Promise.all([api.fetchCotizacion(), api.fetchEvolucion()]);
        if (cancelled) return;
        setCotizacion(cot?.dolar_ccl_mep ?? 1200);
        setCotizacionUsdt(cot?.dolar_usdt ?? 1200);
        setEvolucion(evoRows);
        await loadCuentas();
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
  }, [loadCuentas]);

  function setRowsFor(cuentaId) {
    return (updater) =>
      setActivosPorCuenta((prev) => ({ ...prev, [cuentaId]: updater(prev[cuentaId] || []) }));
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

  const cuentasBolsa = cuentas.filter((c) => c.tipo === "bolsa");
  const cuentasCripto = cuentas.filter((c) => c.tipo === "cripto");
  const cuentasUsdt = cuentas.filter((c) => c.tipo === "usdt");
  const usaBolsa = cuentasBolsa.length > 0;
  const usaCripto = cuentasCripto.length > 0;
  const usaUsdt = cuentasUsdt.length > 0;

  const rowsOfTipo = (lista) => lista.flatMap((c) => activosPorCuenta[c.id] || []);

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
  const criptoTotalUSD = rowsOfTipo(cuentasCripto).reduce(
    (a, r) => a + criptoCompute(r).valorActual,
    0
  );

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
  const bolsaTotalARS = rowsOfTipo(cuentasBolsa).reduce(
    (a, r) => a + bolsaCompute(r).valorActual,
    0
  );

  // ---- usdt (usa la cotización USDT, no la CCL/MEP) ----
  const usdtCompute = (r) => {
    const costoTotal = Number(r.costo_total_usd) || 0;
    const valorActual = Number(r.valor_actual_usd) || 0;
    const rendimiento = costoTotal ? valorActual - costoTotal : null;
    const valorARS = valorActual * (Number(cotizacionUsdt) || 0);
    return { rendimiento, valorARS };
  };
  const usdtTotalUSD = rowsOfTipo(cuentasUsdt).reduce(
    (a, r) => a + (Number(r.valor_actual_usd) || 0),
    0
  );

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
      </div>

      <GestionarCuentas cuentas={cuentas} onChange={loadCuentas} />

      {cuentas.length === 0 ? (
        <p className="empty">
          Todavía no agregaste ninguna cuenta de ahorro. Usá "Gestionar cuentas de ahorro" de
          arriba para crear la primera.
        </p>
      ) : (
        <>
          {cuentasBolsa.map((c) => (
            <AssetTable
              key={c.id}
              title={c.nombre}
              accent={c.color}
              rows={activosPorCuenta[c.id] || []}
              setRows={setRowsFor(c.id)}
              fields={["ticker", "cantidad", "precio_compra_ars", "precio_actual_ars"]}
              onAdd={() =>
                api.bolsaApi.insert(c.id, {
                  ticker: "",
                  cantidad: 0,
                  precio_compra_ars: 0,
                  precio_actual_ars: 0,
                })
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
          ))}

          {cuentasCripto.map((c) => (
            <AssetTable
              key={c.id}
              title={c.nombre}
              accent={c.color}
              rows={activosPorCuenta[c.id] || []}
              setRows={setRowsFor(c.id)}
              fields={["activo", "cantidad", "precio_compra_usd", "precio_actual_usd"]}
              onAdd={() =>
                api.criptoApi.insert(c.id, {
                  activo: "",
                  cantidad: 0,
                  precio_compra_usd: 0,
                  precio_actual_usd: 0,
                })
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
          ))}

          {cuentasUsdt.map((c) => (
            <AssetTable
              key={c.id}
              title={c.nombre}
              accent={c.color}
              rows={activosPorCuenta[c.id] || []}
              setRows={setRowsFor(c.id)}
              fields={["activo", "costo_total_usd", "valor_actual_usd"]}
              onAdd={() => api.usdtApi.insert(c.id, { activo: "", costo_total_usd: 0, valor_actual_usd: 0 })}
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
          ))}
        </>
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
