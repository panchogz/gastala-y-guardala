import { useEffect, useState } from "react";
import BottomSheet from "../../components/BottomSheet.jsx";
import {
  fmtARS,
  parseNumeroFlexible,
  parseDecimalInput,
  tnaAMensual,
  mensualATna,
  todayISO,
} from "../../lib/helpers.js";
import { simular, equilibrio, veredicto, TECHO_MENSUAL } from "../../lib/cuotasOContado.js";
import { fetchMaxTnaPesos } from "../ahorros/api.js";

// Calculadora "¿Cuotas o contado?". Solo cálculo (ver lib/cuotasOContado.js);
// lo único que escribe es a través del alta normal de compras de CardPanel,
// vía onCargar(tarjetaId, valores), que abre ese alta precargado.
//
// Props: tarjetas ([{ id, nombre, color }]), onCargar(tarjetaId, valores), onClose().

const ACCENT = "#5B9BE8";
const VERDE = "#35D0A0";
const ROJO = "#E85D5D";

// x ya en % (2.48 → "2,48").
const pct = (x, dec = 2) => x.toLocaleString("es-AR", { maximumFractionDigits: dec });
// Valores derivados que se muestran en un input: tienen que poder volver a
// parsearse si el usuario pasa a editar ese campo.
const pctInput = (x) => x.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false });
const montoInput = (x) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const round2 = (x) => Math.round(x * 100) / 100;

const PRESETS = [
  { key: "caja", label: "Mi caja remunerada" },
  { key: "inflacion", label: "Inflación esperada" },
  { key: "quieta", label: "Queda quieta (0%)" },
  { key: "otra", label: "Otra" },
];

const porcentajeValido = (x) => x !== null && x !== undefined && !Number.isNaN(x) && x > -100;

export default function CuotasOContado({ tarjetas, onCargar, onClose }) {
  const [contadoStr, setContadoStr] = useState("");
  const [nStr, setNStr] = useState("3");
  // Monto por cuota y recargo se derivan uno del otro: manda el último que se
  // tocó, también al cambiar la cantidad de cuotas.
  const [fuente, setFuente] = useState("cuota");
  const [cuotaStr, setCuotaStr] = useState("");
  const [recargoStr, setRecargoStr] = useState("");

  const [maxTna, setMaxTna] = useState(null);
  const [preset, setPreset] = useState(null); // null = default (caja si hay, si no quieta)
  const [inflacionStr, setInflacionStr] = useState("");
  const [otraStr, setOtraStr] = useState("");
  const [eligiendoTarjeta, setEligiendoTarjeta] = useState(null); // valores a cargar

  useEffect(() => {
    let cancelled = false;
    fetchMaxTnaPesos()
      .then((tna) => {
        if (!cancelled && tna > 0) setMaxTna(tna);
      })
      .catch(() => {}); // sin conexión o sin Pesos Líquidos: el preset queda oculto
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- entradas ----
  const contado = parseNumeroFlexible(contadoStr);
  const contadoOk = contado !== null && contado > 0;
  const nNum = parseDecimalInput(nStr);
  const n = Number.isInteger(nNum) && nNum >= 1 ? nNum : null;

  let cuota = null;
  let recargo = null;
  if (contadoOk && n) {
    if (fuente === "cuota") {
      const c = parseNumeroFlexible(cuotaStr);
      if (c !== null && c > 0) {
        cuota = c;
        recargo = ((c * n) / contado - 1) * 100;
      }
    } else {
      const r = parseDecimalInput(recargoStr);
      if (porcentajeValido(r)) {
        recargo = r;
        cuota = (contado * (1 + r / 100)) / n;
      }
    }
  }
  const valido = cuota !== null;

  // ---- tasa elegida ----
  const cajaMensualPct = maxTna ? tnaAMensual(maxTna / 100) * 100 : null;
  const presetActivo = preset ?? (cajaMensualPct !== null ? "caja" : "quieta");
  const tasaPct = {
    caja: cajaMensualPct,
    inflacion: parseDecimalInput(inflacionStr),
    quieta: 0,
    otra: parseDecimalInput(otraStr),
  }[presetActivo];
  const tasaOk = porcentajeValido(tasaPct);

  // ---- resultados ----
  const eq = valido ? equilibrio(contado, cuota, n) : null;
  const sim = valido && tasaOk ? simular(contado, cuota, n, tasaPct / 100) : null;
  const ver = sim ? veredicto(sim.sobrante, contado) : null;

  let principal = null;
  if (eq?.tipo === "tasa") {
    principal = `Conviene en cuotas si tu plata rinde más de ${pct(eq.i * 100)}% mensual (≈${pct(
      mensualATna(eq.i) * 100,
      1
    )}% TNA)`;
  } else if (eq?.tipo === "descuento") {
    principal = `Conviene en cuotas aunque tu plata no rinda nada (tienen descuento de ${pct(eq.descuentoPct, 1)}%)`;
  } else if (eq?.tipo === "techo") {
    principal = `Conviene contado salvo que tu plata rinda más de ${pct(TECHO_MENSUAL * 100)}% mensual`;
  }
  const guia =
    cajaMensualPct !== null
      ? `Quieta: 0% · tu caja: ${pct(maxTna, 1)}% TNA ≈ ${pct(cajaMensualPct)}%/mes · comparalo con un plazo fijo o la inflación esperada`
      : "Quieta: 0% · comparalo con tu caja remunerada, un plazo fijo o la inflación esperada";

  function elegir(valores) {
    const conFecha = { fecha: todayISO(), ...valores };
    if (tarjetas.length === 1) onCargar(tarjetas[0].id, conFecha);
    else setEligiendoTarjeta(conFecha);
  }

  const cerrar = (
    <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onClose}>
      Cerrar
    </button>
  );

  if (eligiendoTarjeta) {
    return (
      <BottomSheet
        title="¿En qué tarjeta la cargás?"
        accent={ACCENT}
        actions={
          <>
            <button type="button" className="login-resend" style={{ margin: 0 }} onClick={() => setEligiendoTarjeta(null)}>
              ← Volver
            </button>
            {cerrar}
          </>
        }
      >
        <p className="calc-guia" style={{ marginTop: 0 }}>
          {eligiendoTarjeta.cuotas === 1
            ? `Contado: ${fmtARS(eligiendoTarjeta.monto)}`
            : `${eligiendoTarjeta.cuotas} cuotas, total ${fmtARS(eligiendoTarjeta.monto)}`}
          . Después completás el comercio y guardás.
        </p>
        <div className="calc-tarjetas">
          {tarjetas.map((t) => (
            <button key={t.id} type="button" className="calc-tarjeta" onClick={() => onCargar(t.id, eligiendoTarjeta)}>
              <span className="manage-cards-dot" style={{ background: t.color }} />
              {t.nombre}
            </button>
          ))}
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="¿Cuotas o contado?" accent={ACCENT} actions={cerrar}>
      <div className="calc-row">
        <label className="sheet-field">
          <span>Precio contado ($)</span>
          <div className="sheet-input-row">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={contadoStr}
              onChange={(e) => setContadoStr(e.target.value)}
            />
          </div>
        </label>
        <label className="sheet-field" style={{ flex: "0 0 84px" }}>
          <span>Cuotas</span>
          <div className="sheet-input-row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={nStr}
              onChange={(e) => setNStr(e.target.value)}
              aria-invalid={nStr.trim() !== "" && !n}
            />
          </div>
        </label>
      </div>
      <div className="calc-row">
        <label className="sheet-field">
          <span>Monto por cuota ($)</span>
          <div className="sheet-input-row">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={fuente === "cuota" ? undefined : "calc-derivado"}
              value={fuente === "cuota" ? cuotaStr : cuota !== null ? montoInput(cuota) : ""}
              onChange={(e) => {
                setFuente("cuota");
                setCuotaStr(e.target.value);
              }}
            />
          </div>
        </label>
        <label className="sheet-field">
          <span>Recargo (%)</span>
          <div className="sheet-input-row">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={fuente === "recargo" ? undefined : "calc-derivado"}
              value={fuente === "recargo" ? recargoStr : recargo !== null ? pctInput(recargo) : ""}
              onChange={(e) => {
                setFuente("recargo");
                setRecargoStr(e.target.value);
              }}
            />
          </div>
        </label>
      </div>

      {!valido ? (
        <p className="calc-guia">Completá el precio contado, las cuotas y el monto por cuota (o el recargo).</p>
      ) : (
        <>
          <div className="calc-principal">
            <div className="calc-principal-texto">{principal}</div>
            <div className="calc-guia">{guia}</div>
          </div>

          <div className="calc-subtitulo">Si tu plata rinde:</div>
          <div className="calc-presets">
            {PRESETS.filter((p) => p.key !== "caja" || cajaMensualPct !== null).map((p) => (
              <button
                key={p.key}
                type="button"
                className="calc-preset"
                style={presetActivo === p.key ? { borderColor: ACCENT, color: ACCENT } : undefined}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {presetActivo === "caja" && (
            <p className="calc-hint" style={{ margin: "0 0 8px 0" }}>
              {pct(maxTna, 1)}% TNA ≈ {pct(cajaMensualPct)}% mensual (la TNA más alta de tus Pesos Líquidos)
            </p>
          )}
          {(presetActivo === "inflacion" || presetActivo === "otra") && (
            <label className="sheet-field">
              <span>{presetActivo === "inflacion" ? "Inflación esperada (% mensual)" : "Rendimiento (% mensual)"}</span>
              <div className="sheet-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={presetActivo === "inflacion" ? inflacionStr : otraStr}
                  onChange={(e) =>
                    presetActivo === "inflacion" ? setInflacionStr(e.target.value) : setOtraStr(e.target.value)
                  }
                />
              </div>
              <span className="calc-hint">
                {presetActivo === "inflacion"
                  ? "ej. expectativa REM del BCRA"
                  : tasaOk
                  ? `≈ ${pct(mensualATna(tasaPct / 100) * 100, 1)}% TNA`
                  : "ej. 2,5"}
              </span>
            </label>
          )}

          {sim && (
            <>
              <div
                className="calc-resultado"
                style={{ color: ver === "sobra" ? VERDE : ver === "falta" ? ROJO : "#E8E6E1" }}
              >
                {ver === "sobra" && `Al terminar de pagar te sobran ${fmtARS(sim.sobrante)}`}
                {ver === "falta" && `Al terminar de pagar te faltan ${fmtARS(-sim.sobrante)}`}
                {ver === "igual" && `Da prácticamente igual (diferencia de ${fmtARS(Math.abs(sim.sobrante))})`}
              </div>
              <details className="calc-detalle">
                <summary>Ver mes a mes</summary>
                <div className="tbl-wrap">
                  <table className="tbl tbl-dense">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Tenés</th>
                        <th>Cuota</th>
                        <th>Te queda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.filas.map((f) => (
                        <tr key={f.mes}>
                          <td>{f.mes}</td>
                          <td style={{ textAlign: "right" }}>{fmtARS(f.tenes)}</td>
                          <td style={{ textAlign: "right" }}>{fmtARS(f.cuota)}</td>
                          <td style={{ textAlign: "right", color: f.teQueda < 0 ? ROJO : undefined }}>
                            {fmtARS(f.teQueda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}

          <p className="calc-pie">
            Supone que la plata que no gastás queda rindiendo esa tasa durante todas las cuotas. Nunca sumar
            inflación y rendimiento.
          </p>

          {tarjetas.length > 0 && (
            <div className="calc-acciones">
              <button
                type="button"
                className="btn-register"
                style={{ background: ACCENT }}
                onClick={() => elegir({ cuotas: n, monto: round2(cuota * n) })}
              >
                Cargar como compra ({n} cuota{n === 1 ? "" : "s"})
              </button>
              <button
                type="button"
                className="calc-btn-secundario"
                onClick={() => elegir({ cuotas: 1, monto: round2(contado) })}
              >
                Cargar contado
              </button>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
