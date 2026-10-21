import { Fragment, useState } from "react";
import { PROMPT_TENENCIA, extraerJson, validarTenencia } from "../lib/importResumen.js";
import * as ahorrosApi from "../features/ahorros/api.js";

// Importación de tenencia (Etapa 1) vía chat de IA externo, a una cuenta de
// ahorro de tipo "bolsa" o "cripto". Ver FEATURE_importacion_resumenes.md:
// el archivo nunca pasa por la app, solo el texto que el usuario pegue del
// chat que haya usado.
//
// Props:
// - cuenta: { id, nombre, moneda, tipo } — tipo "bolsa" o "cripto".
// - existingRows: filas ya cargadas en esa cuenta (para marcar duplicados).
// - onImported(filas): se llama con las filas insertadas, para refrescar.
// - onClose()
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

export default function ImportarResumenModal({ cuenta, existingRows, onImported, onClose }) {
  const [paso, setPaso] = useState(1);
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState([]);
  const [descartadas, setDescartadas] = useState(0);
  const [error, setError] = useState(null);
  const [importando, setImportando] = useState(false);

  const campo = CAMPO_NOMBRE[cuenta.tipo];
  const etiquetaCampo = cuenta.tipo === "bolsa" ? "Ticker" : "Activo";

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_TENENCIA);
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
      const { activos, descartadas: n } = validarTenencia(json);
      setFilas(construirFilasRevision(activos, cuenta, existingRows));
      setDescartadas(n);
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
      const rows = seleccionadas.map((f) => ({
        [campo]: f.ticker,
        cantidad: Number(f.cantidad) || 0,
        precio_compra: f.precio_compra === null ? 0 : Number(f.precio_compra) || 0,
        precio_actual: Number(f.precio_actual) || 0,
      }));
      const inserted = await API_DE_TIPO[cuenta.tipo].insertMany(cuenta.id, rows);
      onImported(inserted);
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
        <h3 style={{ marginTop: 0 }}>Importar resumen — {cuenta.nombre}</h3>

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
            <pre className="import-prompt">{PROMPT_TENENCIA}</pre>
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
            {filas.length === 0 ? (
              <p className="empty">No se encontraron activos para importar.</p>
            ) : (
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
