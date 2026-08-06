import { useState } from "react";
import {
  clearUnlockConfig,
  setupBiometric,
  setupPin,
} from "../../lib/quickUnlock.js";

const METHOD_LABEL = { webauthn: "Face ID / Touch ID", pin: "PIN" };

export default function UnlockSettingsPanel({
  userId,
  userLabel,
  config,
  biometricAvailable,
  onChange,
  onClose,
}) {
  const [mode, setMode] = useState("view"); // view | pin | pin-confirm
  const [pin, setPin] = useState("");
  const [pinFirst, setPinFirst] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function disable() {
    setBusy(true);
    try {
      await clearUnlockConfig(userId);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  async function switchToBiometric() {
    setBusy(true);
    setError(null);
    try {
      await setupBiometric(userId, userLabel);
      onChange({ method: "webauthn" });
    } catch (e) {
      setError("No se pudo activar: " + e.message);
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
      onChange({ method: "pin" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="manage-cards-panel">
      {mode === "view" && (
        <>
          <p style={{ marginTop: 0, fontSize: 13, color: "#8B93A1" }}>
            Método actual:{" "}
            <strong style={{ color: "#E8E6E1" }}>
              {config ? METHOD_LABEL[config.method] : "ninguno"}
            </strong>
          </p>
          <div className="manage-cards-add" style={{ borderTop: "none", paddingTop: 0 }}>
            {biometricAvailable && (
              <button className="btn-add" onClick={switchToBiometric} disabled={busy}>
                🔐 Usar Face ID / Touch ID
              </button>
            )}
            <button className="btn-add" onClick={() => setMode("pin")} disabled={busy}>
              🔢 {config?.method === "pin" ? "Cambiar" : "Usar"} PIN
            </button>
            {config && (
              <button className="btn-add" onClick={disable} disabled={busy}>
                🚫 Desactivar
              </button>
            )}
            <button className="btn-add" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}

      {mode === "pin" && (
        <form onSubmit={submitFirstPin} className="login-form" style={{ maxWidth: 220 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#8B93A1" }}>Elegí un PIN de 4 a 6 dígitos.</p>
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
      )}

      {mode === "pin-confirm" && (
        <form onSubmit={submitConfirmPin} className="login-form" style={{ maxWidth: 220 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#8B93A1" }}>Repetí el PIN para confirmarlo.</p>
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
      )}

      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
