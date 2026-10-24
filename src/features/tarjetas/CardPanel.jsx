import { useEffect, useState } from "react";
import { Table, Cell } from "../../components/Table.jsx";
import ImportarResumenModal from "../../components/ImportarResumenModal.jsx";
import MobileEntryForm from "../../components/MobileEntryForm.jsx";
import { fmtARS, fmtUSD, fmtPct, cuotaInfo, todayISO } from "../../lib/helpers.js";
import { useIsMobile } from "../../lib/useIsMobile.js";
import * as api from "./api.js";

// Campos del alta mobile (MobileEntryForm) de cada tabla. OJO: acá las celdas
// editables de la tabla están escritas a mano en el JSX (<Cell> más abajo), no
// salen de esta config — si se agrega/saca/renombra un campo editable, hay que
// mantener sincronizados ambos lados. Montos ≠ 0 en cuotas y dólares
// (reintegros/bonificaciones vienen negativos); > 0 en recurrentes. El
// "activo" de recurrentes no va en el form: se da de alta siempre activo.
const ENTRY_FIELDS = {
  cuotas: {
    title: "Agregar compra en cuotas",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true, initial: todayISO },
      { key: "comercio", label: "Comercio", required: true },
      { key: "monto", label: "Monto (ARS)", type: "number", required: true, nonZero: true },
      { key: "cuotas", label: "Cuotas", type: "number", integer: true, min: 1 },
    ],
  },
  dolares: {
    title: "Agregar gasto en dólares",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true, initial: todayISO },
      { key: "comercio", label: "Comercio", required: true },
      { key: "monto", label: "Monto (USD)", type: "number", required: true, nonZero: true },
    ],
  },
  recurrentes: {
    title: "Agregar suscripción",
    fields: [
      { key: "concepto", label: "Concepto", required: true },
      { key: "monto", label: "Monto (ARS)", type: "number", required: true, gt: 0 },
    ],
  },
};

export default function CardPanel({ tarjetaId, name, accent, onRegistered }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({ salario_neto: 0, cotizacion: 1200 });
  const [cuotas, setCuotas] = useState([]);
  const [dolares, setDolares] = useState([]);
  const [recurrentes, setRecurrentes] = useState([]);

  // Modal de importación de resumen (Etapa 2). Ver FEATURE_importacion_resumenes.md.
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  // Alta mobile abierta: null | "cuotas" | "dolares" | "recurrentes".
  const isMobile = useIsMobile();
  const [entryTable, setEntryTable] = useState(null);

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
    const { activa, cuotaActual, cuotasPendientes, montoPorCuota } = cuotaInfo(r, today);
    const saldoPagado = montoPorCuota * cuotaActual;
    const saldoPendiente = montoPorCuota * cuotasPendientes;
    return { ...r, activa, cuotaActual, cuotasPendientes, montoPorCuota, saldoPagado, saldoPendiente };
  });

  const dolarEnriched = dolares.map((r) => ({
    ...r,
    montoARS: (Number(r.monto) || 0) * (Number(config.cotizacion) || 0),
  }));

  // Solo las compras con una cuota en este mes: las ya terminadas (cuota N+1
  // en adelante) siguen en la tabla pero no suman al total.
  const totalCuotas = cuotasEnriched.reduce((a, r) => a + (r.activa ? r.montoPorCuota : 0), 0);
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
  // values: solo desde MobileEntryForm (pisa los defaults). Sin args inserta
  // la fila vacía de siempre. Tira el error: lo maneja runAdd (desktop) o el form.
  async function addCuota(values) {
    const row = await api.insertCuota(tarjetaId, {
      fecha: todayISO(),
      comercio: "",
      monto: 0,
      cuotas: 1,
      ...values,
    });
    setCuotas((rows) => [row, ...rows]);
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
  async function addDolar(values) {
    const row = await api.insertDolar(tarjetaId, {
      fecha: todayISO(),
      comercio: "",
      monto: 0,
      ...values,
    });
    setDolares((rows) => [row, ...rows]);
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
  async function addRecurrente(values) {
    const row = await api.insertRecurrente(tarjetaId, {
      concepto: "",
      monto: 0,
      activo: true,
      ...values,
    });
    setRecurrentes((rows) => [...rows, row]);
  }

  const ADD_FN = { cuotas: addCuota, dolares: addDolar, recurrentes: addRecurrente };

  // "+ agregar": en desktop inserta la fila vacía (con el mismo manejo de
  // saving/error de siempre); en mobile abre el form de alta.
  async function handleAddClick(table) {
    if (isMobile) {
      setEntryTable(table);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ADD_FN[table]();
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

  function handleImportado({ cuotas: nuevasCuotas, dolares: nuevosDolares, recurrentes: nuevosRecurrentes }) {
    if (nuevasCuotas.length) setCuotas((rows) => [...nuevasCuotas, ...rows]);
    if (nuevosDolares.length) setDolares((rows) => [...nuevosDolares, ...rows]);
    if (nuevosRecurrentes.length) setRecurrentes((rows) => [...rows, ...nuevosRecurrentes]);
    const total = nuevasCuotas.length + nuevosDolares.length + nuevosRecurrentes.length;
    setImportMsg(`Se importaron ${total} consumo${total === 1 ? "" : "s"}.`);
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

      <button
        className="btn-import"
        style={{ marginLeft: 0 }}
        onClick={() => {
          setImportMsg(null);
          setImportOpen(true);
        }}
      >
        Importar resumen
      </button>

      {error && <div className="error-banner">{error}</div>}
      {importMsg && <div className="success-banner">{importMsg}</div>}

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
        {/* Celdas editables a mano: mantener sincronizadas con ENTRY_FIELDS.cuotas (arriba). */}
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
              minWidth={140}
            />
            <Cell
              editable
              type="number"
              align="right"
              value={r.monto}
              onChange={(v) => updateCuotaLocal(r.id, "monto", v)}
              onBlur={() => saveCuotaRow(r)}
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
      <button className="btn-add" disabled={saving} onClick={() => handleAddClick("cuotas")}>
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
        {/* Celdas editables a mano: mantener sincronizadas con ENTRY_FIELDS.dolares (arriba). */}
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
              minWidth={140}
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
      <button className="btn-add" disabled={saving} onClick={() => handleAddClick("dolares")}>
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
        {/* Celdas editables a mano: mantener sincronizadas con ENTRY_FIELDS.recurrentes (arriba). */}
        {recurrentes.map((r) => (
          <tr key={r.id}>
            <Cell
              editable
              value={r.concepto || ""}
              onChange={(v) => updateRecurrenteLocal(r.id, "concepto", v)}
              onBlur={() => saveRecurrenteRow(r)}
              minWidth={140}
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
      <button className="btn-add" disabled={saving} onClick={() => handleAddClick("recurrentes")}>
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

      {entryTable && (
        <MobileEntryForm
          title={ENTRY_FIELDS[entryTable].title}
          accent={accent}
          fields={ENTRY_FIELDS[entryTable].fields}
          onSubmit={async (values) => {
            await ADD_FN[entryTable](values);
            setEntryTable(null);
          }}
          onCancel={() => setEntryTable(null)}
        />
      )}

      {importOpen && (
        <ImportarResumenModal
          tipo="tarjeta"
          tarjeta={{ id: tarjetaId, nombre: name }}
          existingRows={{ cuotas, dolares, recurrentes }}
          onImported={handleImportado}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
