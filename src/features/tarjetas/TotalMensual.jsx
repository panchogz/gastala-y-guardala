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
import { fmtARS, mesLabel, mesLabelCorto } from "../../lib/helpers.js";

export default function TotalMensual({ rows, tarjetas }) {
  // rows: [{ mes: '2026-08-01', tarjeta_id: '...', total: 12345 }, ...]
  const byMonth = {};
  for (const r of rows) {
    const key = r.mes.slice(0, 7);
    byMonth[key] ??= {};
    byMonth[key][r.tarjeta_id] = Number(r.total) || 0;
  }
  const keys = Object.keys(byMonth).sort();

  if (keys.length === 0) {
    return (
      <p className="empty">
        Todavía no registraste ningún mes. Usá el botón "Registrar" en cada tarjeta.
      </p>
    );
  }

  const totalGeneral = keys.reduce(
    (a, k) => a + tarjetas.reduce((s, t) => s + (byMonth[k][t.id] || 0), 0),
    0
  );

  const chartData = keys.map((k) => {
    const point = { mes: mesLabel(k) };
    for (const t of tarjetas) point[t.nombre] = byMonth[k][t.id] || 0;
    return point;
  });

  return (
    <div>
      <div style={{ width: "100%", height: 260, marginBottom: 20 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 5, right: 64, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A313B" />
            <XAxis dataKey="mes" stroke="#8B93A1" fontSize={12} padding={{ left: 16, right: 16 }} />
            <YAxis
              width={64}
              stroke="#8B93A1"
              fontSize={12}
              label={{ value: "ARS", angle: -90, position: "insideLeft", fill: "#8B93A1", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ background: "#1D232B", border: "1px solid #2A313B", color: "#E8E6E1" }}
              formatter={(v) => fmtARS(v)}
            />
            <Legend wrapperStyle={{ left: 64, right: 64, width: "auto" }} />
            {tarjetas.map((t) => (
              <Line
                key={t.id}
                type="monotone"
                dataKey={t.nombre}
                stroke={t.color}
                strokeWidth={2}
                dot={{ r: 3 }}
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
              {tarjetas.map((t) => (
                <th key={t.id} style={{ textAlign: "right" }}>
                  {t.nombre}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const total = tarjetas.reduce((s, t) => s + (byMonth[k][t.id] || 0), 0);
              return (
                <tr key={k}>
                  <td>{mesLabelCorto(k)}</td>
                  {tarjetas.map((t) => (
                    <td key={t.id} style={{ textAlign: "right" }}>
                      {fmtARS(byMonth[k][t.id] || 0)}
                    </td>
                  ))}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtARS(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tbl-total">
              <td>TOTAL ACUMULADO</td>
              {tarjetas.map((t) => (
                <td key={t.id} />
              ))}
              <td style={{ textAlign: "right" }}>{fmtARS(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
