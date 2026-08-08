export function Table({ columns, children, footer, dense }) {
  return (
    <div className="tbl-wrap">
      <table className={dense ? "tbl tbl-dense" : "tbl"}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left" }}>
                {c.label}
              </th>
            ))}
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export function Cell({ editable, value, onChange, onBlur, type = "text", align, format }) {
  if (!editable) {
    return (
      <td style={{ textAlign: align || "left" }} className="cell-computed">
        {format ? format(value) : value}
      </td>
    );
  }
  return (
    <td style={{ textAlign: align || "left" }}>
      <input
        className="cell-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </td>
  );
}
