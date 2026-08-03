import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import Login from "./features/auth/Login.jsx";
import TarjetasView from "./features/tarjetas/TarjetasView.jsx";
import AhorrosView from "./features/ahorros/AhorrosView.jsx";

const VIEW_MODES = ["auto", "desktop", "mobile"];
const VIEW_MODE_LABEL = { auto: "Auto", desktop: "Vista escritorio", mobile: "Vista mobile" };
const VIEW_MODE_ICON = { auto: "🔁", desktop: "🖥️", mobile: "📱" };

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("tarjetas");
  const [viewMode, setViewMode] = useState("auto");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const cycleViewMode = () =>
    setViewMode((m) => VIEW_MODES[(VIEW_MODES.indexOf(m) + 1) % VIEW_MODES.length]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const rootClass = [
    "app-root",
    viewMode === "desktop" ? "force-desktop" : "",
    viewMode === "mobile" ? "force-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (authLoading) {
    return (
      <div className="app-root">
        <div className="loading">Cargando…</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className={rootClass}>
      <div className="app-header">
        <h1>Gastala y Guardala</h1>
        <div className="app-header-actions">
          <button
            className="view-toggle-btn"
            onClick={cycleViewMode}
            title="Alternar vista escritorio / mobile (solo previsualización, no cambia el ancho real)"
          >
            <span aria-hidden="true">{VIEW_MODE_ICON[viewMode]}</span>
            {VIEW_MODE_LABEL[viewMode]}
          </button>
          <button className="view-toggle-btn" onClick={handleLogout} title="Cerrar sesión">
            <span aria-hidden="true">🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>
      <p style={{ color: "#8B93A1", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
        Conectado a Supabase como <strong>{session.user.email}</strong> — los datos se
        guardan en la base, no en el navegador.
      </p>

      <div className="tabs">
        <button
          className={`tab-btn ${tab === "tarjetas" ? "active" : ""}`}
          onClick={() => setTab("tarjetas")}
        >
          Tarjetas
        </button>
        <button
          className={`tab-btn ${tab === "ahorros" ? "active" : ""}`}
          onClick={() => setTab("ahorros")}
        >
          Ahorros
        </button>
      </div>

      {tab === "tarjetas" ? <TarjetasView /> : <AhorrosView />}
    </div>
  );
}
