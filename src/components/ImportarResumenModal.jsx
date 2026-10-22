import { Fragment, useState } from "react";
import {
  PROMPT_TENENCIA,
  PROMPT_TARJETA,
  extraerJson,
  validarTenencia,
  validarTarjeta,
  restarMeses,
} from "../lib/importResumen.js";
import * as ahorrosApi from "../features/ahorros/api.js";
import * as tarjetasApi from "../features/tarjetas/api.js";

// Importación de resúmenes vía chat de IA externo — tenencia (Etapa 1) a una
// cuenta de ahorro, y tarjeta (Etapa 2) a una tarjeta. Ver
// FEATURE_importacion_resumenes.md: el archivo nunca pasa por la app, solo
// el texto que el usuario pegue del chat que haya usado.
//
// Props comunes:
// - tipo: "tenencia" | "tarjeta"
// - onImported(resultado): filas insertadas, para refrescar sin recargar todo.
// - onClose()
//
// tipo === "tenencia":
// - cuenta: { id, nombre, moneda, tipo } — tipo "bolsa" o "cripto".
// - existingRows: array de filas ya cargadas en esa cuenta (duplicados).
//
// tipo === "tarjeta":
// - tarjeta: { id, nombre }.
// - existingRows: { cuotas, dolares, recurrentes } (cada uno array; duplicados).
const CAMPO_NOMBRE = { bolsa: "ticker", cripto: "activo" };
const API_DE_TIPO = { bolsa: ahorrosApi.bolsaApi, cripto: ahorrosApi.criptoApi };

function construirFilasRevision(activos, cuenta, existingRows) {
  const campo = CAMPO_NOMBRE[cuenta.tipo];
  const existentes = new Set(
    (existingRows || []).map((r) => String(r[campo] || "").trim().toLowerCase())
  );

  return activos.map((a, i) => {
    let precioCompra = a.precio_compra;
    let precioActual = a.precio_actual;
    if (precioActual === null && a.valor_total !== null && a.cantidad) {
      precioActual = a.valor_total / a.cantidad;
    }

    const notas = [];
    let roja = false;

    // Consistencia cantidad × precio vs. valor_total (bonos/ONs informados
    // cada 100 nominales se detectan y ajustan solos).
    if (a.valor_total && precioActual !== null) {
      const calculado = a.cantidad * precioActual;
      const diff = Math.abs(calculado - a.valor_total) / a.valor_total;
      if (diff > 0.05) {
        const diffCada100 = Math.abs(calculado - 100 * a.valor_total) / (100 * a.valor_total);
        if (diffCada100 <= 0.05) {
          precioActual = precioActual / 100;
          if (precioCompra !== null) precioCompra = precioCompra / 100;
          notas.push("Precio ajustado: venía cada 100 nominales");
        } else {
          notas.push(
            `Cantidad × precio no coincide con el valor total del resumen (${a.valor_total}). Revisá el precio`
          );
        }
      }
    }

    const monedaFila = a.moneda ?? cuenta.moneda;
    if (monedaFila !== cuenta.moneda) {
      roja = true;
      notas.unshift(`Precio en ${monedaFila}, esta cuenta es en ${cuenta.moneda}`);
    }

    const duplicado = existentes.has(a.ticker.trim().toLowerCase());
    if (duplicado) {
      notas.push(`Ya existe un activo "${a.ticker}" en esta cuenta`);
    }

    if (precioCompra === null) {
      notas.push("Sin precio de compra: el P&L no se calcula hasta que lo completes");
    }

    return {
      key: `${a.ticker}-${i}`,
      checked: !roja && !duplicado,
      ticker: a.ticker,
      cantidad: a.cantidad,
      precio_compra: precioCompra,
      precio_actual: precioActual,
      notas,
      color: roja ? "red" : notas.length > 0 ? "yellow" : null,
    };
  });
}

// true si ya existe una fila con el mismo nombre (comercio/concepto, trim +
// case-insensitive) y el mismo monto (±1 centavo, por redondeos).
function existeDuplicado(lista, campo, nombre, monto) {
  const n = String(nombre || "").trim().toLowerCase();
  return (lista || []).some(
    (r) =>
      String(r[campo] || "").trim().toLowerCase() === n &&
      Math.abs((Number(r.monto) || 0) - monto) < 0.01
  );
}

// Reparte los consumos del resumen en los 4 grupos de revisión de la
// tarjeta y calcula fecha/monto de cada uno (ver FEATURE_importacion_resumenes.md
// — Etapa 2). notaInfo es solo informativa (no afecta el color de la fila);
// notaWarn marca duplicados (amarilla).
function construirFilasTarjeta(consumos, fechaCierre, existingRows) {
  const ex = existingRows || {};
  const cuotasExist = ex.cuotas || [];
  const dolaresExist = ex.dolares || [];
  const recurrentesExist = ex.recurrentes || [];

  return consumos.map((c, i) => {
    const notasInfo = [];
    let notaWarn = null;
    let grupo, fecha, monto, cuotas, checked;

    if (c.es_suscripcion && c.moneda !== "USD") {
      grupo = "recurrentes";
      monto = c.monto_cuota;
      checked = true;
      if (existeDuplicado(recurrentesExist, "concepto", c.comercio, monto)) {
        notaWarn = `Ya existe una suscripción "${c.comercio}" con ese monto`;
        checked = false;
      }
    } else if (c.es_suscripcion) {
      // USD: no hay recurrentes en esa moneda, se ofrece como gasto puntual.
      grupo = "dolares";
      fecha = c.fecha_compra ?? fechaCierre;
      monto = c.monto_cuota;
      checked = true;
      notasInfo.push("Suscripción en USD: se importa como gasto en dólares (no hay recurrentes en esa moneda)");
      if (existeDuplicado(dolaresExist, "comercio", c.comercio, monto)) {
        notaWarn = `Ya existe un gasto en dólares "${c.comercio}" con ese monto`;
        checked = false;
      }
    } else if (c.moneda === "USD") {
      grupo = "dolares";
      fecha = c.fecha_compra ?? fechaCierre;
      monto = c.monto_cuota;
      checked = true;
      if (existeDuplicado(dolaresExist, "comercio", c.comercio, monto)) {
        notaWarn = `Ya existe un gasto en dólares "${c.comercio}" con ese monto`;
        checked = false;
      }
    } else if (c.cuotas_total > 1) {
      grupo = "cuotas_curso";
      cuotas = c.cuotas_total;
      monto = c.monto_cuota * c.cuotas_total;
      fecha = restarMeses(fechaCierre, c.cuota_actual - 1);
      checked = true;
      if (c.fecha_compra) notasInfo.push(`Compra original: ${c.fecha_compra}`);
      if (c.cuota_actual === c.cuotas_total) notasInfo.push("Última cuota");
      if (existeDuplicado(cuotasExist, "comercio", c.comercio, monto)) {
        notaWarn = `Ya existe una compra "${c.comercio}" con ese monto`;
        checked = false;
      }
    } else {
      grupo = "un_pago";
      cuotas = 1;
      monto = c.monto_cuota;
      fecha = c.fecha_compra ?? fechaCierre;
      checked = false;
      notasInfo.push("Ya están en este resumen; importalo solo si todavía no lo pagaste");
      if (existeDuplicado(cuotasExist, "comercio", c.comercio, monto)) {
        notaWarn = `Ya existe una compra "${c.comercio}" con ese monto`;
      }
    }

    return {
      key: `${grupo}-${c.comercio}-${i}`,
      grupo,
      checked,
      comercio: c.comercio,
      fecha,
      monto,
      cuotas,
      cuota_actual: c.cuota_actual,
      cuotas_total: c.cuotas_total,
      notasInfo,
      notaWarn,
      color: notaWarn ? "yellow" : null,
    };
  });
}

export default function ImportarResumenModal({ tipo, cuenta, tarjeta, existingRows, onImported, onClose }) {
  const [paso, setPaso] = useState(1);
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState([]);
  const [descartadas, setDescartadas] = useState(0);
  const [error, setError] = useState(null);
  const [importando, setImportando] = useState(false);

  const esTenencia = tipo === "tenencia";
  const prompt = esTenencia ? PROMPT_TENENCIA : PROMPT_TARJETA;
  const nombreContexto = esTenencia ? cuenta.nombre : tarjeta.nombre;

  const campo = esTenencia ? CAMPO_NOMBRE[cuenta.tipo] : null;
  const etiquetaCampo = esTenencia ? (cuenta.tipo === "bolsa" ? "Ticker" : "Activo") : null;

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná el texto de arriba y copialo a mano.");
    }
  }

  function continuar() {
    setError(null);
    try {
      const json = extraerJson(texto);
      if (esTenencia) {
        const { activos, descartadas: n } = validarTenencia(json);
        setFilas(construirFilasRevision(activos, cuenta, existingRows));
        setDescartadas(n);
      } else {
        const { fecha_cierre, consumos, descartadas: n } = validarTarjeta(json);
        setFilas(construirFilasTarjeta(consumos, fecha_cierre, existingRows));
        setDescartadas(n);
      }
      setPaso(3);
    } catch (e) {
      setError(e.message);
    }
  }

  function actualizarFila(key, patch) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function importar() {
    setImportando(true);
    setError(null);
    try {
      const seleccionadas = filas.filter((f) => f.checked);
      if (esTenencia) {
        const rows = seleccionadas.map((f) => ({
          [campo]: f.ticker,
          cantidad: Number(f.cantidad) || 0,
          precio_compra: f.precio_compra === null ? 0 : Number(f.precio_compra) || 0,
          precio_actual: Number(f.precio_actual) || 0,
        }));
        const inserted = await API_DE_TIPO[cuenta.tipo].insertMany(cuenta.id, rows);
        onImported(inserted);
      } else {
        const cuotasRows = seleccionadas
          .filter((f) => f.grupo === "cuotas_curso" || f.grupo === "un_pago")
          .map((f) => ({
            fecha: f.fecha,
            comercio: f.comercio,
            monto: Number(f.monto) || 0,
            cuotas: Number(f.cuotas) || 1,
          }));
        const dolaresRows = seleccionadas
          .filter((f) => f.grupo === "dolares")
          .map((f) => ({ fecha: f.fecha, comercio: f.comercio, monto: Number(f.monto) || 0 }));
        const recurrentesRows = seleccionadas
          .filter((f) => f.grupo === "recurrentes")
          .map((f) => ({ concepto: f.comercio, monto: Number(f.monto) || 0, activo: true }));

        const [cuotasIns, dolaresIns, recurrentesIns] = await Promise.all([
          cuotasRows.length ? tarjetasApi.insertManyCuotas(tarjeta.id, cuotasRows) : Promise.resolve([]),
          dolaresRows.length ? tarjetasApi.insertManyDolares(tarjeta.id, dolaresRows) : Promise.resolve([]),
          recurrentesRows.length
            ? tarjetasApi.insertManyRecurrentes(tarjeta.id, recurrentesRows)
            : Promise.resolve([]),
        ]);
        onImported({ cuotas: cuotasIns, dolares: dolaresIns, recurrentes: recurrentesIns });
      }
      onClose();
    } catch (e) {
      setError(e.message);
      setImportando(false);
    }
  }

  const seleccionadas = filas.filter((f) => f.checked).length;
  const sinConexion = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Importar resumen — {nombreContexto}</h3>

        {paso === 1 && (
          <>
            <ol className="import-steps">
              <li>Copiá estas instrucciones.</li>
              <li>
                Abrí el chat de IA que uses (Claude, ChatGPT, Gemini…), adjuntá el PDF o las
                fotos de tu resumen y pegá las instrucciones.
              </li>
              <li>Copiá la respuesta completa y pegala en el siguiente paso.</li>
            </ol>
            <div className="offline-banner" style={{ display: "block" }}>
              Tu resumen se procesa en el chat que elijas, no en Gastala y Guardala. Revisá las
              condiciones de privacidad de ese servicio. La app solo recibe el texto que pegues.
            </div>
            <pre className="import-prompt">{prompt}</pre>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
              <button className="btn-register" style={{ background: "#5B9BE8", marginTop: 0 }} onClick={copiarPrompt}>
                {copiado ? "Copiado ✓" : "Copiar instrucciones"}
              </button>
              <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn-register"
                style={{ background: "#35D0A0", marginTop: 0, marginLeft: "auto" }}
                onClick={() => setPaso(2)}
              >
                Ya tengo la respuesta →
              </button>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <p className="empty" style={{ marginTop: 0 }}>Pegá acá la respuesta del chat:</p>
            <textarea
              className="import-textarea"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pegá acá la respuesta del chat"
              rows={10}
            />
            {error && <div className="error-banner" style={{ marginTop: 14, marginBottom: 0 }}>{error}</div>}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
              <button type="button" className="login-resend" style={{ margin: 0 }} onClick={() => setPaso(1)}>
                Volver
              </button>
              <button
                className="btn-register"
                style={{ background: "#35D0A0", marginTop: 0, marginLeft: "auto" }}
                disabled={!texto.trim()}
                onClick={continuar}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            {descartadas > 0 && (
              <p className="empty" style={{ marginTop: 0 }}>
                Se ignoraron {descartadas} fila{descartadas === 1 ? "" : "s"} incompleta
                {descartadas === 1 ? "" : "s"}.
              </p>
            )}

            {esTenencia ? (
              <RevisionTenencia filas={filas} etiquetaCampo={etiquetaCampo} cuenta={cuenta} actualizarFila={actualizarFila} />
            ) : (
              <RevisionTarjeta filas={filas} actualizarFila={actualizarFila} />
            )}

            {sinConexion && (
              <div className="offline-banner" style={{ marginTop: 14 }}>
                Sin conexión: hace falta estar online para importar.
              </div>
            )}
            {error && <div className="error-banner" style={{ marginTop: 14, marginBottom: 0 }}>{error}</div>}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
              <button type="button" className="login-resend" style={{ margin: 0 }} onClick={() => setPaso(2)} disabled={importando}>
                Volver
              </button>
              <button
                className="btn-register"
                style={{ background: "#35D0A0", marginTop: 0, marginLeft: "auto" }}
                disabled={seleccionadas === 0 || sinConexion || importando}
                onClick={importar}
              >
                {importando ? "Importando…" : `Importar ${seleccionadas}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilaNotas({ f, colSpan }) {
  if (f.notasInfo.length === 0 && !f.notaWarn) return null;
  return (
    <tr className={f.color ? `import-row-${f.color}` : undefined}>
      <td></td>
      <td colSpan={colSpan}>
        {f.notasInfo.length > 0 && (
          <div className="import-note import-note-info">{f.notasInfo.join(" · ")}</div>
        )}
        {f.notaWarn && <div className="import-note import-note-yellow">{f.notaWarn}</div>}
      </td>
    </tr>
  );
}

function RevisionTenencia({ filas, etiquetaCampo, cuenta, actualizarFila }) {
  if (filas.length === 0) return <p className="empty">No se encontraron activos para importar.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl tbl-dense">
        <thead>
          <tr>
            <th></th>
            <th>{etiquetaCampo}</th>
            <th style={{ textAlign: "right" }}>Cantidad</th>
            <th style={{ textAlign: "right" }}>Precio compra ({cuenta.moneda})</th>
            <th style={{ textAlign: "right" }}>Precio actual ({cuenta.moneda})</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <Fragment key={f.key}>
              <tr className={f.color ? `import-row-${f.color}` : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={f.checked}
                    onChange={(e) => actualizarFila(f.key, { checked: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={f.ticker}
                    onChange={(e) => actualizarFila(f.key, { ticker: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="number"
                    style={{ textAlign: "right" }}
                    value={f.cantidad}
                    onChange={(e) => actualizarFila(f.key, { cantidad: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="number"
                    style={{ textAlign: "right" }}
                    value={f.precio_compra ?? ""}
                    onChange={(e) =>
                      actualizarFila(f.key, {
                        precio_compra: e.target.value === "" ? null : e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="number"
                    style={{ textAlign: "right" }}
                    value={f.precio_actual ?? ""}
                    onChange={(e) => actualizarFila(f.key, { precio_actual: e.target.value })}
                  />
                </td>
              </tr>
              {f.notas.length > 0 && (
                <tr className={f.color ? `import-row-${f.color}` : undefined}>
                  <td></td>
                  <td colSpan={4} className={`import-note import-note-${f.color || "yellow"}`}>
                    {f.notas.join(" · ")}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GRUPOS_TARJETA = [
  { key: "cuotas_curso", titulo: "Compras en cuotas (ARS)" },
  { key: "un_pago", titulo: "Gastos en un pago (ARS)" },
  { key: "dolares", titulo: "Gastos en dólares" },
  { key: "recurrentes", titulo: "Suscripciones" },
];

function RevisionTarjeta({ filas, actualizarFila }) {
  if (filas.length === 0) return <p className="empty">No se encontraron consumos para importar.</p>;

  return (
    <>
      {GRUPOS_TARJETA.map(({ key, titulo }) => {
        const delGrupo = filas.filter((f) => f.grupo === key);
        if (delGrupo.length === 0) return null;
        const colSpanNotas = 2 + (key === "cuotas_curso" ? 1 : 0) + (key !== "recurrentes" ? 1 : 0);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div className="subhead">{titulo}</div>
            <div className="tbl-wrap">
              <table className="tbl tbl-dense">
                <thead>
                  <tr>
                    <th></th>
                    <th>{key === "recurrentes" ? "Concepto" : "Comercio"}</th>
                    <th style={{ textAlign: "right" }}>{key === "dolares" ? "Monto (USD)" : "Monto"}</th>
                    {key === "cuotas_curso" && <th style={{ textAlign: "right" }}>Cuota</th>}
                    {key !== "recurrentes" && <th>Fecha</th>}
                  </tr>
                </thead>
                <tbody>
                  {delGrupo.map((f) => (
                    <Fragment key={f.key}>
                      <tr className={f.color ? `import-row-${f.color}` : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            checked={f.checked}
                            onChange={(e) => actualizarFila(f.key, { checked: e.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input"
                            value={f.comercio}
                            onChange={(e) => actualizarFila(f.key, { comercio: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input"
                            type="number"
                            style={{ textAlign: "right" }}
                            value={f.monto}
                            onChange={(e) => actualizarFila(f.key, { monto: e.target.value })}
                          />
                        </td>
                        {key === "cuotas_curso" && (
                          <td style={{ textAlign: "right" }} className="cell-computed">
                            {f.cuota_actual} de {f.cuotas_total}
                          </td>
                        )}
                        {key !== "recurrentes" && (
                          <td>
                            <input
                              className="cell-input"
                              type="date"
                              value={f.fecha || ""}
                              onChange={(e) => actualizarFila(f.key, { fecha: e.target.value })}
                            />
                          </td>
                        )}
                      </tr>
                      <FilaNotas f={f} colSpan={colSpanNotas} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
