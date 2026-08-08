export function Table({ columns, children, footer, dense, fixedLayout }) {
  const classes = ["tbl"];
  if (dense) classes.push("tbl-dense");
  if (fixedLayout) classes.push("tbl-fixed");
  return (
    <div className="tbl-wrap">
      <table className={classes.join(" ")}>
        {fixedLayout && (
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            <col style={{ width: 32 }} />
          </colgroup>
        )}
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

export function Cell({ editable, value, onChange, onBlur, type = "text", align, format, inputStyle }) {
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
        style={inputStyle}
      />
    </td>
  );
}
