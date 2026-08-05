import { useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "../../lib/supabaseClient.js";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// Flujo de código OTP (no magic link): en la PWA instalada en iOS no
// funciona depender de un link por mail, porque ese link siempre abre en
// Safari y Safari tiene un contenedor de storage separado del de la app
// standalone — la sesión que se crea ahí nunca llega a la app instalada.
// Pidiendo el código por email y verificándolo con supabase.auth.verifyOtp()
// dentro de la misma pantalla, el login se completa en el contexto correcto
// sin depender de que ningún storage se comparta entre pestañas.
export default function Login() {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);

  async function sendCode(e) {
    e.preventDefault();
    if (!email.trim() || !captchaToken) return;
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { captchaToken },
      });
      if (error) throw error;
      setStep("code");
    } catch (e) {
      setError(e.message);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // Sesión establecida: App.jsx la toma sola vía onAuthStateChange.
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  }

  function backToEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setCaptchaToken(null);
  }

  return (
    <div className="app-root login-root">
      <div className="login-box">
        <h1>
          <span style={{ color: "#E8A855" }}>₲</span>astala y{" "}
          <span style={{ color: "#35D0A0" }}>₲</span>uardala
        </h1>

        {step === "email" ? (
          <>
            <p className="empty">
              Ingresá tu email y te mandamos un código para entrar, sin contraseña.
            </p>
            <form onSubmit={sendCode} className="login-form">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => {
                  setCaptchaToken(null);
                  turnstileRef.current?.reset();
                }}
                onError={() => {
                  setCaptchaToken(null);
                  turnstileRef.current?.reset();
                }}
                className="login-turnstile"
              />
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                type="submit"
                disabled={sending || !captchaToken}
              >
                {sending ? "Enviando…" : "Enviarme el código"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="login-sent">
              Te enviamos un código a <strong>{email}</strong>. Ingresá el código que
              recibiste por email (vence a los pocos minutos).
            </p>
            <form onSubmit={verifyCode} className="login-form">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Código"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                minLength={4}
                maxLength={10}
              />
              <button
                className="btn-register"
                style={{ background: "#35D0A0" }}
                type="submit"
                disabled={verifying || !code.trim()}
              >
                {verifying ? "Verificando…" : "Verificar"}
              </button>
            </form>
            <button type="button" className="login-resend" onClick={backToEmail}>
              ¿No te llegó o venció? Pedir un código nuevo
            </button>
          </>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
