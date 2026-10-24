import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./styles.css";

// El script de registro que Vite inyecta por defecto (registerSW.js) solo
// hace navigator.serviceWorker.register() y nada más: no revisa si hay una
// versión nueva. Este helper (virtual:pwa-register) sí lo hace, pero con
// registerType: "prompt" (vite.config.js) NO recarga solo — se queda
// esperando a que el usuario confirme desde el toast de abajo. Recargar
// sin avisar podría pisar un formulario a medio completar o una
// importación en revisión a medio confirmar.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

function mostrarTostadaActualizacion(onRecargar) {
  if (document.getElementById("update-toast")) return; // ya se está mostrando

  const toast = document.createElement("div");
  toast.id = "update-toast";
  toast.className = "update-toast";

  const texto = document.createElement("span");
  texto.textContent = "Nueva versión disponible";
  toast.appendChild(texto);

  const btnRecargar = document.createElement("button");
  btnRecargar.type = "button";
  btnRecargar.className = "update-toast-btn";
  btnRecargar.textContent = "Recargar";
  btnRecargar.onclick = () => {
    toast.remove();
    onRecargar();
  };
  toast.appendChild(btnRecargar);

  const btnCerrar = document.createElement("button");
  btnCerrar.type = "button";
  btnCerrar.className = "update-toast-close";
  btnCerrar.setAttribute("aria-label", "Cerrar");
  btnCerrar.textContent = "×";
  btnCerrar.onclick = () => toast.remove();
  toast.appendChild(btnCerrar);

  document.body.appendChild(toast);
}

// true desde que en esta ventana se detectó una versión nueva esperando: si el
// aviso se cerró con la ×, vuelve a mostrarse cuando la app vuelve a primer
// plano (ver visibilitychange abajo). Solo en ventanas donde ya corrió
// onNeedRefresh: ahí registerSW dejó armada la recarga al tocar "Recargar".
let actualizacionPendiente = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    actualizacionPendiente = true;
    mostrarTostadaActualizacion(() => updateSW(true));
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Chequeo periódico: una PWA puede quedar abierta en primer plano
    // (o en background en iOS sin pasar por visibilitychange) mucho más de
    // lo que tarda un deploy en salir.
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
  },
});

// La PWA abierta desde el ícono de home screen en iOS no siempre dispara sola
// una revisión de actualización (no es una navegación "fresca" como en el
// browser). Se fuerza un chequeo manual cada vez que la app vuelve a primer
// plano.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (actualizacionPendiente) {
    mostrarTostadaActualizacion(() => updateSW(true));
    return;
  }
  navigator.serviceWorker?.getRegistration().then((reg) => reg?.update());
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
