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
import ImportarResumenModal from "../../components/ImportarResumenModal.jsx";
import { Table, Cell } from "../../components/Table.jsx";
import { fmtARS, fmtUSD, fmtPct, fmtCompact, mesLabel, mesLabelLargo, todayISO } from "../../lib/helpers.js";
import * as api from "./api.js";

function apiForTipo(tipo) {
  if (tipo === "bolsa") return api.bolsaApi;
  if (tipo === "cripto") return api.criptoApi;
  if (tipo === "pesos") return api.pesosApi;
  return api.usdtApi;
}

const TIPO_ACCENT = { bolsa: "#5B9BE8", cripto: "#35D0A0", usdt: "#E8A855", pesos: "#C77DFF" };
// Orden fijo de tipos (Bolsa → Cripto → USD/Stable → Pesos), independiente del
// orden de creación de las cuentas. Dentro de cada tipo, cuentas y activos van
// alfabéticos.
const TIPO_ORDEN = { bolsa: 0, cripto: 1, usdt: 2, pesos: 3 };

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

  // Cuenta (bolsa/cripto) para la que está abierto ImportarResumenModal, o
  // null si está cerrado. Ver FEATURE_importacion_resumenes.md — Etapa 1.
  const [importCuenta, setImportCuenta] = useState(null);
  const [importMsg, setImportMsg] = useState(null);

  const [cotizacion, setCotizacion] = useState(1200);
  const [cotizacionUsdt, setCotizacionUsdt] = useState(1200);
  const [evolucionCuenta, setEvolucionCuenta] = useState([]);
  const [monedaEvolucion, setMonedaEvolucion] = useState("USD");
  // Buffer local de edición de TNA por fila (id -> string tipeado). Mientras se
  // edita NO se toca activosPorCuenta, así el "cierre" de interés (ver
  // handleTasaBlur) siempre calcula con la tasa/saldo/fecha viejos, no con lo
  // que el usuario todavía está tipeando.
  const [editingTasa, setEditingTasa] = useState({});
  // Mismo criterio para "Saldo aportado (USD)" (saldo_usd): siempre visible con
  // su valor guardado, editable in place. Subir el valor = aporte nuevo (cierra
  // capitalizando interés antes de sumar la diferencia); bajarlo = corrección
  // directa del saldo (no capitaliza, no toca fecha_ultimo_calculo).
  const [editingSaldo, setEditingSaldo] = useState({});
  // Mismos buffers que arriba, pero para Pesos Líquidos (tabla/campos propios,
  // no comparten filas con USD/Stable — separados solo por prolijidad).
  const [editingTasaPesos, setEditingTasaPesos] = useState({});
  const [editingSaldoPesos, setEditingSaldoPesos] = useState({});

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

  function handleImportado(cuentaId, filasInsertadas) {
    setRowsFor(cuentaId)((rows) => [...filasInsertadas, ...rows]);
    setImportMsg(
      `Se importaron ${filasInsertadas.length} activo${filasInsertadas.length === 1 ? "" : "s"}.`
    );
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
  const cuentasPesos = cuentas.filter((c) => c.tipo === "pesos").sort(porNombre);

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

  // ---- usdt: interés compuesto diario sobre TNA, calculado en vivo al
  // renderizar (no se guarda el saldo día a día) — usa la cotización USDT,
  // no la CCL/MEP. saldo_usd es el capital "cerrado" a fecha_ultimo_calculo
  // (la última vez que se agregaron fondos o se cambió la tasa); saldoActual
  // es ese capital capitalizado día a día hasta hoy. ----
  const diasEntre = (desdeISO, hastaISO) => {
    if (!desdeISO) return 0;
    const ms = new Date(hastaISO) - new Date(desdeISO);
    return Math.max(0, Math.round(ms / 86400000));
  };
  const usdtCompute = (r) => {
    const saldoUsd = Number(r.saldo_usd) || 0;
    const tasaAnual = Number(r.tasa_anual) || 0;
    const dias = diasEntre(r.fecha_ultimo_calculo, todayISO());
    const saldoActual = saldoUsd * Math.pow(1 + tasaAnual / 100 / 365, dias);
    const rendimiento = saldoActual - saldoUsd;
    const valorARS = saldoActual * (Number(cotizacionUsdt) || 0);
    return { saldoActual, rendimiento, valorARS };
  };
  const usdtTotalUSD = rowsOfTipo(cuentasUsdt).reduce(
    (a, r) => a + usdtCompute(r).saldoActual,
    0
  );

  async function addUsdt(cuentaId) {
    try {
      const row = await api.usdtApi.insert(cuentaId, {
        activo: "",
        tasa_anual: 0,
        saldo_usd: 0,
        fecha_ultimo_calculo: todayISO(),
      });
      setRowsFor(cuentaId)((rows) => [row, ...rows]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function delUsdt(cuentaId, id) {
    try {
      await api.usdtApi.remove(id);
      setRowsFor(cuentaId)((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveUsdtActivo(id, activo) {
    try {
      await api.usdtApi.update(id, { activo });
    } catch (e) {
      setError(e.message);
    }
  }

  // "Cerrar" el cálculo antes de cambiar la tasa: el saldo_actual computado con
  // la tasa VIEJA hasta hoy pasa a ser el nuevo saldo_usd, fecha_ultimo_calculo
  // se actualiza a hoy, y recién ahí se guarda la tasa nueva. r llega con sus
  // valores tal cual están guardados (no editados) porque mientras se tipea la
  // tasa nueva no se toca activosPorCuenta, solo el buffer editingTasa.
  async function handleTasaBlur(cuentaId, r) {
    const editValue = editingTasa[r.id];
    if (editValue === undefined) return;
    setEditingTasa((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    const nuevaTasa = Number(editValue) || 0;
    if (nuevaTasa === (Number(r.tasa_anual) || 0)) return; // sin cambio real, no "cerrar" al pedo
    const { saldoActual } = usdtCompute(r);
    const patch = { saldo_usd: saldoActual, fecha_ultimo_calculo: todayISO(), tasa_anual: nuevaTasa };
    try {
      await api.usdtApi.update(r.id, patch);
      setRowsFor(cuentaId)((rows) => rows.map((row) => (row.id === r.id ? { ...row, ...patch } : row)));
    } catch (e) {
      setError(e.message);
    }
  }

  // "Saldo aportado" (saldo_usd en USD/Stable, saldo_ars en Pesos) editado in
  // place: cualquier valor que se escriba (suba o baje) pasa a ser la base
  // nueva de cálculo, con fecha_ultimo_calculo reseteada a hoy — sin
  // capitalizar nada acá. No hace falta: quien edita este campo está
  // reemplazando el saldo tal cual, no aportando una diferencia; si quiere
  // conservar el interés generado hasta hoy antes de un retiro, el número a
  // escribir es el que ya se ve en "Saldo actual" (columna de al lado) menos
  // lo retirado. Comparte la misma mecánica entre USD/Stable y Pesos —
  // cambia solo el nombre del campo de saldo y la API de la tabla.
  async function handleSaldoAportadoBlur({ row, editValue, campoSaldo, tableApi, setRows }) {
    const nuevoValor = Number(editValue) || 0;
    const valorViejo = Number(row[campoSaldo]) || 0;
    if (nuevoValor === valorViejo) return; // sin cambio real
    const patch = { [campoSaldo]: nuevoValor, fecha_ultimo_calculo: todayISO() };
    try {
      await tableApi.update(row.id, patch);
      setRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSaldoBlur(cuentaId, r) {
    const editValue = editingSaldo[r.id];
    if (editValue === undefined) return;
    setEditingSaldo((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    await handleSaldoAportadoBlur({
      row: r,
      editValue,
      campoSaldo: "saldo_usd",
      tableApi: api.usdtApi,
      setRows: setRowsFor(cuentaId),
    });
  }

  // ---- pesos (caja de ahorro remunerada): mismísimo mecanismo que USD/Stable
  // arriba, capitalización diaria sobre TNA, pero en ARS y con conversión a
  // USD vía la cotización dólar (CCL/MEP) en vez de la de USDT. ----
  const pesosCompute = (r) => {
    const saldoArs = Number(r.saldo_ars) || 0;
    const tasaTna = Number(r.tasa_tna) || 0;
    const dias = diasEntre(r.fecha_ultimo_calculo, todayISO());
    const saldoActual = saldoArs * Math.pow(1 + tasaTna / 100 / 365, dias);
    const rendimiento = saldoActual - saldoArs;
    const valorUSD = cotizacion ? saldoActual / Number(cotizacion) : 0;
    return { saldoActual, rendimiento, valorUSD };
  };
  const pesosTotalARS = rowsOfTipo(cuentasPesos).reduce(
    (a, r) => a + pesosCompute(r).saldoActual,
    0
  );

  async function addPesos(cuentaId) {
    try {
      const row = await api.pesosApi.insert(cuentaId, {
        activo: "",
        tasa_tna: 0,
        saldo_ars: 0,
        fecha_ultimo_calculo: todayISO(),
      });
      setRowsFor(cuentaId)((rows) => [row, ...rows]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function delPesos(cuentaId, id) {
    try {
      await api.pesosApi.remove(id);
      setRowsFor(cuentaId)((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function savePesosActivo(id, activo) {
    try {
      await api.pesosApi.update(id, { activo });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleTasaPesosBlur(cuentaId, r) {
    const editValue = editingTasaPesos[r.id];
    if (editValue === undefined) return;
    setEditingTasaPesos((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    const nuevaTasa = Number(editValue) || 0;
    if (nuevaTasa === (Number(r.tasa_tna) || 0)) return;
    const { saldoActual } = pesosCompute(r);
    const patch = { saldo_ars: saldoActual, fecha_ultimo_calculo: todayISO(), tasa_tna: nuevaTasa };
    try {
      await api.pesosApi.update(r.id, patch);
      setRowsFor(cuentaId)((rows) => rows.map((row) => (row.id === r.id ? { ...row, ...patch } : row)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSaldoPesosBlur(cuentaId, r) {
    const editValue = editingSaldoPesos[r.id];
    if (editValue === undefined) return;
    setEditingSaldoPesos((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    await handleSaldoAportadoBlur({
      row: r,
      editValue,
      campoSaldo: "saldo_ars",
      tableApi: api.pesosApi,
      setRows: setRowsFor(cuentaId),
    });
  }

  const resumen = useMemo(() => {
    const criptoUSD = criptoTotalUSD;
    const bolsaUSD = cotizacion ? bolsaTotalARS / cotizacion : 0;
    const dolaresUSD = usdtTotalUSD;
    const pesosUSD = cotizacion ? pesosTotalARS / cotizacion : 0;
    const totalUSD = criptoUSD + bolsaUSD + dolaresUSD + pesosUSD;
    const criptoARS = criptoUSD * cotizacionUsdt;
    const bolsaARS = bolsaTotalARS;
    const dolaresARS = dolaresUSD * cotizacionUsdt;
    const pesosARS = pesosTotalARS;
    return {
      criptoUSD,
      bolsaUSD,
      dolaresUSD,
      pesosUSD,
      totalUSD,
      criptoARS,
      bolsaARS,
      dolaresARS,
      pesosARS,
      totalARS: criptoARS + bolsaARS + dolaresARS + pesosARS,
    };
  }, [criptoTotalUSD, bolsaTotalARS, usdtTotalUSD, pesosTotalARS, cotizacion, cotizacionUsdt]);

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
    if (c.tipo === "pesos") {
      const ars = rows.reduce((a, r) => a + pesosCompute(r).saldoActual, 0);
      const usd = rows.reduce((a, r) => a + pesosCompute(r).valorUSD, 0);
      return { usd, ars };
    }
    const usd = rows.reduce((a, r) => a + usdtCompute(r).saldoActual, 0);
    const ars = rows.reduce((a, r) => a + usdtCompute(r).valorARS, 0);
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
    } else if (c.tipo === "pesos") {
      activos = rows.map((r) => {
        const { saldoActual, valorUSD } = pesosCompute(r);
        return { id: r.id, label: r.activo || "—", usd: valorUSD, ars: saldoActual };
      });
    } else {
      activos = rows.map((r) => {
        const { saldoActual, valorARS } = usdtCompute(r);
        return { id: r.id, label: r.activo || "—", usd: saldoActual, ars: valorARS };
      });
    }
    return sortByLabel(activos, "label");
  }

  const gruposResumen = [
    { tipo: "bolsa", cuentas: cuentasBolsa },
    { tipo: "cripto", cuentas: cuentasCripto },
    { tipo: "usdt", cuentas: cuentasUsdt },
    { tipo: "pesos", cuentas: cuentasPesos },
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
      {importMsg && <div className="success-banner">{importMsg}</div>}

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
                onAdd={(values) =>
                  api.bolsaApi.insert(c.id, {
                    ticker: "",
                    cantidad: 0,
                    precio_compra: 0,
                    precio_actual: 0,
                    ...values,
                  })
                }
                onUpdate={(id, patch) => api.bolsaApi.update(id, patch)}
                onDelete={(id) => api.bolsaApi.remove(id)}
                onImport={() => {
                  setImportMsg(null);
                  setImportCuenta({ id: c.id, nombre: c.nombre, moneda: c.moneda, tipo: "bolsa" });
                }}
                columns={[
                  // required/gt/min: reglas del alta mobile (MobileEntryForm); la tabla las ignora.
                  { key: "ticker", label: "Ticker", editable: true, required: true },
                  { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right", required: true, gt: 0 },
                  { key: "precio_compra", label: `Precio compra (${c.moneda})`, editable: true, type: "number", align: "right", min: 0 },
                  { key: "precio_actual", label: `Precio actual (${c.moneda})`, editable: true, type: "number", align: "right", min: 0 },
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
                onAdd={(values) =>
                  api.criptoApi.insert(c.id, {
                    activo: "",
                    cantidad: 0,
                    precio_compra: 0,
                    precio_actual: 0,
                    ...values,
                  })
                }
                onUpdate={(id, patch) => api.criptoApi.update(id, patch)}
                onDelete={(id) => api.criptoApi.remove(id)}
                onImport={() => {
                  setImportMsg(null);
                  setImportCuenta({ id: c.id, nombre: c.nombre, moneda: c.moneda, tipo: "cripto" });
                }}
                columns={[
                  // required/gt/min: reglas del alta mobile (MobileEntryForm); la tabla las ignora.
                  { key: "activo", label: "Activo", editable: true, required: true },
                  { key: "cantidad", label: "Cantidad", editable: true, type: "number", align: "right", required: true, gt: 0 },
                  { key: "precio_compra", label: `Precio compra (${c.moneda})`, editable: true, type: "number", align: "right", min: 0 },
                  { key: "precio_actual", label: `Precio actual (${c.moneda})`, editable: true, type: "number", align: "right", min: 0 },
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

          {cuentasUsdt.map((c) => {
            const rows = sortByLabel(activosPorCuenta[c.id] || [], "activo");
            const totals = rows.reduce(
              (acc, r) => {
                const { saldoActual, rendimiento, valorARS } = usdtCompute(r);
                acc.saldoActual += saldoActual;
                acc.rendimiento += rendimiento;
                acc.valorARS += valorARS;
                return acc;
              },
              { saldoActual: 0, rendimiento: 0, valorARS: 0 }
            );
            return (
              <div className="asset-block" style={{ borderTopColor: c.color }} key={c.id}>
                <h3 style={{ color: c.color }}>{c.nombre}</h3>
                <Table
                  columns={[
                    { key: "activo", label: "Activo / plataforma" },
                    { key: "saldoAportado", label: "Saldo aportado (USD)", align: "right" },
                    { key: "tasa", label: "TNA (%)", align: "right" },
                    { key: "saldo", label: "Saldo actual (USD)", align: "right" },
                    { key: "rendimiento", label: "Rendimiento (USD)", align: "right" },
                    { key: "ars", label: "Valor (ARS)", align: "right" },
                  ]}
                  footer={
                    <tr className="tbl-total">
                      <td colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(totals.saldoActual)}</td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(totals.rendimiento)}</td>
                      <td style={{ textAlign: "right" }}>{fmtARS(totals.valorARS)}</td>
                      <td />
                    </tr>
                  }
                >
                  {rows.map((r) => {
                    const { saldoActual, rendimiento, valorARS } = usdtCompute(r);
                    return (
                      <tr key={r.id}>
                        <Cell
                          editable
                          value={r.activo || ""}
                          onChange={(v) =>
                            setRowsFor(c.id)((rs) => rs.map((row) => (row.id === r.id ? { ...row, activo: v } : row)))
                          }
                          onBlur={() => saveUsdtActivo(r.id, r.activo || "")}
                        />
                        <Cell
                          editable
                          type="number"
                          align="right"
                          value={editingSaldo[r.id] ?? r.saldo_usd ?? 0}
                          onChange={(v) => setEditingSaldo((prev) => ({ ...prev, [r.id]: v }))}
                          onBlur={() => handleSaldoBlur(c.id, r)}
                        />
                        <Cell
                          editable
                          type="number"
                          align="right"
                          value={editingTasa[r.id] ?? r.tasa_anual ?? 0}
                          onChange={(v) => setEditingTasa((prev) => ({ ...prev, [r.id]: v }))}
                          onBlur={() => handleTasaBlur(c.id, r)}
                        />
                        <Cell align="right" value={saldoActual} format={fmtUSD} />
                        <Cell align="right" value={rendimiento} format={fmtUSD} />
                        <Cell align="right" value={valorARS} format={fmtARS} />
                        <td>
                          <button className="btn-del" onClick={() => delUsdt(c.id, r.id)}>
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                <button className="btn-add" onClick={() => addUsdt(c.id)}>
                  + agregar
                </button>
              </div>
            );
          })}

          {cuentasPesos.map((c) => {
            const rows = sortByLabel(activosPorCuenta[c.id] || [], "activo");
            const totals = rows.reduce(
              (acc, r) => {
                const { saldoActual, rendimiento, valorUSD } = pesosCompute(r);
                acc.saldoActual += saldoActual;
                acc.rendimiento += rendimiento;
                acc.valorUSD += valorUSD;
                return acc;
              },
              { saldoActual: 0, rendimiento: 0, valorUSD: 0 }
            );
            return (
              <div className="asset-block" style={{ borderTopColor: c.color }} key={c.id}>
                <h3 style={{ color: c.color }}>{c.nombre}</h3>
                <Table
                  columns={[
                    { key: "activo", label: "Activo / plataforma" },
                    { key: "saldoAportado", label: "Saldo aportado (ARS)", align: "right" },
                    { key: "tasa", label: "TNA (%)", align: "right" },
                    { key: "saldo", label: "Saldo actual (ARS)", align: "right" },
                    { key: "rendimiento", label: "Rendimiento (ARS)", align: "right" },
                    { key: "usd", label: "Valor (USD)", align: "right" },
                  ]}
                  footer={
                    <tr className="tbl-total">
                      <td colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: "right" }}>{fmtARS(totals.saldoActual)}</td>
                      <td style={{ textAlign: "right" }}>{fmtARS(totals.rendimiento)}</td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(totals.valorUSD)}</td>
                      <td />
                    </tr>
                  }
                >
                  {rows.map((r) => {
                    const { saldoActual, rendimiento, valorUSD } = pesosCompute(r);
                    return (
                      <tr key={r.id}>
                        <Cell
                          editable
                          value={r.activo || ""}
                          onChange={(v) =>
                            setRowsFor(c.id)((rs) => rs.map((row) => (row.id === r.id ? { ...row, activo: v } : row)))
                          }
                          onBlur={() => savePesosActivo(r.id, r.activo || "")}
                        />
                        <Cell
                          editable
                          type="number"
                          align="right"
                          value={editingSaldoPesos[r.id] ?? r.saldo_ars ?? 0}
                          onChange={(v) => setEditingSaldoPesos((prev) => ({ ...prev, [r.id]: v }))}
                          onBlur={() => handleSaldoPesosBlur(c.id, r)}
                        />
                        <Cell
                          editable
                          type="number"
                          align="right"
                          value={editingTasaPesos[r.id] ?? r.tasa_tna ?? 0}
                          onChange={(v) => setEditingTasaPesos((prev) => ({ ...prev, [r.id]: v }))}
                          onBlur={() => handleTasaPesosBlur(c.id, r)}
                        />
                        <Cell align="right" value={saldoActual} format={fmtARS} />
                        <Cell align="right" value={rendimiento} format={fmtARS} />
                        <Cell align="right" value={valorUSD} format={fmtUSD} />
                        <td>
                          <button className="btn-del" onClick={() => delPesos(c.id, r.id)}>
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                <button className="btn-add" onClick={() => addPesos(c.id)}>
                  + agregar
                </button>
              </div>
            );
          })}
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
                  <th>USD</th>
                  <th>ARS</th>
                  <th>% de la cuenta</th>
                  <th>% del total</th>
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
                      tickFormatter={fmtCompact}
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
                        <th key={c.id}>{c.nombre}</th>
                      ))}
                      <th>Total {monedaEvolucion}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesesEvolucion.map((mes) => {
                      const rowsDelMes = evolucionCuenta.filter((r) => r.mes === mes);
                      const total = rowsDelMes.reduce((a, r) => a + (Number(r[campoEvolucion]) || 0), 0);
                      return (
                        <tr key={mes}>
                          <td style={{ whiteSpace: "nowrap" }}>{mesLabelLargo(mes.slice(0, 7))}</td>
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

      {importCuenta && (
        <ImportarResumenModal
          tipo="tenencia"
          cuenta={importCuenta}
          existingRows={activosPorCuenta[importCuenta.id] || []}
          onImported={(filas) => handleImportado(importCuenta.id, filas)}
          onClose={() => setImportCuenta(null)}
        />
      )}
    </div>
  );
}
