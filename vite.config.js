import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { config as loadDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Las credenciales de Supabase viven en VIT_KEYS.env (no .env), así que
// Vite no lo carga solo — lo leemos acá y lo inyectamos como import.meta.env.
loadDotenv({ path: path.resolve(__dirname, "VIT_KEYS.env") });

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Gastala y Guardala",
        short_name: "GyG",
        description: "Seguimiento de tarjetas y ahorros personales.",
        theme_color: "#14181D",
        background_color: "#14181D",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // Fallback SPA para navegación offline, limitado a nuestro propio origen.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          // Refuerzo explícito (redundante por diseño: un SW nunca ve pedidos de
          // navegación de un origen distinto al suyo, así que esto nunca debería
          // dispararse) para dejar constancia de que estos dominios de terceros
          // quedan excluidos a propósito del fallback offline.
          /^https:\/\/challenges\.cloudflare\.com\//,
          /^https:\/\/.*\.supabase\.co\//,
        ],
        // Única regla de runtime caching: solo mismo origen. La condición
        // `sameOrigin` garantiza que ningún dominio externo (Cloudflare Turnstile,
        // Supabase, etc.) pase nunca por acá — esos pedidos siguen yendo directo
        // a la red, sin pasar por el Service Worker en absoluto.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin }) => sameOrigin,
            handler: "NetworkFirst",
            options: {
              cacheName: "same-origin-runtime",
            },
          },
        ],
      },
    }),
  ],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    "import.meta.env.VITE_TURNSTILE_SITE_KEY": JSON.stringify(process.env.VITE_TURNSTILE_SITE_KEY),
  },
});
