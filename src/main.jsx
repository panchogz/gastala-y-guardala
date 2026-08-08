import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./styles.css";

// El script de registro que Vite inyecta por defecto (registerSW.js) solo
// hace navigator.serviceWorker.register() y nada más: no revisa si hay una
// versión nueva ni recarga la página cuando la hay. Con registerType:
// "autoUpdate" en vite.config.js, este helper (virtual:pwa-register) sí hace
// ese trabajo — detecta un SW nuevo, lo activa y recarga la app solo. Sin
// esto, una PWA ya instalada puede quedar mostrando una versión vieja
// indefinidamente (confirmado: era la causa de que cambios de CSS/JS no se
// vieran sin desinstalar y reinstalar la PWA).
registerSW({ immediate: true });

// La PWA abierta desde el ícono de home screen en iOS no siempre dispara sola
// una revisión de actualización (no es una navegación "fresca" como en el
// browser). Se fuerza un chequeo manual cada vez que la app vuelve a primer
// plano; si hay una versión nueva, registerSW ya se encarga de recargar sola.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    navigator.serviceWorker?.getRegistration().then((reg) => reg?.update());
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
