import { useCallback, useRef, useState } from "react";
import { buscarPregunta } from "../content/ayuda.js";
import { useAyuda } from "./Ayuda.jsx";
import Popover from "./Popover.jsx";

// "?" chico junto a un label: al tocarlo abre un popover con el tip de la
// pregunta de ayuda.js y un link a esa pregunta en el modal de Ayuda.
//
// Props: id (pregunta de ayuda.js), variante (clave de `tips`, si la pregunta
// tiene más de un tip).
export default function HelpTip({ id, variante }) {
  const { abrirAyuda } = useAyuda();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const cerrar = useCallback(() => setOpen(false), []);

  const pregunta = buscarPregunta(id);
  const texto = (variante && pregunta?.tips?.[variante]) || pregunta?.tip;
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
      {open && (
        <Popover anchorRef={btnRef} onClose={cerrar} label="Ayuda">
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
        </Popover>
      )}
    </>
  );
}
