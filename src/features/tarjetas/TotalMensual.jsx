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
import {
  fmtARS,
  fmtCompact,
  mesLabel,
  mesLabelCorto,
  mesLabelLargo,
  currentMonthISO,
  ventanaMeses,
} from "../../lib/helpers.js";
import { useIsMobile } from "../../lib/useIsMobile.js";

// Sufijo del dataKey del tramo futuro (punteado) de cada tarjeta.
const FUT = "__fut";
const MESES_FUTUROS = 3;
// Ventanas por calendario (relativas al mes actual M).
const GRAFICO_MESES_ATRAS = 2; // gráfico: M−2..M (+ M+1..M+3 comprometido)
const TABLA_MESES_ATRAS = 11; // tabla: M−11..M (12 meses)

function ChartTooltip({ active, payload, tarjetas }) {
  if (!active || !payload?.length) return null;
  // Se lee del punto y no del payload: en el mes actual cada tarjeta tiene dos
  // series (sólida y punteada) con el mismo valor y saldría repetida.
  const p = payload[0].payload;
  const valores = tarjetas
    .map((t) => ({ t, v: p[t.id] ?? p[t.id + FUT] }))
    .filter((x) => x.v !== undefined);
  const filas = valores.map(({ t, v }) => (
    <div key={t.id} style={{ color: t.color }}>
      {t.nombre}: {fmtARS(v)}
    </div>
  ));
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">
        {p.mes}
        {p.kind === "live" && " · en vivo"}
      </div>
      {p.kind === "fut" ? (
        <>
          {valores.length > 1 && filas}
          <div className="chart-tooltip-strong">
            Mínimo ya comprometido: {fmtARS(valores.reduce((a, x) => a + x.v, 0))}
          </div>
        </>
      ) : (
        filas
      )}
    </div>
  );
}

export default function TotalMensual({ rows, tarjetas, live = {} }) {
  const isMobile = useIsMobile();

  // rows: [{ mes: '2026-08-01', tarjeta_id: '...', total: 12345 }, ...]
  const byMonth = {};
  for (const r of rows) {
    const key = r.mes.slice(0, 7);
    byMonth[key] ??= {};
    byMonth[key][r.tarjeta_id] = Number(r.total) || 0;
  }
  const keys = Object.keys(byMonth).sort();

  // Gráfico: ventana por calendario M−2..M. Los meses anteriores muestran la
  // foto registrada (un mes sin foto queda como hueco, no se une la línea); el
  // mes actual va en vivo aunque tenga foto (así empalma sin salto con el
  // futuro, que también es en vivo), y M+1..M+3 son compromisos ya asumidos
  // (punteado). El punto del mes actual lo comparten ambas series.
  const mesActual = currentMonthISO().slice(0, 7);
  const hayLive = tarjetas.some((t) => live[t.id]);

  const chartData = ventanaMeses(-GRAFICO_MESES_ATRAS, -1).map((k) => {
    const point = { key: k, mes: mesLabel(k), kind: "hist" };
    for (const t of tarjetas) {
      const v = byMonth[k]?.[t.id];
      if (v !== undefined) point[t.id] = v;
    }
    return point;
  });
  {
    const point = { key: mesActual, mes: mesLabel(mesActual), kind: hayLive ? "live" : "hist" };
    for (const t of tarjetas) {
      const v = live[t.id]?.actual ?? byMonth[mesActual]?.[t.id];
      if (v === undefined) continue;
      point[t.id] = v;
      if (live[t.id]) point[t.id + FUT] = v;
    }
    chartData.push(point);
  }
  if (hayLive) {
    ventanaMeses(1, MESES_FUTUROS).forEach((key, i) => {
      const point = { key, mes: mesLabel(key), kind: "fut" };
      for (const t of tarjetas) {
        if (live[t.id]) point[t.id + FUT] = live[t.id].futuros[i];
      }
      chartData.push(point);
    });
  }

  const hayDatosGrafico = chartData.some((p) => tarjetas.some((t) => p[t.id] !== undefined || p[t.id + FUT] !== undefined));
  if (!hayDatosGrafico) {
    return (
      <p className="empty">
        Todavía no registraste ningún mes. Usá el botón "Registrar" en cada tarjeta.
      </p>
    );
  }

  // Tabla: fotos registradas de M−11..M; "Total 12 meses" suma solo esas filas.
  // Las filas "Comprometido" (M+1..M+3) van aparte y no entran en ningún total.
  const desdeTabla = ventanaMeses(-TABLA_MESES_ATRAS, -TABLA_MESES_ATRAS)[0];
  const keysTabla = keys.filter((k) => k >= desdeTabla && k <= mesActual);
  const totalTabla = keysTabla.reduce(
    (a, k) => a + tarjetas.reduce((s, t) => s + (byMonth[k][t.id] || 0), 0),
    0
  );
  const filasComprometido = hayLive
    ? ventanaMeses(1, MESES_FUTUROS).map((key, i) => {
        const porTarjeta = Object.fromEntries(tarjetas.map((t) => [t.id, live[t.id]?.futuros[i]]));
        const total = tarjetas.reduce((a, t) => a + (porTarjeta[t.id] || 0), 0);
        return { key, porTarjeta, total };
      })
    : [];

  const legendPayload = tarjetas.map((t) => ({
    id: t.id,
    value: t.nombre,
    type: "line",
    color: t.color,
    payload: {},
  }));
  if (hayLive) {
    legendPayload.push({
      id: "comprometido",
      value: "Comprometido (no incluye compras futuras)",
      type: "plainline",
      color: "#8B93A1",
      payload: { strokeDasharray: "5 4" },
    });
  }

  return (
    <div>
      <div style={{ width: "100%", height: isMobile ? 250 : 260, marginBottom: 20 }}>
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={isMobile ? { top: 5, right: 8, left: 0, bottom: 0 } : { top: 5, right: 64, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A313B" />
            <XAxis
              dataKey="key"
              // En mobile el formato corto de la tabla ("10/26"): "oct 26" no entra
              // sin que Recharts saltee meses.
              tickFormatter={isMobile ? mesLabelCorto : mesLabel}
              stroke="#8B93A1"
              fontSize={isMobile ? 10 : 12}
              padding={isMobile ? { left: 8, right: 8 } : { left: 16, right: 16 }}
              minTickGap={4}
            />
            <YAxis
              width={isMobile ? 44 : 64}
              stroke="#8B93A1"
              fontSize={isMobile ? 10 : 12}
              tickFormatter={(v) => fmtCompact(v, { usarK: isMobile })}
            />
            <Tooltip content={<ChartTooltip tarjetas={tarjetas} />} />
            <Legend
              payload={legendPayload}
              wrapperStyle={
                isMobile ? { left: 0, right: 0, width: "auto", fontSize: 11 } : { left: 64, right: 64, width: "auto" }
              }
            />
            {/* Sin animación: los totales en vivo cambian con cada tecla en las tablas. */}
            {tarjetas.map((t) => (
              <Line
                key={t.id}
                type="monotone"
                dataKey={t.id}
                name={t.nombre}
                stroke={t.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
            {tarjetas.map((t) => (
              <Line
                key={t.id + FUT}
                type="monotone"
                dataKey={t.id + FUT}
                name={t.nombre}
                stroke={t.color}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.5}
                dot={{ r: 3, strokeOpacity: 0.5, fillOpacity: 0.5 }}
                legendType="none"
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {keysTabla.length === 0 && (
        <p className="empty">
          Todavía no registraste ningún mes. Usá el botón "Registrar" en cada tarjeta.
        </p>
      )}
      {(keysTabla.length > 0 || filasComprometido.length > 0) && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mes</th>
                {tarjetas.map((t) => (
                  <th key={t.id}>{t.nombre}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {keysTabla.map((k) => {
                const total = tarjetas.reduce((s, t) => s + (byMonth[k][t.id] || 0), 0);
                return (
                  <tr key={k}>
                    <td style={{ whiteSpace: "nowrap" }}>{mesLabelLargo(k)}</td>
                    {tarjetas.map((t) => (
                      <td key={t.id} style={{ textAlign: "right" }}>
                        {fmtARS(byMonth[k][t.id] || 0)}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtARS(total)}</td>
                  </tr>
                );
              })}
              {keysTabla.length > 0 && (
                <tr className="tbl-total">
                  <td style={{ whiteSpace: "nowrap" }}>TOTAL 12 MESES</td>
                  {tarjetas.map((t) => (
                    <td key={t.id} />
                  ))}
                  <td style={{ textAlign: "right" }}>{fmtARS(totalTabla)}</td>
                </tr>
              )}
              {filasComprometido.length > 0 && (
                <tr className="tbl-comprometido-titulo">
                  <td colSpan={tarjetas.length + 2}>Comprometido (no incluye compras futuras)</td>
                </tr>
              )}
              {filasComprometido.map((f) => (
                <tr key={f.key} className="tbl-comprometido">
                  <td style={{ whiteSpace: "nowrap" }}>{mesLabelLargo(f.key)}</td>
                  {tarjetas.map((t) => (
                    <td key={t.id} style={{ textAlign: "right" }}>
                      {f.porTarjeta[t.id] === undefined ? "—" : fmtARS(f.porTarjeta[t.id])}
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>{fmtARS(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
