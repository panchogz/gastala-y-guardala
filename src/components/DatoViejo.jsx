import { useCallback, useRef, useState } from "react";
import Popover from "./Popover.jsx";

// Punto ámbar junto a un valor cargado a mano que puede estar viejo (ver
// lib/desactualizado.js). No es solo color: aria-label y title llevan el mismo
// texto que el popover. Al tocarlo muestra el motivo y, si es por antigüedad,
// "Sigue igual": renueva la fecha sin cambiar el valor.
//
// Props: estado (de estadoDato, o null → no se muestra nada), onConfirmar.
export default function DatoViejo({ estado, onConfirmar }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const cerrar = useCallback(() => setOpen(false), []);
  if (!estado) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="dato-viejo"
        aria-label={estado.texto}
        title={estado.texto}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      />
      {open && (
        <Popover anchorRef={btnRef} onClose={cerrar} label={estado.texto}>
          <p>{estado.texto}</p>
          {estado.motivo === "viejo" && onConfirmar && (
            <button
              type="button"
              className="login-resend"
              onClick={() => {
                setOpen(false);
                onConfirmar();
              }}
            >
              Sigue igual
            </button>
          )}
        </Popover>
      )}
    </>
  );
}
