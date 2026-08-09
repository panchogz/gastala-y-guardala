import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import GestionarCuentas, { tipoLabel } from "./GestionarCuentas.jsx";
import { fmtARS, fmtUSD, fmtPct, mesLabel, mesLabelCorto } from "../../lib/helpers.js";
import * as api from "./api.js";

function apiForTipo(tipo) {
  if (tipo === "bolsa") return api.bolsaApi;
  if (tipo === "cripto") return api.criptoApi;
  return api.usdtApi;
}

const TIPO_ACCENT = { bolsa: "#5B9BE8", cripto: "#35D0A0", usdt: "#E8A855" };
// Orden fijo de tipos (Bolsa → Cripto → USD/Stable), independiente del orden de
// creación de las cuentas. Dentro de cada tipo, cuentas y activos van alfabéticos.
const TIPO_ORDEN = { bolsa: 0, cripto: 1, usdt: 2 };

const porNombre = (a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es");
const porTipoYNombre = (a, b) => TIPO_ORDEN[a.tipo] - TIPO_ORDEN[b.tipo] || porNombre(a, b);

function sortByLabel(rows, field) {
  return [...rows].sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? ""), "es"));
}

export default function AhorrosView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [cuentas, setCuentas] = useState([]);
  const [activosPorCuenta, setActivosPorCuenta] = useState({});

  const [cotizacion, setCotizacion] = useState(1200);
  const [cotizacionUsdt, setCotizacionUsdt] = useState(1200);
  const [evolucionCuenta, setEvolucionCuenta] = useState([]);
  const [monedaEvolucion, setMonedaEvolucion] = useState("USD");

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
        const [cot, evoRows] = await Promise.all([api.fetchCotizacion(), api.fetchEvolucionCuentas()]);
        if (cancelled) return;
        setCotizacion(cot?.dolar_ccl_mep ?? 1200);
        setCotizacionUsdt(cot?.dolar_usdt ?? 1200);
        setEvolucionCuenta(evoRows);
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

  const cuentasBolsa = cuentas.filter((c) => c.tipo === "bolsa").sort(porNombre);
  const cuentasCripto = cuentas.filter((c) => c.tipo === "cripto").sort(porNombre);
  const cuentasUsdt = cuentas.filter((c) => c.tipo === "usdt").sort(porNombre);

  const rowsOfTipo = (lista) => lista.flatMap((c) => activosPorCuenta[c.id] || []);

  // ---- cripto (usa la cotización USDT, no la CCL/MEP; la moneda nativa de
  // precio_compra/precio_actual la define cuenta.moneda, no el tipo) ----
  const criptoCompute = (r, cuenta) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precio_compra) || 0;
    const precioActual = Number(r.precio_actual) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    let valorUSD, valorARS;
    if (cuenta.moneda === "ARS") {
      valorARS = valorActual;
      valorUSD = cotizacionUsdt ? valorActual / Number(cotizacionUsdt) : 0;
    } else {
      valorUSD = valorActual;
      valorARS = valorActual * (Number(cotizacionUsdt) || 0);
    }
    return { costoTotal, valorActual, pl, plPct, valorUSD, valorARS };
  };
  const criptoTotalUSD = cuentasCripto.reduce(
    (a, c) => a + (activosPorCuenta[c.id] || []).reduce((a2, r) => a2 + criptoCompute(r, c).valorUSD, 0),
    0
  );

  // ---- bolsa (misma idea: cuenta.moneda define la moneda nativa) ----
  const bolsaCompute = (r, cuenta) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precio_compra) || 0;
    const precioActual = Number(r.precio_actual) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    let valorUSD, valorARS;
    if (cuenta.moneda === "USD") {
      valorUSD = valorActual;
      valorARS = valorActual * (Number(cotizacion) || 0);
    } else {
      valorARS = valorActual;
      valorUSD = cotizacion ? valorActual / Number(cotizacion) : 0;
    }
    return { costoTotal, valorActual, pl, plPct, valorUSD, valorARS };
  };
  const bolsaTotalARS = cuentasBolsa.reduce(
    (a, c) => a + (activosPorCuenta[c.id] || []).reduce((a2, r) => a2 + bolsaCompute(r, c).valorARS, 0),
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

  // ---- totales por cuenta individual (para el resumen y el snapshot) ----
  function totalesDeCuenta(c) {
    const rows = activosPorCuenta[c.id] || [];
    if (c.tipo === "bolsa") {
      const usd = rows.reduce((a, r) => a + bolsaCompute(r, c).valorUSD, 0);
      const ars = rows.reduce((a, r) => a + bolsaCompute(r, c).valorARS, 0);
      return { usd, ars };
    }
    if (c.tipo === "cripto") {
      const usd = rows.reduce((a, r) => a + criptoCompute(r, c).valorUSD, 0);
      const ars = rows.reduce((a, r) => a + criptoCompute(r, c).valorARS, 0);
      return { usd, ars };
    }
    const usd = rows.reduce((a, r) => a + (Number(r.valor_actual_usd) || 0), 0);
    const ars = usd * (Number(cotizacionUsdt) || 0);
    return { usd, ars };
  }

  // ---- activos individuales de una cuenta, normalizados a {label, usd, ars}
  // (cada tipo guarda el nombre del activo en un campo distinto y calcula
  // usd/ars con su propia lógica de cotización). ----
  function activosDeCuenta(c) {
    const rows = activosPorCuenta[c.id] || [];
    let activos;
    if (c.tipo === "bolsa") {
      activos = rows.map((r) => {
        const { valorUSD, valorARS } = bolsaCompute(r, c);
        return { id: r.id, label: r.ticker || "—", usd: valorUSD, ars: valorARS };
      });
    } else if (c.tipo === "cripto") {
      activos = rows.map((r) => {
        const { valorUSD, valorARS } = criptoCompute(r, c);
        return { id: r.id, label: r.activo || "—", usd: valorUSD, ars: valorARS };
      });
    } else {
      activos = rows.map((r) => {
        const { valorARS } = usdtCompute(r);
        return { id: r.id, label: r.activo || "—", usd: Number(r.valor_actual_usd) || 0, ars: valorARS };
      });
    }
    return sortByLabel(activos, "label");
  }

  const gruposResumen = [
    { tipo: "bolsa", cuentas: cuentasBolsa },
    { tipo: "cripto", cuentas: cuentasCripto },
    { tipo: "usdt", cuentas: cuentasUsdt },
  ].filter((g) => g.cuentas.length > 0);

  async function handleGuardarSnapshot() {
    setSaving(true);
    setError(null);
    try {
      const cuentaTotales = cuentas.map((c) => {
        const t = totalesDeCuenta(c);
        return { cuenta_id: c.id, valor_usd: t.usd, valor_ars: t.ars };
      });
      await api.guardarSnapshotCuentas(cuentaTotales);
      const rows = await api.fetchEvolucionCuentas();
      setEvolucionCuenta(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- evolución: una serie/columna por cada cuenta presente en los datos ----
  const mesesEvolucion = [...new Set(evolucionCuenta.map((r) => r.mes))];
  const cuentaIdsEnEvolucion = [...new Set(evolucionCuenta.map((r) => r.cuenta_id))];
  const cuentasEnEvolucion = cuentaIdsEnEvolucion
    .map((id) => cuentas.find((c) => c.id === id))
    .filter(Boolean)
    .sort(porTipoYNombre);

  const campoEvolucion = monedaEvolucion === "ARS" ? "valor_ars" : "valor_usd";
  const fmtEvolucion = monedaEvolucion === "ARS" ? fmtARS : fmtUSD;

  const chartData = mesesEvolucion.map((mes) => {
    const obj = { mes: mesLabel(mes.slice(0, 7)) };
    for (const c of cuentasEnEvolucion) {
      const row = evolucionCuenta.find((r) => r.mes === mes && r.cuenta_id === c.id);
      if (row) obj[c.id] = Number(row[campoEvolucion]) || 0;
    }
    return obj;
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
          {cuentasBolsa.map((c) => {
            const nativeKey = c.moneda === "USD" ? "valorUSD" : "valorARS";
            const contrarioKey = c.moneda === "USD" ? "valorARS" : "valorUSD";
            const nativeFmt = c.moneda === "USD" ? fmtUSD : fmtARS;
            const contrarioFmt = c.moneda === "USD" ? fmtARS : fmtUSD;
            const contrarioLabel = c.moneda === "USD" ? "ARS" : "USD";
            return (
              <AssetTable
                key={c.id}
                title={c.nombre}
                accent={c.color}
                rows={sortByLabel(activosPorCuenta[c.id] || [], "ticker")}
                setRows={setRowsFor(c.id)}
                fields={["ticker", "cantidad", "precio_compra", "precio_actual"]}
                onAdd={() =>
                  api.bolsaApi.insert(c.id, {
                    ticker: "",
                    cantidad: 0,
                    precio_compra: 0,
                    precio_actual: 0,
                  })
                }
                onUpdate={(id, patch) => api.bolsaApi.update(id, patch)}
                onDelete={(id) => api.bolsaApi.remove(id)}
                columns={[
                  { key: "ticker", label: "Ticker", editable: true },
                  { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
                  { key: "precio_compra", label: `Precio compra (${c.moneda})`, editable: true, type: "number", align: "right" },
                  { key: "precio_actual", label: `Precio actual (${c.moneda})`, editable: true, type: "number", align: "right" },
                  { key: nativeKey, label: `Valor actual (${c.moneda})`, align: "right", format: nativeFmt },
                  { key: "pl", label: "P&L", align: "right", format: (v) => (v === null ? "—" : nativeFmt(v)) },
                  { key: "plPct", label: "P&L %", align: "right", format: (v) => (v === null ? "—" : fmtPct(v)) },
                  { key: contrarioKey, label: `Valor (${contrarioLabel})`, align: "right", format: contrarioFmt },
                ]}
                computeRow={(r) => bolsaCompute(r, c)}
                totalFn={(rows) => ({
                  valorARS: rows.reduce((a, r) => a + r.valorARS, 0),
                  valorUSD: rows.reduce((a, r) => a + r.valorUSD, 0),
                })}
              />
            );
          })}

          {cuentasCripto.map((c) => {
            const nativeKey = c.moneda === "ARS" ? "valorARS" : "valorUSD";
            const contrarioKey = c.moneda === "ARS" ? "valorUSD" : "valorARS";
            const nativeFmt = c.moneda === "ARS" ? fmtARS : fmtUSD;
            const contrarioFmt = c.moneda === "ARS" ? fmtUSD : fmtARS;
            const contrarioLabel = c.moneda === "ARS" ? "USD" : "ARS";
            return (
              <AssetTable
                key={c.id}
                title={c.nombre}
                accent={c.color}
                rows={sortByLabel(activosPorCuenta[c.id] || [], "activo")}
                setRows={setRowsFor(c.id)}
                fields={["activo", "cantidad", "precio_compra", "precio_actual"]}
                onAdd={() =>
                  api.criptoApi.insert(c.id, {
                    activo: "",
                    cantidad: 0,
                    precio_compra: 0,
                    precio_actual: 0,
                  })
                }
                onUpdate={(id, patch) => api.criptoApi.update(id, patch)}
                onDelete={(id) => api.criptoApi.remove(id)}
                columns={[
                  { key: "activo", label: "Activo", editable: true },
                  { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
                  { key: "precio_compra", label: `Precio compra (${c.moneda})`, editable: true, type: "number", align: "right" },
                  { key: "precio_actual", label: `Precio actual (${c.moneda})`, editable: true, type: "number", align: "right" },
                  { key: nativeKey, label: `Valor actual (${c.moneda})`, align: "right", format: nativeFmt },
                  { key: "pl", label: "P&L", align: "right", format: (v) => (v === null ? "—" : nativeFmt(v)) },
                  { key: "plPct", label: "P&L %", align: "right", format: (v) => (v === null ? "—" : fmtPct(v)) },
                  { key: contrarioKey, label: `Valor (${contrarioLabel})`, align: "right", format: contrarioFmt },
                ]}
                computeRow={(r) => criptoCompute(r, c)}
                totalFn={(rows) => ({
                  valorARS: rows.reduce((a, r) => a + r.valorARS, 0),
                  valorUSD: rows.reduce((a, r) => a + r.valorUSD, 0),
                })}
              />
            );
          })}

          {cuentasUsdt.map((c) => (
            <AssetTable
              key={c.id}
              title={c.nombre}
              accent={c.color}
              rows={sortByLabel(activosPorCuenta[c.id] || [], "activo")}
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

      {gruposResumen.length > 0 && (
        <>
          <div className="subhead" style={{ marginTop: 28 }}>
            Resumen general de ahorros
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Activo</th>
                  <th style={{ textAlign: "right" }}>USD</th>
                  <th style={{ textAlign: "right" }}>ARS</th>
                  <th style={{ textAlign: "right" }}>% de la cuenta</th>
                  <th style={{ textAlign: "right" }}>% del total</th>
                </tr>
              </thead>
              <tbody>
                {gruposResumen.map((g) => {
                  const subtotalUSD = g.cuentas.reduce((a, c) => a + totalesDeCuenta(c).usd, 0);
                  const subtotalARS = g.cuentas.reduce((a, c) => a + totalesDeCuenta(c).ars, 0);
                  return (
                    <Fragment key={g.tipo}>
                      {g.cuentas.map((c) => {
                        const activos = activosDeCuenta(c);
                        const cuentaTotal = totalesDeCuenta(c);
                        return (
                          <Fragment key={c.id}>
                            {activos.map((a) => (
                              <tr key={a.id}>
                                <td>{a.label}</td>
                                <td style={{ textAlign: "right" }}>{fmtUSD(a.usd)}</td>
                                <td style={{ textAlign: "right" }}>{fmtARS(a.ars)}</td>
                                <td style={{ textAlign: "right" }}>
                                  {fmtPct(cuentaTotal.usd ? a.usd / cuentaTotal.usd : 0)}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {fmtPct(resumen.totalUSD ? a.usd / resumen.totalUSD : 0)}
                                </td>
                              </tr>
                            ))}
                            {g.cuentas.length > 1 && (
                              <tr className="tbl-total">
                                <td>
                                  <span className="manage-cards-dot" style={{ background: c.color, marginRight: 8 }} />
                                  {c.nombre}
                                </td>
                                <td style={{ textAlign: "right" }}>{fmtUSD(cuentaTotal.usd)}</td>
                                <td style={{ textAlign: "right" }}>{fmtARS(cuentaTotal.ars)}</td>
                                <td style={{ textAlign: "right" }}>—</td>
                                <td style={{ textAlign: "right" }}>
                                  {fmtPct(resumen.totalUSD ? cuentaTotal.usd / resumen.totalUSD : 0)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      <tr className="tbl-total">
                        <td style={{ color: TIPO_ACCENT[g.tipo] }}>{tipoLabel(g.tipo)}</td>
                        <td style={{ textAlign: "right" }}>{fmtUSD(subtotalUSD)}</td>
                        <td style={{ textAlign: "right" }}>{fmtARS(subtotalARS)}</td>
                        <td style={{ textAlign: "right" }}>—</td>
                        <td style={{ textAlign: "right" }}>
                          {fmtPct(resumen.totalUSD ? subtotalUSD / resumen.totalUSD : 0)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="tbl-total">
                  <td>TOTAL</td>
                  <td style={{ textAlign: "right" }}>{fmtUSD(resumen.totalUSD)}</td>
                  <td style={{ textAlign: "right" }}>{fmtARS(resumen.totalARS)}</td>
                  <td style={{ textAlign: "right" }}>—</td>
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

          <div
            className="subhead"
            style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            Evolución mensual de ahorros
            <span className="color-palette" style={{ marginLeft: "auto" }}>
              {["USD", "ARS"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`color-swatch ${monedaEvolucion === m ? "selected" : ""}`}
                  style={{
                    width: "auto",
                    height: "auto",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: monedaEvolucion === m ? "#35D0A0" : "transparent",
                    color: monedaEvolucion === m ? "#0F1115" : "#8B93A1",
                    border: "1px solid #2A313B",
                  }}
                  onClick={() => setMonedaEvolucion(m)}
                >
                  {m}
                </button>
              ))}
            </span>
          </div>
          {evolucionCuenta.length === 0 ? (
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
                      label={{ value: monedaEvolucion, angle: -90, position: "insideLeft", fill: "#8B93A1", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1D232B", border: "1px solid #2A313B", color: "#E8E6E1" }}
                      formatter={(v) => fmtEvolucion(v)}
                    />
                    <Legend wrapperStyle={{ left: 64, right: 64, width: "auto" }} />
                    {cuentasEnEvolucion.map((c) => (
                      <Line
                        key={c.id}
                        type="monotone"
                        dataKey={c.id}
                        name={c.nombre}
                        stroke={c.color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      {cuentasEnEvolucion.map((c) => (
                        <th key={c.id} style={{ textAlign: "right" }}>
                          {c.nombre}
                        </th>
                      ))}
                      <th style={{ textAlign: "right" }}>Total {monedaEvolucion}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesesEvolucion.map((mes) => {
                      const rowsDelMes = evolucionCuenta.filter((r) => r.mes === mes);
                      const total = rowsDelMes.reduce((a, r) => a + (Number(r[campoEvolucion]) || 0), 0);
                      return (
                        <tr key={mes}>
                          <td>{mesLabelCorto(mes.slice(0, 7))}</td>
                          {cuentasEnEvolucion.map((c) => {
                            const r = rowsDelMes.find((r) => r.cuenta_id === c.id);
                            return (
                              <td key={c.id} style={{ textAlign: "right" }}>
                                {r ? fmtEvolucion(r[campoEvolucion]) : "—"}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtEvolucion(total)}</td>
                        </tr>
                      );
                    })}
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
