import { useEffect, useRef, useState } from "react";

// Menú de cuenta del header (botón ⋯): reemplaza los botones sueltos de
// Exportar, Desbloqueo y Cerrar sesión. Igual en desktop y mobile. Se cierra
// al tocar afuera, con Escape o al elegir una opción.
//
// Props: email (encabezado), items ([{ label, icon, onClick }]), onLogout.
export default function UserMenu({ email, items, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function elegir(fn) {
    setOpen(false);
    fn();
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="view-toggle-btn user-menu-btn"
        aria-label="Menú de cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div className="user-menu-list" role="menu">
          <div className="user-menu-email">Conectado como {email}</div>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className="user-menu-item" onClick={() => elegir(it.onClick)}>
              <span aria-hidden="true">{it.icon}</span>
              {it.label}
            </button>
          ))}
          <div className="user-menu-sep" />
          <button type="button" role="menuitem" className="user-menu-item danger" onClick={() => elegir(onLogout)}>
            <span aria-hidden="true">🚪</span>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
