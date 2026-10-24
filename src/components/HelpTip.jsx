import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buscarPregunta } from "../content/ayuda.js";
import { useAyuda } from "./Ayuda.jsx";

// "?" chico junto a un label: al tocarlo (no hover, tiene que andar con el
// dedo) abre un popover con el tip de la pregunta de ayuda.js y un link a esa
// pregunta en el modal de Ayuda. Se cierra al tocar afuera, con Escape o al
// hacer scroll.
//
// El popover va en un portal a <body> con position: fixed: varios HelpTip
// viven en encabezados de tablas con scroll horizontal (.tbl-wrap), que lo
// recortarían.
//
// Props: id (pregunta de ayuda.js), variante (clave de `tips`, si la pregunta
// tiene más de un tip).
const GUTTER = 12;
const ANCHO_MAX = 260;

export default function HelpTip({ id, variante }) {
  const { abrirAyuda } = useAyuda();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const pregunta = buscarPregunta(id);
  const texto = (variante && pregunta?.tips?.[variante]) || pregunta?.tip;

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current.getBoundingClientRect();
    const ancho = Math.min(ANCHO_MAX, window.innerWidth - 2 * GUTTER);
    const left = Math.min(Math.max(GUTTER, r.left + r.width / 2 - ancho / 2), window.innerWidth - GUTTER - ancho);
    // Abajo del ícono; si no entra, arriba.
    const alto = popRef.current?.offsetHeight ?? 0;
    const abajo = r.bottom + 8;
    const top = abajo + alto > window.innerHeight - GUTTER ? Math.max(GUTTER, r.top - 8 - alto) : abajo;
    setPos({ left, top, width: ancho });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const cerrar = () => setOpen(false);
    const onPointerDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      cerrar();
    };
    const onKey = (e) => e.key === "Escape" && cerrar();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [open]);

  if (!texto) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="help-tip-btn"
        aria-label="Ayuda"
        aria-expanded={open}
        onClick={(e) => {
          // Dentro de un <label>: que el toque no enfoque el input.
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="help-pop"
            role="dialog"
            style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: "hidden" }}
          >
            <p>{texto}</p>
            <button
              type="button"
              className="login-resend"
              onClick={() => {
                setOpen(false);
                abrirAyuda(id);
              }}
            >
              Más en Ayuda
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
