import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { processQueue, subscribeQueueCount } from "./lib/offlineQueue.js";
import { setCachedUserId } from "./lib/auth.js";
import { requestPersistentStorage } from "./lib/authStorage.js";
import { getUnlockConfig, isBiometricAvailable } from "./lib/quickUnlock.js";
import Login from "./features/auth/Login.jsx";
import LockScreen from "./features/auth/LockScreen.jsx";
import UnlockSetupPrompt from "./features/auth/UnlockSetupPrompt.jsx";
import UnlockSettingsPanel from "./features/auth/UnlockSettingsPanel.jsx";
import TarjetasView from "./features/tarjetas/TarjetasView.jsx";
import AhorrosView from "./features/ahorros/AhorrosView.jsx";
import ExportModal from "./components/ExportModal.jsx";
import UserMenu from "./components/UserMenu.jsx";
import { HelpProvider, useAyuda } from "./components/Ayuda.jsx";

// Umbral de inactividad en segundo plano a partir del cual, al volver, se
// vuelve a pedir el desbloqueo rápido (no cada vez que se cambia de pestaña
// un instante).
const RELOCK_AFTER_MS = 5 * 60 * 1000;

const VIEW_MODES = ["auto", "desktop", "mobile"];
const VIEW_MODE_LABEL = { auto: "Auto", desktop: "Vista escritorio", mobile: "Vista mobile" };
const VIEW_MODE_ICON = { auto: "🔁", desktop: "🖥️", mobile: "📱" };

export default function App() {
  // HelpProvider envuelve toda la app para que cualquier HelpTip (y el menú ⋯)
  // pueda abrir el modal de Ayuda.
  return (
    <HelpProvider>
      <AppContent />
    </HelpProvider>
  );
}

function AppContent() {
  const { abrirAyuda } = useAyuda();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("tarjetas");
  const [viewMode, setViewMode] = useState("auto");
  const [pendingCount, setPendingCount] = useState(0);

  const [unlockConfig, setUnlockConfig] = useState(null);
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [showUnlockSettings, setShowUnlockSettings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(null);
  // Se marca cuando el usuario completa un login OTP nuevo (no una sesión
  // restaurada al recargar), para forzar que el prompt de setup de
  // desbloqueo rápido reaparezca y pueda recambiar de método.
  const freshLoginRef = useRef(false);

  useEffect(() => {
    requestPersistentStorage();
    isBiometricAvailable().then(setBiometricAvailable);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCachedUserId(data.session?.user?.id);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setCachedUserId(newSession?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Al aparecer una sesión (login fresco o recarga con sesión persistida),
  // se consulta si esta cuenta tiene un método de desbloqueo configurado:
  // si lo tiene, arranca bloqueada (caso 1: apertura fresca); si no, y
  // todavía no se le preguntó, se ofrece activarlo.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setUnlockConfig(null);
      setUnlockChecked(false);
      setLocked(false);
      setShowSetupPrompt(false);
      return;
    }
    getUnlockConfig(uid).then((config) => {
      setUnlockConfig(config);
      if (freshLoginRef.current) {
        freshLoginRef.current = false;
        setShowSetupPrompt(true);
      } else if (config?.method) {
        setLocked(true);
      } else if (!config?.askedSetup) {
        setShowSetupPrompt(true);
      }
      setUnlockChecked(true);
    });
  }, [session?.user?.id]);

  // Caso 2: la app vuelve de segundo plano después de 5+ minutos inactiva.
  useEffect(() => {
    let hiddenAt = null;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === "visible" && hiddenAt) {
        const elapsed = Date.now() - hiddenAt;
        hiddenAt = null;
        if (elapsed >= RELOCK_AFTER_MS && unlockConfig?.method) {
          setLocked(true);
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [unlockConfig]);

  useEffect(() => {
    const unsubscribe = subscribeQueueCount(setPendingCount);
    // Por si quedaron cambios sin sincronizar de una sesión anterior y ya hay red.
    processQueue(supabase);
    const onOnline = () => processQueue(supabase);
    window.addEventListener("online", onOnline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
    };
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
    return <Login onVerified={() => { freshLoginRef.current = true; }} />;
  }

  if (locked && unlockConfig?.method) {
    return (
      <LockScreen
        config={unlockConfig}
        userId={session.user.id}
        onUnlock={() => setLocked(false)}
        onUseCodeInstead={() => supabase.auth.signOut()}
      />
    );
  }

  if (showSetupPrompt && unlockChecked && biometricAvailable !== null) {
    return (
      <UnlockSetupPrompt
        userId={session.user.id}
        userLabel={session.user.email}
        biometricAvailable={biometricAvailable}
        existingConfig={unlockConfig}
        onDone={() => {
          setShowSetupPrompt(false);
          getUnlockConfig(session.user.id).then(setUnlockConfig);
        }}
      />
    );
  }

  return (
    <div className={rootClass}>
      <div className="app-header">
        <h1>
          <span className="brand-g brand-g-amber">₲</span>astala y{" "}
          <span className="brand-g brand-g-teal">₲</span>uardala
        </h1>
        <div className="app-header-actions">
          {/* Solo en desarrollo: previsualización de layout, no es una opción de cuenta. */}
          {import.meta.env.DEV && (
            <button
              className="view-toggle-btn"
              onClick={cycleViewMode}
              title="Alternar vista escritorio / mobile (solo previsualización, no cambia el ancho real)"
            >
              <span aria-hidden="true">{VIEW_MODE_ICON[viewMode]}</span>
              {VIEW_MODE_LABEL[viewMode]}
            </button>
          )}
          <UserMenu
            email={session.user.email}
            items={[
              { label: "Exportar a Excel", icon: "📊", onClick: () => setShowExportModal(true) },
              { label: "Desbloqueo (Face ID/PIN)", icon: "🔒", onClick: () => setShowUnlockSettings(true) },
              { label: "Ayuda", icon: "❓", onClick: () => abrirAyuda() },
            ]}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {showUnlockSettings && (
        <UnlockSettingsPanel
          userId={session.user.id}
          userLabel={session.user.email}
          config={unlockConfig}
          biometricAvailable={biometricAvailable}
          onChange={(config) => {
            setUnlockConfig(config ? { ...unlockConfig, ...config } : null);
            setShowUnlockSettings(false);
          }}
          onClose={() => setShowUnlockSettings(false)}
        />
      )}

      {pendingCount > 0 && (
        <div className="offline-banner">
          <span aria-hidden="true">📡</span>
          Sin conexión — {pendingCount} cambio{pendingCount === 1 ? "" : "s"} guardado
          {pendingCount === 1 ? "" : "s"} localmente, se sincroniza{pendingCount === 1 ? "" : "n"} solo
          {pendingCount === 1 ? "" : "s"} cuando vuelva la conexión.
        </div>
      )}

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

      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}
