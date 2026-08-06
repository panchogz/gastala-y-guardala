import { useEffect, useState } from "react";
import { verifyBiometric, verifyPin } from "../../lib/quickUnlock.js";

export default function LockScreen({ config, userId, onUnlock, onUseCodeInstead }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function tryBiometric() {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyBiometric(config.credentialId);
      if (ok) onUnlock();
      else setError("No se pudo verificar. Probá de nuevo.");
    } catch {
      setError("No se pudo verificar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (config.method === "webauthn") tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPin(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyPin(userId, pin);
      if (ok) onUnlock();
      else {
        setError("PIN incorrecto.");
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-root login-root">
      <div className="login-box">
        <h1>
          <span className="brand-g brand-g-amber">₲</span>astala y{" "}
          <span className="brand-g brand-g-teal">₲</span>uardala
        </h1>
        <p className="empty">App bloqueada</p>

        {config.method === "webauthn" ? (
          <div className="login-form">
            <button
              className="btn-register"
              style={{ background: "#35D0A0" }}
              onClick={tryBiometric}
              disabled={busy}
            >
              🔐 Desbloquear con Face ID / Touch ID
            </button>
          </div>
        ) : (
          <form onSubmit={submitPin} className="login-form">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
              required
              minLength={4}
              maxLength={6}
            />
            <button
              className="btn-register"
              style={{ background: "#35D0A0" }}
              type="submit"
              disabled={busy || pin.length < 4}
            >
              {busy ? "Verificando…" : "Desbloquear"}
            </button>
          </form>
        )}

        {error && <div className="error-banner">{error}</div>}

        <button type="button" className="login-resend" onClick={onUseCodeInstead}>
          Cerrar sesión y entrar con código
        </button>
      </div>
    </div>
  );
}
