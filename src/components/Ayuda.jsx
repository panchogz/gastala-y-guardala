import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet.jsx";
import { AYUDA } from "../content/ayuda.js";

// Ayuda (FAQ) accesible desde el menú ⋯ y desde cada HelpTip ("Más en
// Ayuda"). El contexto deja abrir el modal en una pregunta puntual desde
// cualquier parte de la app. Contenido en src/content/ayuda.js.

const HelpContext = createContext({ abrirAyuda: () => {} });

export function useAyuda() {
  return useContext(HelpContext);
}

export function HelpProvider({ children }) {
  // null = cerrado; { preguntaId } = abierto (preguntaId null → todas cerradas).
  const [estado, setEstado] = useState(null);
  const abrirAyuda = useCallback((preguntaId = null) => setEstado({ preguntaId }), []);
  return (
    <HelpContext.Provider value={{ abrirAyuda }}>
      {children}
      {estado && <AyudaModal preguntaInicial={estado.preguntaId} onClose={() => setEstado(null)} />}
    </HelpContext.Provider>
  );
}

function AyudaModal({ preguntaInicial, onClose }) {
  // Una sola pregunta abierta a la vez, entre todas las secciones.
  const [abierta, setAbierta] = useState(preguntaInicial);
  const inicialRef = useRef(null);

  // Abierta desde un HelpTip: la pregunta queda arriba del cuerpo del sheet
  // (scroll del contenedor, no scrollIntoView, que también movía la página).
  useEffect(() => {
    const item = inicialRef.current;
    const body = item?.closest(".sheet-body");
    if (!body) return;
    body.scrollTop += item.getBoundingClientRect().top - body.getBoundingClientRect().top;
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <BottomSheet
      title="Ayuda"
      accent="#5B9BE8"
      encima
      actions={
        <button type="button" className="login-resend" style={{ margin: 0 }} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {AYUDA.map((seccion) => (
        <section key={seccion.id} className="ayuda-seccion">
          <h4>{seccion.titulo}</h4>
          {seccion.preguntas.map((p) => {
            const open = abierta === p.id;
            return (
              <div key={p.id} className="ayuda-item" ref={p.id === preguntaInicial ? inicialRef : undefined}>
                <button
                  type="button"
                  className="ayuda-q"
                  aria-expanded={open}
                  onClick={() => setAbierta(open ? null : p.id)}
                >
                  <span>{p.pregunta}</span>
                  <span className={open ? "ayuda-chevron open" : "ayuda-chevron"} aria-hidden="true">
                    ›
                  </span>
                </button>
                {open && <p className="ayuda-a">{p.respuesta}</p>}
              </div>
            );
          })}
        </section>
      ))}
    </BottomSheet>
  );
}
