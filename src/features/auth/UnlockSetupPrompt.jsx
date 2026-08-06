import { useState } from "react";
import { markSetupAsked, setupBiometric, setupPin } from "../../lib/quickUnlock.js";

export default function UnlockSetupPrompt({ userId, userLabel, biometricAvailable, onDone }) {
  const [mode, setMode] = useState("choose"); // choose | pin | pin-confirm
  const [pin, setPin] = useState("");
  const [pinFirst, setPinFirst] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function skip() {
    await markSetupAsked(userId);
    onDone();
  }

  async function chooseBiometric() {
    setBusy(true);
    setError(null);
    try {
      await setupBiometric(userId, userLabel);
      onDone();
    } catch (e) {
      setError("No se pudo activar Face ID / Touch ID: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function submitFirstPin(e) {
    e.preventDefault();
    if (pin.length < 4) return;
    setPinFirst(pin);
    setPin("");
    setError(null);
    setMode("pin-confirm");
  }

  async function submitConfirmPin(e) {
    e.preventDefault();
    if (pin !== pinFirst) {
      setError("Los PIN no coinciden.");
      setPin("");
      setPinFirst("");
      setMode("pin");
      return;
    }
    setBusy(true);
    try {
      await setupPin(userId, pin);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-root login-root">
      <div className="login-box">
        <h1 style={{ fontSize: 18 }}>Desbloqueo rápido</h1>

        {mode === "choose" && (
          <>
            <p className="empty">
              ¿Querés activar un desbloqueo rápido para no tener que pedir un código por
              email cada vez que abrís la app?
            </p>
            <div className="login-form">
              {biometricAvailable && (
                <button
                  className="btn-register"
                  style={{ background: "#35D0A0" }}
                  onClick={chooseBiometric}
                  disabled={busy}
                >
                  🔐 Face ID / Touch ID
                </button>
              )}
              <button
                className="btn-register"
                style={{ background: "#5B9BE8" }}
                onClick={() => setMode("pin")}
                disabled={busy}
              >
                🔢 Usar un PIN
              </button>
              <button type="button" className="login-resend" onClick={skip} disabled={busy}>
                Omitir por ahora
              </button>
            </div>
          </>
        )}

        {mode === "pin" && (
          <>
            <p className="empty">Elegí un PIN de 4 a 6 dígitos.</p>
            <form onSubmit={submitFirstPin} className="login-form">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
              <button className="btn-register" style={{ background: "#35D0A0" }} type="submit">
                Continuar
              </button>
            </form>
          </>
        )}

        {mode === "pin-confirm" && (
          <>
            <p className="empty">Repetí el PIN para confirmarlo.</p>
            <form onSubmit={submitConfirmPin} className="login-form">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                type="submit"
                disabled={busy}
              >
                {busy ? "Guardando…" : "Confirmar"}
              </button>
            </form>
          </>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
