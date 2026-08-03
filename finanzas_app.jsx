import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);

const todayISO = () => new Date().toISOString().slice(0, 10);

function fullMonthsBetween(fromISO, toDate) {
  const from = new Date(fromISO + "T00:00:00");
  let months =
    (toDate.getFullYear() - from.getFullYear()) * 12 +
    (toDate.getMonth() - from.getMonth());
  if (toDate.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

const fmtARS = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const fmtUSD = (n) =>
  (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const fmtPct = (n) => (n === null || n === undefined ? "—" : (n * 100).toFixed(1) + "%");

const MESES_KEYS = (() => {
  const out = [];
  const start = new Date();
  start.setDate(1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
})();

const mesLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });
};

// ---------- generic small table shell ----------
function Table({ columns, children, footer }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left" }}>
                {c.label}
              </th>
            ))}
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

function Cell({ editable, value, onChange, type = "text", align, format }) {
  if (!editable) {
    return (
      <td style={{ textAlign: align || "left" }} className="cell-computed">
        {format ? format(value) : value}
      </td>
    );
  }
  return (
    <td style={{ textAlign: align || "left" }}>
      <input
        className="cell-input"
        type={type}
        value={value}
        onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
      />
    </td>
  );
}

// ================= TARJETAS =================

function useCard(initial) {
  return useState(initial);
}

function emptyCuotaRow() {
  return { id: uid(), fecha: todayISO(), comercio: "", monto: 0, cuotas: 1 };
}
function emptyDolarRow() {
  return { id: uid(), fecha: todayISO(), comercio: "", monto: 0 };
}

function CardPanel({ name, accent, card, setCard }) {
  const today = new Date();

  const cuotasEnriched = card.cuotas.map((r) => {
    const cuotaActual = Math.min(
      Number(r.cuotas) || 1,
      Math.max(1, fullMonthsBetween(r.fecha, today) + 1)
    );
    const cuotasPendientes = (Number(r.cuotas) || 1) - cuotaActual;
    const montoPorCuota = (Number(r.monto) || 0) / (Number(r.cuotas) || 1);
    const saldoPagado = montoPorCuota * cuotaActual;
    const saldoPendiente = montoPorCuota * cuotasPendientes;
    return { ...r, cuotaActual, cuotasPendientes, montoPorCuota, saldoPagado, saldoPendiente };
  });

  const dolarEnriched = card.dolares.map((r) => ({
    ...r,
    montoARS: (Number(r.monto) || 0) * (Number(card.cotizacion) || 0),
  }));

  const totalCuotas = cuotasEnriched.reduce((a, r) => a + r.montoPorCuota, 0);
  const totalDolares = dolarEnriched.reduce((a, r) => a + r.montoARS, 0);
  const totalAPagar = totalCuotas + totalDolares;
  const pctSalario = Number(card.salario) > 0 ? totalAPagar / Number(card.salario) : 0;

  const updateField = (patch) => setCard({ ...card, ...patch });
  const updateCuota = (id, key, val) =>
    setCard({
      ...card,
      cuotas: card.cuotas.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    });
  const updateDolar = (id, key, val) =>
    setCard({
      ...card,
      dolares: card.dolares.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    });
  const delCuota = (id) => setCard({ ...card, cuotas: card.cuotas.filter((r) => r.id !== id) });
  const delDolar = (id) => setCard({ ...card, dolares: card.dolares.filter((r) => r.id !== id) });

  return (
    <div className="card-panel" style={{ borderTopColor: accent }}>
      <div className="card-head">
        <h3 style={{ color: accent }}>{name}</h3>
        <div className="head-inputs">
          <label>
            Salario neto del mes
            <input
              type="number"
              value={card.salario}
              onChange={(e) => updateField({ salario: e.target.value })}
            />
          </label>
          <label>
            Cotización dólar
            <input
              type="number"
              value={card.cotizacion}
              onChange={(e) => updateField({ cotizacion: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Total a pagar</span>
          <span className="stat-value">{fmtARS(totalAPagar)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">% del salario</span>
          <span
            className="stat-value"
            style={{ color: pctSalario > 0.3 ? "#E85D5D" : accent }}
          >
            {fmtPct(pctSalario)}
          </span>
        </div>
      </div>

      <div className="subhead">Compras en cuotas (ARS)</div>
      <Table
        columns={[
          { key: "fecha", label: "Fecha" },
          { key: "comercio", label: "Comercio" },
          { key: "monto", label: "Monto", align: "right" },
          { key: "cuotas", label: "Cuotas", align: "right" },
          { key: "actual", label: "Cuota act.", align: "right" },
          { key: "pend", label: "Pend.", align: "right" },
          { key: "porCuota", label: "$/cuota", align: "right" },
          { key: "pagado", label: "Pagado", align: "right" },
        ]}
        footer={
          <tr className="tbl-total">
            <td colSpan={2}>TOTALES</td>
            <td style={{ textAlign: "right" }}>
              {fmtARS(cuotasEnriched.reduce((a, r) => a + (Number(r.monto) || 0), 0))}
            </td>
            <td />
            <td />
            <td />
            <td style={{ textAlign: "right" }}>{fmtARS(totalCuotas)}</td>
            <td style={{ textAlign: "right" }}>
              {fmtARS(cuotasEnriched.reduce((a, r) => a + r.saldoPagado, 0))}
            </td>
            <td />
          </tr>
        }
      >
        {cuotasEnriched.map((r) => (
          <tr key={r.id}>
            <Cell editable type="date" value={r.fecha} onChange={(v) => updateCuota(r.id, "fecha", v)} />
            <Cell editable value={r.comercio} onChange={(v) => updateCuota(r.id, "comercio", v)} />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateCuota(r.id, "monto", v)}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.cuotas}
              onChange={(v) => updateCuota(r.id, "cuotas", v)}
            />
            <Cell align="right" value={r.cuotaActual} format={(v) => v} />
            <Cell align="right" value={r.cuotasPendientes} format={(v) => v} />
            <Cell align="right" value={r.montoPorCuota} format={fmtARS} />
            <Cell align="right" value={r.saldoPagado} format={fmtARS} />
            <td>
              <button className="btn-del" onClick={() => delCuota(r.id)}>
                ×
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <button className="btn-add" onClick={() => updateField({ cuotas: [...card.cuotas, emptyCuotaRow()] })}>
        + compra en cuotas
      </button>

      <div className="subhead" style={{ marginTop: 18 }}>
        Gastos en dólares (contado)
      </div>
      <Table
        columns={[
          { key: "fecha", label: "Fecha" },
          { key: "comercio", label: "Comercio" },
          { key: "monto", label: "Monto USD", align: "right" },
          { key: "ars", label: "En pesos", align: "right" },
        ]}
        footer={
          <tr className="tbl-total">
            <td colSpan={2}>TOTALES</td>
            <td style={{ textAlign: "right" }}>
              {fmtUSD(dolarEnriched.reduce((a, r) => a + (Number(r.monto) || 0), 0))}
            </td>
            <td style={{ textAlign: "right" }}>{fmtARS(totalDolares)}</td>
          </tr>
        }
      >
        {dolarEnriched.map((r) => (
          <tr key={r.id}>
            <Cell editable type="date" value={r.fecha} onChange={(v) => updateDolar(r.id, "fecha", v)} />
            <Cell editable value={r.comercio} onChange={(v) => updateDolar(r.id, "comercio", v)} />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateDolar(r.id, "monto", v)}
            />
            <Cell align="right" value={r.montoARS} format={fmtARS} />
            <td>
              <button className="btn-del" onClick={() => delDolar(r.id)}>
                ×
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <button className="btn-add" onClick={() => updateField({ dolares: [...card.dolares, emptyDolarRow()] })}>
        + gasto en dólares
      </button>

      <button
        className="btn-register"
        style={{ background: accent }}
        onClick={() => window.dispatchEvent(new CustomEvent("registrar-mes", { detail: { name, total: totalAPagar } }))}
      >
        Registrar este mes en el total mensual
      </button>
    </div>
  );
}

function TotalMensual({ monthly }) {
  const keys = Object.keys(monthly).sort();
  if (keys.length === 0)
    return <p className="empty">Todavía no registraste ningún mes. Usá el botón "Registrar" en cada tarjeta.</p>;
  const totalGeneral = keys.reduce((a, k) => a + (monthly[k].visa || 0) + (monthly[k].master || 0), 0);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Mes</th>
            <th style={{ textAlign: "right" }}>Visa</th>
            <th style={{ textAlign: "right" }}>Master</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>{mesLabel(k)}</td>
              <td style={{ textAlign: "right" }}>{fmtARS(monthly[k].visa || 0)}</td>
              <td style={{ textAlign: "right" }}>{fmtARS(monthly[k].master || 0)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {fmtARS((monthly[k].visa || 0) + (monthly[k].master || 0))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="tbl-total">
            <td>TOTAL ACUMULADO</td>
            <td />
            <td />
            <td style={{ textAlign: "right" }}>{fmtARS(totalGeneral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TarjetasView() {
  const [visa, setVisa] = useCard({ salario: 0, cotizacion: 1200, cuotas: [], dolares: [] });
  const [master, setMaster] = useCard({ salario: 0, cotizacion: 1200, cuotas: [], dolares: [] });
  const [monthly, setMonthly] = useState({});

  React.useEffect(() => {
    const handler = (e) => {
      const key = new Date().toISOString().slice(0, 7);
      setMonthly((prev) => ({
        ...prev,
        [key]: { ...prev[key], [e.detail.name.toLowerCase()]: e.detail.total },
      }));
    };
    window.addEventListener("registrar-mes", handler);
    return () => window.removeEventListener("registrar-mes", handler);
  }, []);

  return (
    <div>
      <div className="grid-2">
        <CardPanel name="Visa" accent="#5B9BE8" card={visa} setCard={setVisa} />
        <CardPanel name="Master" accent="#E8A855" card={master} setCard={setMaster} />
      </div>
      <div className="subhead" style={{ marginTop: 28 }}>
        Total mensual (ambas tarjetas)
      </div>
      <TotalMensual monthly={monthly} />
    </div>
  );
}

// ================= PATRIMONIO =================

function AssetTable({ title, accent, rows, setRows, columns, computeRow, totalFn, addRowTemplate }) {
  const enriched = rows.map((r) => ({ ...r, ...computeRow(r, rows) }));
  const update = (id, key, val) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const del = (id) => setRows(rows.filter((r) => r.id !== id));
  const totals = totalFn(enriched);

  return (
    <div className="asset-block" style={{ borderTopColor: accent }}>
      <h3 style={{ color: accent }}>{title}</h3>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align || "left" }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => (
              <tr key={r.id}>
                {columns.map((c) =>
                  c.editable ? (
                    <Cell
                      key={c.key}
                      editable
                      type={c.type || "text"}
                      align={c.align}
                      value={r[c.key]}
                      onChange={(v) => update(r.id, c.key, v)}
                    />
                  ) : (
                    <Cell key={c.key} align={c.align} value={r[c.key]} format={c.format} />
                  )
                )}
                <td>
                  <button className="btn-del" onClick={() => del(r.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tbl-total">
              {columns.map((c, i) => (
                <td key={c.key} style={{ textAlign: c.align || "left" }}>
                  {i === 0 ? "TOTAL" : totals[c.key] !== undefined ? (c.format ? c.format(totals[c.key]) : totals[c.key]) : ""}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button className="btn-add" onClick={() => setRows([...rows, addRowTemplate()])}>
        + agregar
      </button>
    </div>
  );
}

function PatrimonioView() {
  const [cotizacion, setCotizacion] = useState(1200);

  const [cripto, setCripto] = useState([
    { id: uid(), activo: "BTC", cantidad: 0.05, precioCompra: 60000, precioActual: 65000 },
  ]);
  const [bolsa, setBolsa] = useState([
    { id: uid(), ticker: "AAPL", cantidad: 10, precioCompra: 25000, precioActual: 28000 },
  ]);
  const [usdt, setUsdt] = useState([
    { id: uid(), activo: "USDT - Exchange", cantidad: 1000, costoTotal: 1000, valorActual: 1000 },
  ]);

  const [evolucion, setEvolucion] = useState(
    MESES_KEYS.map((k) => ({ mes: k, criptoUSD: 0, dolaresUSD: 0, bolsaUSD: 0, criptoARS: 0, dolaresARS: 0, bolsaARS: 0 }))
  );

  // --- cripto ---
  const criptoCompute = (r) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precioCompra) || 0;
    const precioActual = Number(r.precioActual) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    const valorARS = valorActual * (Number(cotizacion) || 0);
    return { costoTotal, valorActual, pl, plPct, valorARS };
  };
  const criptoTotalUSD = cripto.reduce((a, r) => a + criptoCompute(r).valorActual, 0);
  const criptoTotalUSDCosto = cripto.reduce((a, r) => a + (criptoCompute(r).costoTotal || 0), 0);

  // --- bolsa ---
  const bolsaCompute = (r) => {
    const cantidad = Number(r.cantidad) || 0;
    const precioCompra = Number(r.precioCompra) || 0;
    const precioActual = Number(r.precioActual) || 0;
    const costoTotal = precioCompra ? cantidad * precioCompra : null;
    const valorActual = cantidad * precioActual;
    const pl = costoTotal !== null ? valorActual - costoTotal : null;
    const plPct = costoTotal ? pl / costoTotal : null;
    const valorUSD = cotizacion ? valorActual / Number(cotizacion) : 0;
    return { costoTotal, valorActual, pl, plPct, valorUSD };
  };
  const bolsaTotalARS = bolsa.reduce((a, r) => a + bolsaCompute(r).valorActual, 0);

  // --- usdt ---
  const usdtCompute = (r) => {
    const costoTotal = Number(r.costoTotal) || 0;
    const valorActual = Number(r.valorActual) || 0;
    const rendimiento = costoTotal ? valorActual - costoTotal : null;
    const valorARS = valorActual * (Number(cotizacion) || 0);
    return { rendimiento, valorARS };
  };
  const usdtTotalUSD = usdt.reduce((a, r) => a + (Number(r.valorActual) || 0), 0);

  const resumen = useMemo(() => {
    const criptoUSD = criptoTotalUSD;
    const bolsaUSD = cotizacion ? bolsaTotalARS / cotizacion : 0;
    const dolaresUSD = usdtTotalUSD;
    const totalUSD = criptoUSD + bolsaUSD + dolaresUSD;
    return {
      criptoUSD,
      bolsaUSD,
      dolaresUSD,
      totalUSD,
      criptoARS: criptoUSD * cotizacion,
      bolsaARS: bolsaTotalARS,
      dolaresARS: dolaresUSD * cotizacion,
      totalARS: totalUSD * cotizacion,
    };
  }, [criptoTotalUSD, bolsaTotalARS, usdtTotalUSD, cotizacion]);

  const guardarSnapshot = () => {
    const key = new Date().toISOString().slice(0, 7);
    setEvolucion((prev) => {
      const exists = prev.some((m) => m.mes === key);
      const snap = {
        mes: key,
        criptoUSD: resumen.criptoUSD,
        dolaresUSD: resumen.dolaresUSD,
        bolsaUSD: resumen.bolsaUSD,
        criptoARS: resumen.criptoARS,
        dolaresARS: resumen.dolaresARS,
        bolsaARS: resumen.bolsaARS,
      };
      if (exists) return prev.map((m) => (m.mes === key ? snap : m));
      return [...prev, snap].sort((a, b) => a.mes.localeCompare(b.mes));
    });
  };

  const chartData = evolucion.map((m) => ({
    mes: mesLabel(m.mes),
    "Total USD": m.criptoUSD + m.dolaresUSD + m.bolsaUSD,
  }));

  return (
    <div>
      <div className="stat-row" style={{ marginBottom: 20 }}>
        <label className="cotiz-input">
          Cotización dólar (CCL/MEP)
          <input type="number" value={cotizacion} onChange={(e) => setCotizacion(e.target.value)} />
        </label>
      </div>

      <AssetTable
        title="Criptomonedas"
        accent="#35D0A0"
        rows={cripto}
        setRows={setCripto}
        addRowTemplate={() => ({ id: uid(), activo: "", cantidad: 0, precioCompra: 0, precioActual: 0 })}
        columns={[
          { key: "activo", label: "Activo", editable: true },
          { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
          { key: "precioCompra", label: "Precio compra (USD)", editable: true, type: "number", align: "right" },
          { key: "precioActual", label: "Precio actual (USD)", editable: true, type: "number", align: "right" },
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

      <AssetTable
        title="Bolsa (CEDEARs / ONs)"
        accent="#5B9BE8"
        rows={bolsa}
        setRows={setBolsa}
        addRowTemplate={() => ({ id: uid(), ticker: "", cantidad: 0, precioCompra: 0, precioActual: 0 })}
        columns={[
          { key: "ticker", label: "Ticker", editable: true },
          { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right" },
          { key: "precioCompra", label: "Precio compra (ARS)", editable: true, type: "number", align: "right" },
          { key: "precioActual", label: "Precio actual (ARS)", editable: true, type: "number", align: "right" },
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

      <AssetTable
        title="Dólares cripto (USDT / stablecoins)"
        accent="#E8A855"
        rows={usdt}
        setRows={setUsdt}
        addRowTemplate={() => ({ id: uid(), activo: "", cantidad: 0, costoTotal: 0, valorActual: 0 })}
        columns={[
          { key: "activo", label: "Activo / plataforma", editable: true },
          { key: "costoTotal", label: "Costo total (USD)", editable: true, type: "number", align: "right" },
          { key: "valorActual", label: "Valor actual (USD)", editable: true, type: "number", align: "right" },
          { key: "rendimiento", label: "Rendimiento", align: "right", format: (v) => (v === null ? "—" : fmtUSD(v)) },
          { key: "valorARS", label: "Valor (ARS)", align: "right", format: fmtARS },
        ]}
        computeRow={usdtCompute}
        totalFn={(rows) => ({
          valorActual: rows.reduce((a, r) => a + (Number(r.valorActual) || 0), 0),
          valorARS: rows.reduce((a, r) => a + r.valorARS, 0),
        })}
      />

      <div className="subhead" style={{ marginTop: 28 }}>
        Resumen general del patrimonio
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Categoría</th>
              <th style={{ textAlign: "right" }}>USD</th>
              <th style={{ textAlign: "right" }}>ARS</th>
              <th style={{ textAlign: "right" }}>% patrimonio</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Criptomonedas", resumen.criptoUSD, resumen.criptoARS],
              ["Bolsa (CEDEARs/ONs)", resumen.bolsaUSD, resumen.bolsaARS],
              ["Dólares cripto", resumen.dolaresUSD, resumen.dolaresARS],
            ].map(([label, usd, ars]) => (
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

      <button className="btn-register" style={{ background: "#35D0A0", marginTop: 14 }} onClick={guardarSnapshot}>
        Guardar foto del mes actual en Evolución Mensual
      </button>

      <div className="subhead" style={{ marginTop: 28 }}>
        Evolución mensual del patrimonio (USD)
      </div>
      <div style={{ width: "100%", height: 260, marginBottom: 16 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A313B" />
            <XAxis dataKey="mes" stroke="#8B93A1" fontSize={12} />
            <YAxis stroke="#8B93A1" fontSize={12} />
            <Tooltip
              contentStyle={{ background: "#1D232B", border: "1px solid #2A313B", color: "#E8E6E1" }}
              formatter={(v) => fmtUSD(v)}
            />
            <Legend />
            <Line type="monotone" dataKey="Total USD" stroke="#35D0A0" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ================= APP =================

export default function App() {
  const [tab, setTab] = useState("tarjetas");
  return (
    <div className="app-root">
      <style>{`
        .app-root {
          background: #14181D;
          color: #E8E6E1;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          min-height: 100%;
          padding: 24px;
          box-sizing: border-box;
        }
        h1, h2, h3 { margin: 0 0 8px 0; font-weight: 600; }
        .tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #2A313B; padding-bottom: 0; }
        .tab-btn {
          background: none; border: none; color: #8B93A1; font-size: 15px; font-weight: 600;
          padding: 10px 4px; cursor: pointer; border-bottom: 2px solid transparent; margin-right: 20px;
        }
        .tab-btn.active { color: #E8E6E1; border-bottom-color: #35D0A0; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
        .card-panel, .asset-block {
          background: #1D232B; border-top: 3px solid #5B9BE8; border-radius: 10px;
          padding: 18px; margin-bottom: 20px;
        }
        .card-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
        .head-inputs { display: flex; gap: 14px; flex-wrap: wrap; }
        .head-inputs label, .cotiz-input {
          display: flex; flex-direction: column; font-size: 11px; color: #8B93A1; gap: 4px;
        }
        .head-inputs input, .cotiz-input input {
          background: #12161B; border: 1px solid #2A313B; color: #E8E6E1;
          padding: 6px 8px; border-radius: 6px; font-size: 13px; width: 120px;
        }
        .stat-row { display: flex; gap: 24px; margin: 10px 0 16px 0; }
        .stat { display: flex; flex-direction: column; }
        .stat-label { font-size: 11px; color: #8B93A1; }
        .stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .subhead { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #8B93A1; margin: 10px 0 8px 0; font-weight: 700; }
        .tbl-wrap { overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tbl th { text-align: left; color: #8B93A1; font-weight: 600; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #2A313B; white-space: nowrap; }
        .tbl td { padding: 5px 8px; border-bottom: 1px solid #21262E; font-variant-numeric: tabular-nums; }
        .cell-input { background: #12161B; border: 1px solid #2A313B; color: #5B9BE8; padding: 4px 6px; border-radius: 5px; width: 100%; min-width: 70px; font-size: 13px; }
        .cell-computed { color: #E8E6E1; }
        .tbl-total td { font-weight: 700; border-top: 1px solid #2A313B; border-bottom: none; padding-top: 8px; }
        .btn-del { background: none; border: none; color: #E85D5D; cursor: pointer; font-size: 16px; line-height: 1; }
        .btn-add { background: none; border: 1px dashed #2A313B; color: #8B93A1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px; }
        .btn-add:hover { border-color: #5B9BE8; color: #5B9BE8; }
        .btn-register { display: block; margin-top: 16px; border: none; color: #12161B; font-weight: 700; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .empty { color: #8B93A1; font-size: 13px; }
      `}</style>

      <h1>Seguimiento financiero</h1>
      <p style={{ color: "#8B93A1", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
        Prototipo — misma lógica que tus dos excels, ahora como app. Los datos viven solo en esta sesión (para probar el
        concepto); una versión real necesitaría guardar esto en una base de datos.
      </p>

      <div className="tabs">
        <button className={`tab-btn ${tab === "tarjetas" ? "active" : ""}`} onClick={() => setTab("tarjetas")}>
          Tarjetas
        </button>
        <button className={`tab-btn ${tab === "patrimonio" ? "active" : ""}`} onClick={() => setTab("patrimonio")}>
          Patrimonio
        </button>
      </div>

      {tab === "tarjetas" ? <TarjetasView /> : <PatrimonioView />}
    </div>
  );
}
