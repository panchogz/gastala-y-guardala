import { Table, Cell } from "../../components/Table.jsx";

export default function AssetTable({
  title,
  accent,
  rows,
  setRows,
  columns,
  computeRow,
  totalFn,
  fields,
  onAdd,
  onUpdate,
  onDelete,
  dense,
}) {
  const enriched = rows.map((r) => ({ ...r, ...computeRow(r) }));
  const totals = totalFn(enriched);

  function updateLocal(id, key, val) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }

  async function saveRow(row) {
    const patch = {};
    for (const f of fields) patch[f] = row[f];
    await onUpdate(row.id, patch);
  }

  async function add() {
    const row = await onAdd();
    setRows((rs) => [row, ...rs]);
  }

  async function del(id) {
    await onDelete(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <div className="asset-block" style={{ borderTopColor: accent }}>
      <h3 style={{ color: accent }}>{title}</h3>
      <Table
        dense={dense}
        columns={columns}
        footer={
          <tr className="tbl-total">
            {columns.map((c, i) => (
              <td key={c.key} style={{ textAlign: c.align || "left" }}>
                {i === 0
                  ? "TOTAL"
                  : totals[c.key] !== undefined
                  ? c.format
                    ? c.format(totals[c.key])
                    : totals[c.key]
                  : ""}
              </td>
            ))}
            <td />
          </tr>
        }
      >
        {enriched.map((r) => (
          <tr key={r.id}>
            {columns.map((c) =>
              c.editable ? (
                <Cell
                  key={c.key}
                  editable
                  type={c.type || "text"}
                  align={c.align}
                  value={r[c.key] ?? ""}
                  onChange={(v) => updateLocal(r.id, c.key, v)}
                  onBlur={() => saveRow(r)}
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
      </Table>
      <button className="btn-add" onClick={add}>
        + agregar
      </button>
    </div>
  );
}
