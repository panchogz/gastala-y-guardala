import { useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "../../lib/supabaseClient.js";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !captchaToken) return;
    setStatus("sending");
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          captchaToken,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (e) {
      setError(e.message);
      setStatus("idle");
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    }
  }

  return (
    <div className="app-root login-root">
      <div className="login-box">
        <h1>Gastala y Guardala</h1>
        <p className="empty">
          Ingresá tu email y te mandamos un link para entrar, sin contraseña.
        </p>

        {status === "sent" ? (
          <p className="login-sent">
            Revisá tu correo — te enviamos un link a <strong>{email}</strong> para iniciar
            sesión.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
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
              disabled={status === "sending" || !captchaToken}
            >
              {status === "sending" ? "Enviando…" : "Enviarme el link"}
            </button>
          </form>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
