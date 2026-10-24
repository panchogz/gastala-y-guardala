import { useEffect, useRef } from "react";

// Contenedor de MobileEntryForm y de la calculadora "¿Cuotas o contado?":
// bottom sheet en mobile (≤640px), modal centrado en desktop (styles.css).
//
// Props:
// - title, accent
// - onSubmit: si viene, la caja es un <form> (Enter / "Ir" del teclado envía).
// - actions: pie fijo (botones), siempre visible arriba del teclado.
// - children: cuerpo con scroll interno.
export default function BottomSheet({ title, accent, onSubmit, actions, children }) {
  const overlayRef = useRef(null);

  // iOS: con el teclado abierto el viewport de layout no se achica, así que un
  // fixed con bottom:0 queda tapado. Se ajusta el overlay al visualViewport
  // (zona realmente visible) para que el pie con los botones quede arriba del
  // teclado. Sin visualViewport queda el 100dvh del CSS.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = overlayRef.current;
    if (!vv || !el) return;
    const update = () => {
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Sin scroll del fondo mientras el sheet está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const Box = onSubmit ? "form" : "div";
  return (
    <div className="sheet-overlay" ref={overlayRef}>
      <Box
        className="sheet-box"
        style={{ borderTopColor: accent }}
        onSubmit={onSubmit}
        noValidate={onSubmit ? true : undefined}
      >
        <h3 className="sheet-title" style={{ color: accent }}>{title}</h3>
        <div className="sheet-body">{children}</div>
        {actions && <div className="sheet-actions">{actions}</div>}
      </Box>
    </div>
  );
}
