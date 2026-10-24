import { Fragment, useState } from "react";
import {
  PROMPT_TENENCIA,
  PROMPT_TARJETA,
  extraerJson,
  validarTenencia,
  validarTarjeta,
  construirFilasTarjeta,
  fechaCierreSugerida,
  fechaDeFila,
  dedupeSuscripciones,
  moverFila,
  filasAImportar,
  avisosTotal,
  esFechaValida,
} from "../lib/importResumen.js";
import * as ahorrosApi from "../features/ahorros/api.js";
import * as tarjetasApi from "../features/tarjetas/api.js";
import { fmtARS, fmtUSD } from "../lib/helpers.js";

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

export default function ImportarResumenModal({ tipo, cuenta, tarjeta, existingRows, onImported, onClose }) {
  const [paso, setPaso] = useState(1);
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState([]);
  const [descartadas, setDescartadas] = useState(0);
  const [error, setError] = useState(null);
  const [importando, setImportando] = useState(false);
  // Solo tarjeta: fecha de cierre (precargada con la del JSON, o sugerida si
  // faltaba), si faltaba en el JSON (entonces es obligatoria) y avisos del
  // control contra el total del resumen.
  const [fechaCierre, setFechaCierre] = useState("");
  const [cierreFaltaba, setCierreFaltaba] = useState(false);
  const [avisos, setAvisos] = useState([]);

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
        const v = validarTarjeta(json);
        setFilas(construirFilasTarjeta(v.consumos, existingRows));
        setFechaCierre(v.fecha_cierre ?? fechaCierreSugerida(v.consumos));
        setCierreFaltaba(!v.fecha_cierre);
        setAvisos(avisosTotal(v.consumos, v));
        setDescartadas(v.descartadas);
      }
      setPaso(3);
    } catch (e) {
      setError(e.message);
    }
  }

  function actualizarFila(key, patch) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function mover(key) {
    setFilas((fs) => moverFila(fs, key, existingRows));
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
        // Tildadas y no ocultas por el dedupe, con la fecha calculada desde la
        // fecha de cierre actual (salvo las editadas a mano).
        const {
          cuotas: cuotasRows,
          dolares: dolaresRows,
          recurrentes: recurrentesRows,
        } = filasAImportar(filas, fechaCierre);

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

  let seleccionadas = filas.filter((f) => f.checked).length;
  if (!esTenencia) {
    const aImportar = filasAImportar(filas, fechaCierre);
    seleccionadas = aImportar.cuotas.length + aImportar.dolares.length + aImportar.recurrentes.length;
  }
  const cierreInvalido = !esTenencia && !esFechaValida(fechaCierre);
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
                fotos de tu resumen y pegá las instrucciones. Si podés, usá el PDF del resumen:
                sale más preciso que fotos o capturas.
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
              <RevisionTarjeta
                filas={filas}
                actualizarFila={actualizarFila}
                mover={mover}
                fechaCierre={fechaCierre}
                setFechaCierre={setFechaCierre}
                cierreFaltaba={cierreFaltaba}
                avisos={avisos}
              />
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
                disabled={seleccionadas === 0 || sinConexion || importando || cierreInvalido}
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

// accion: botón opcional al pie de las notas (mover entre Un pago y
// Suscripciones). Va acá y no en una columna para que no quede cortado en mobile.
function FilaNotas({ f, colSpan, extra, accion }) {
  const info = extra ? [...f.notasInfo, extra] : f.notasInfo;
  if (info.length === 0 && !f.notaWarn && !accion) return null;
  return (
    <tr className={f.color ? `import-row-${f.color}` : undefined}>
      <td></td>
      <td colSpan={colSpan}>
        {info.length > 0 && <div className="import-note import-note-info">{info.join(" · ")}</div>}
        {f.notaWarn && <div className="import-note import-note-yellow">{f.notaWarn}</div>}
        {accion}
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
            <th>Cantidad</th>
            <th>Precio compra ({cuenta.moneda})</th>
            <th>Precio actual ({cuenta.moneda})</th>
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

// Grupos entre los que se puede mover una fila ARS (cambia la tabla destino).
const DESTINO_MOVER = { un_pago: "Pasar a Suscripciones", recurrentes: "Pasar a Un pago" };

function RevisionTarjeta({ filas, actualizarFila, mover, fechaCierre, setFechaCierre, cierreFaltaba, avisos }) {
  const cierreOk = esFechaValida(fechaCierre);
  // Dedupe de suscripciones repetidas en el mismo resumen: se recalcula en cada
  // render, así que mover filas lo reevalúa solo.
  const dedupe = dedupeSuscripciones(filas);

  return (
    <>
      <div className="import-cierre">
        <label>
          <span>Fecha de cierre del resumen</span>
          <input
            className="cell-input"
            type="date"
            value={fechaCierre}
            onChange={(e) => setFechaCierre(e.target.value)}
            aria-invalid={cierreFaltaba && !cierreOk}
          />
        </label>
        <div className={`import-note ${cierreFaltaba && !cierreOk ? "import-note-red" : "import-note-info"}`}>
          {cierreFaltaba
            ? cierreOk
              ? "No venía en el resumen: sugerimos la compra más reciente. Revisala."
              : "No venía en el resumen: completala para poder importar."
            : "Las fechas de las cuotas se calculan a partir de esta fecha."}
        </div>
      </div>

      {avisos.map((a) => {
        const fmt = a.moneda === "USD" ? fmtUSD : fmtARS;
        return (
          <div key={a.moneda} className="import-aviso">
            La suma de los consumos leídos ({fmt(a.leido)}) no coincide con el total del resumen (
            {fmt(a.total)}). Puede haber un error de lectura: revisá cuotas y montos.
          </div>
        );
      })}

      {filas.length === 0 && <p className="empty">No se encontraron consumos para importar.</p>}

      {GRUPOS_TARJETA.map(({ key, titulo }) => {
        const delGrupo = filas.filter((f) => f.grupo === key && !dedupe.ocultas.has(f.key));
        if (delGrupo.length === 0) return null;
        const conMover = key in DESTINO_MOVER;
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
                    <th>{key === "dolares" ? "Monto (USD)" : "Monto"}</th>
                    {key === "cuotas_curso" && <th>Cuota</th>}
                    {key !== "recurrentes" && <th>Fecha</th>}
                  </tr>
                </thead>
                <tbody>
                  {delGrupo.map((f) => {
                    const ocurrencias = dedupe.miembros.get(f.key)?.length || 1;
                    return (
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
                                value={fechaDeFila(f, fechaCierre) || ""}
                                onChange={(e) => actualizarFila(f.key, { fechaManual: e.target.value || null })}
                              />
                            </td>
                          )}
                        </tr>
                        <FilaNotas
                          f={f}
                          colSpan={colSpanNotas}
                          extra={dedupe.notas.get(f.key)}
                          accion={
                            conMover && (
                              <button
                                type="button"
                                className="import-mover"
                                onClick={() => mover(f.key)}
                                title={
                                  ocurrencias > 1
                                    ? `Mueve las ${ocurrencias} veces que aparece, cada una como gasto propio`
                                    : undefined
                                }
                              >
                                {DESTINO_MOVER[key]}
                              </button>
                            )
                          }
                        />
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
