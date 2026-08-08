import { useEffect, useState } from "react";
import { Table, Cell } from "../../components/Table.jsx";
import { fmtARS, fmtUSD, fmtPct, fullMonthsBetween, todayISO } from "../../lib/helpers.js";
import * as api from "./api.js";

export default function CardPanel({ tarjetaId, name, accent, onRegistered }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({ salario_neto: 0, cotizacion: 1200 });
  const [cuotas, setCuotas] = useState([]);
  const [dolares, setDolares] = useState([]);
  const [recurrentes, setRecurrentes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cfg, cuotasRows, dolaresRows, recurrentesRows] = await Promise.all([
          api.fetchConfig(tarjetaId),
          api.fetchCuotas(tarjetaId),
          api.fetchDolares(tarjetaId),
          api.fetchRecurrentes(tarjetaId),
        ]);
        if (cancelled) return;
        setConfig({ salario_neto: cfg?.salario_neto ?? 0, cotizacion: cfg?.cotizacion ?? 1200 });
        setCuotas(cuotasRows);
        setDolares(dolaresRows);
        setRecurrentes(recurrentesRows);
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
  }, [tarjetaId]);

  const today = new Date();

  const cuotasEnriched = cuotas.map((r) => {
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

  const dolarEnriched = dolares.map((r) => ({
    ...r,
    montoARS: (Number(r.monto) || 0) * (Number(config.cotizacion) || 0),
  }));

  const totalCuotas = cuotasEnriched.reduce((a, r) => a + r.montoPorCuota, 0);
  const totalDolares = dolarEnriched.reduce((a, r) => a + r.montoARS, 0);
  const totalRecurrentes = recurrentes.reduce(
    (a, r) => a + (r.activo ? Number(r.monto) || 0 : 0),
    0
  );
  const totalAPagar = totalCuotas + totalDolares + totalRecurrentes;
  const pctSalario = Number(config.salario_neto) > 0 ? totalAPagar / Number(config.salario_neto) : 0;

  async function handleConfigBlur() {
    try {
      await api.saveConfig(tarjetaId, {
        salario_neto: Number(config.salario_neto) || 0,
        cotizacion: Number(config.cotizacion) || 0,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- cuotas ----
  function updateCuotaLocal(id, key, val) {
    setCuotas((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }
  async function saveCuotaRow(row) {
    try {
      await api.updateCuota(row.id, {
        fecha: row.fecha,
        comercio: row.comercio,
        monto: Number(row.monto) || 0,
        cuotas: Number(row.cuotas) || 1,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function addCuota() {
    setSaving(true);
    setError(null);
    try {
      const row = await api.insertCuota(tarjetaId, {
        fecha: todayISO(),
        comercio: "",
        monto: 0,
        cuotas: 1,
      });
      setCuotas((rows) => [row, ...rows]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function delCuota(id) {
    try {
      await api.deleteCuota(id);
      setCuotas((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- dolares ----
  function updateDolarLocal(id, key, val) {
    setDolares((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }
  async function saveDolarRow(row) {
    try {
      await api.updateDolar(row.id, {
        fecha: row.fecha,
        comercio: row.comercio,
        monto: Number(row.monto) || 0,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function addDolar() {
    setSaving(true);
    setError(null);
    try {
      const row = await api.insertDolar(tarjetaId, {
        fecha: todayISO(),
        comercio: "",
        monto: 0,
      });
      setDolares((rows) => [row, ...rows]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function delDolar(id) {
    try {
      await api.deleteDolar(id);
      setDolares((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- recurrentes ----
  function updateRecurrenteLocal(id, key, val) {
    setRecurrentes((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }
  async function saveRecurrenteRow(row) {
    try {
      await api.updateRecurrente(row.id, {
        concepto: row.concepto,
        monto: Number(row.monto) || 0,
        activo: row.activo,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function toggleRecurrenteActivo(row) {
    const activo = !row.activo;
    updateRecurrenteLocal(row.id, "activo", activo);
    try {
      await api.updateRecurrente(row.id, { activo });
    } catch (e) {
      setError(e.message);
    }
  }
  async function addRecurrente() {
    setSaving(true);
    setError(null);
    try {
      const row = await api.insertRecurrente(tarjetaId, {
        concepto: "",
        monto: 0,
        activo: true,
      });
      setRecurrentes((rows) => [...rows, row]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function delRecurrente(id) {
    try {
      await api.deleteRecurrente(id);
      setRecurrentes((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRegistrar() {
    setSaving(true);
    setError(null);
    try {
      await api.registrarMes(tarjetaId, totalAPagar);
      onRegistered?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card-panel" style={{ borderTopColor: accent }}>
        <h3 style={{ color: accent }}>{name}</h3>
        <div className="loading">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="card-panel" style={{ borderTopColor: accent }}>
      <div className="card-head">
        <h3 style={{ color: accent }}>{name}</h3>
        <div className="head-inputs">
          <label>
            Salario neto del mes
            <input
              type="number"
              value={config.salario_neto}
              onChange={(e) => setConfig((c) => ({ ...c, salario_neto: e.target.value }))}
              onBlur={handleConfigBlur}
            />
          </label>
          <label>
            Cotización dólar
            <input
              type="number"
              value={config.cotizacion}
              onChange={(e) => setConfig((c) => ({ ...c, cotizacion: e.target.value }))}
              onBlur={handleConfigBlur}
            />
          </label>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Total a pagar</span>
          <span className="stat-value">{fmtARS(totalAPagar)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">% del salario</span>
          <span className="stat-value" style={{ color: pctSalario > 0.3 ? "#E85D5D" : accent }}>
            {fmtPct(pctSalario)}
          </span>
        </div>
      </div>

      <div className="subhead">Compras en cuotas (ARS)</div>
      <Table
        dense
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
            <Cell
              editable
              type="date"
              value={r.fecha}
              onChange={(v) => updateCuotaLocal(r.id, "fecha", v)}
              onBlur={() => saveCuotaRow(r)}
            />
            <Cell
              editable
              value={r.comercio || ""}
              onChange={(v) => updateCuotaLocal(r.id, "comercio", v)}
              onBlur={() => saveCuotaRow(r)}
              inputStyle={{ minWidth: 110 }}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateCuotaLocal(r.id, "monto", v)}
              onBlur={() => saveCuotaRow(r)}
              inputStyle={{ minWidth: 90 }}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.cuotas}
              onChange={(v) => updateCuotaLocal(r.id, "cuotas", v)}
              onBlur={() => saveCuotaRow(r)}
            />
            <Cell align="right" value={r.cuotaActual} />
            <Cell align="right" value={r.cuotasPendientes} />
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
      <button className="btn-add" disabled={saving} onClick={addCuota}>
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
            <Cell
              editable
              type="date"
              value={r.fecha}
              onChange={(v) => updateDolarLocal(r.id, "fecha", v)}
              onBlur={() => saveDolarRow(r)}
            />
            <Cell
              editable
              value={r.comercio || ""}
              onChange={(v) => updateDolarLocal(r.id, "comercio", v)}
              onBlur={() => saveDolarRow(r)}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateDolarLocal(r.id, "monto", v)}
              onBlur={() => saveDolarRow(r)}
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
      <button className="btn-add" disabled={saving} onClick={addDolar}>
        + gasto en dólares
      </button>

      <div className="subhead" style={{ marginTop: 18 }}>
        Gastos recurrentes / Suscripciones
      </div>
      <Table
        columns={[
          { key: "concepto", label: "Concepto" },
          { key: "monto", label: "Monto", align: "right" },
          { key: "activo", label: "Activo", align: "center" },
        ]}
        footer={
          <tr className="tbl-total">
            <td>TOTALES</td>
            <td style={{ textAlign: "right" }}>{fmtARS(totalRecurrentes)}</td>
            <td />
            <td />
          </tr>
        }
      >
        {recurrentes.map((r) => (
          <tr key={r.id}>
            <Cell
              editable
              value={r.concepto || ""}
              onChange={(v) => updateRecurrenteLocal(r.id, "concepto", v)}
              onBlur={() => saveRecurrenteRow(r)}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateRecurrenteLocal(r.id, "monto", v)}
              onBlur={() => saveRecurrenteRow(r)}
            />
            <td style={{ textAlign: "center" }}>
              <input
                type="checkbox"
                checked={!!r.activo}
                onChange={() => toggleRecurrenteActivo(r)}
              />
            </td>
            <td>
              <button className="btn-del" onClick={() => delRecurrente(r.id)}>
                ×
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <button className="btn-add" disabled={saving} onClick={addRecurrente}>
        + agregar suscripción
      </button>

      <button
        className="btn-register"
        style={{ background: accent }}
        disabled={saving}
        onClick={handleRegistrar}
      >
        Registrar este mes en el total mensual
      </button>
    </div>
  );
}
