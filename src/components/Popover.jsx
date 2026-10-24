import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Popover chico anclado a un botón: lo usan HelpTip ("?") y DatoViejo (punto
// ámbar). Se abre con tap/click (no hover, tiene que andar con el dedo) y se
// cierra al tocar afuera, con Escape o al hacer scroll.
//
// Va en un portal a <body> con position: fixed: varios anclajes viven en
// tablas con scroll horizontal (.tbl-wrap), que lo recortarían.
//
// Props: anchorRef (el botón que lo abre), onClose, label (aria), children.
// El padre lo monta solo mientras está abierto.
const GUTTER = 12;
const ANCHO_MAX = 260;

export default function Popover({ anchorRef, onClose, label, children }) {
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const r = anchorRef.current.getBoundingClientRect();
    const ancho = Math.min(ANCHO_MAX, window.innerWidth - 2 * GUTTER);
    const left = Math.min(Math.max(GUTTER, r.left + r.width / 2 - ancho / 2), window.innerWidth - GUTTER - ancho);
    // Abajo del ancla; si no entra, arriba.
    const alto = popRef.current?.offsetHeight ?? 0;
    const abajo = r.bottom + 8;
    const top = abajo + alto > window.innerHeight - GUTTER ? Math.max(GUTTER, r.top - 8 - alto) : abajo;
    setPos({ left, top, width: ancho });
  }, [anchorRef]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={popRef}
      className="help-pop"
      role="dialog"
      aria-label={label}
      style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body
  );
}
