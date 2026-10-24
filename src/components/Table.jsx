export function Table({ columns, children, footer, dense }) {
  return (
    <div className="tbl-wrap">
      <table className={dense ? "tbl tbl-dense" : "tbl"}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
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

// extra: nodo opcional junto al input (ej. el punto ámbar de dato desactualizado).
export function Cell({ editable, value, onChange, onBlur, type = "text", align, format, minWidth, extra }) {
  if (!editable) {
    return (
      <td style={{ textAlign: align || "left" }} className="cell-computed">
        {format ? format(value) : value}
      </td>
    );
  }
  const input = (
    <input
      className="cell-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={minWidth ? { minWidth } : undefined}
    />
  );
  return (
    <td style={{ textAlign: align || "left" }}>
      {extra ? (
        <div className="cell-con-extra">
          {input}
          {extra}
        </div>
      ) : (
        input
      )}
    </td>
  );
}
