import { useState } from "react";
import { markSetupAsked, setupBiometric, setupPin } from "../../lib/quickUnlock.js";

export default function UnlockSetupPrompt({
  userId,
  userLabel,
  biometricAvailable,
  existingConfig,
  onDone,
}) {
  const [mode, setMode] = useState("choose"); // choose | biometric-confirm | biometric-keep | pin | pin-confirm | pin-keep
  const [pin, setPin] = useState("");
  const [pinFirst, setPinFirst] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function skip() {
    await markSetupAsked(userId);
    onDone();
  }

  // Reelegir el mismo método ya configurado (típicamente al reaparecer este
  // prompt en un login OTP nuevo) no debe recrear nada — solo confirma que
  // se sigue usando lo que ya había. Cambiarlo de verdad es cosa del panel
  // de 🔒 Desbloqueo en el header.
  function selectBiometric() {
    setMode(existingConfig?.method === "webauthn" ? "biometric-keep" : "biometric-confirm");
  }

  function selectPin() {
    setMode(existingConfig?.method === "pin" ? "pin-keep" : "pin");
  }

  async function keepExisting() {
    setBusy(true);
    setError(null);
    try {
      await markSetupAsked(userId);
      onDone();
    } finally {
      setBusy(false);
    }
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
                  onClick={selectBiometric}
                  disabled={busy}
                >
                  🔐 Face ID / Touch ID
                </button>
              )}
              <button
                className="btn-register"
                style={{ background: "#5B9BE8" }}
                onClick={selectPin}
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

        {mode === "biometric-keep" && (
          <>
            <p className="empty">
              Ya tenés Face ID / Touch ID configurado en este dispositivo. Vas a seguir
              usando esa misma credencial.
            </p>
            <div className="login-form">
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                onClick={keepExisting}
                disabled={busy}
              >
                {busy ? "Confirmando…" : "Seguir usándola"}
              </button>
              <button
                type="button"
                className="login-resend"
                onClick={() => setMode("biometric-confirm")}
                disabled={busy}
              >
                No me anduvo bien, volver a configurarla
              </button>
              <button
                type="button"
                className="login-resend"
                onClick={() => setMode("choose")}
                disabled={busy}
              >
                Volver
              </button>
            </div>
          </>
        )}

        {mode === "pin-keep" && (
          <>
            <p className="empty">Ya tenés un PIN configurado. Vas a seguir usando ese mismo.</p>
            <div className="login-form">
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                onClick={keepExisting}
                disabled={busy}
              >
                {busy ? "Confirmando…" : "Seguir usándolo"}
              </button>
              <button type="button" className="login-resend" onClick={() => setMode("choose")} disabled={busy}>
                Volver
              </button>
            </div>
            <p className="empty" style={{ marginTop: 8 }}>
              Para cambiarlo, usá 🔒 Desbloqueo en el menú.
            </p>
          </>
        )}

        {mode === "biometric-confirm" && (
          <>
            <p className="empty">
              Probablemente veas un cuadro de iOS/Android pidiendo confirmar la biometría
              cada vez que abras la app — es normal (lamentablemente). No podemos evitar
              ese paso ya que es una restricción de seguridad.
            </p>
            <div className="login-form">
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                onClick={chooseBiometric}
                disabled={busy}
              >
                {busy ? "Activando…" : "Entendido, continuar"}
              </button>
              <button
                type="button"
                className="login-resend"
                onClick={() => setMode("choose")}
                disabled={busy}
              >
                Volver
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
