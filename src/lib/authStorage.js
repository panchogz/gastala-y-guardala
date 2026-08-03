// Storage para la sesión de Supabase Auth, respaldado en IndexedDB en vez de
// localStorage.
//
// Por qué: en iOS, cuando la PWA está instalada ("Agregar a inicio") y corre
// en modo standalone, Safari/WebKit puede vaciar el localStorage de ese
// contenedor al cerrar la app del todo (no solo al pasarla a segundo plano),
// sobre todo si el sitio no pidió storage persistente. El resultado es que
// GoTrue pierde el refresh token guardado y hay que loguearse de nuevo cada
// vez. IndexedDB no sufre esta purga con la misma frecuencia, así que lo
// usamos como storage del cliente de auth (ver supabaseClient.js). Es el
// mismo motivo por el que la cola offline (offlineQueue.js) también vive en
// IndexedDB en vez de localStorage.
const DB_NAME = "finanzas-auth-storage";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// GoTrueClient acepta un storage async con esta interfaz (getItem/setItem/
// removeItem devolviendo Promise). Si IndexedDB no está disponible (algún
// modo privado raro) cada llamada rechaza y Supabase simplemente no persiste
// sesión — no rompe el login, solo pierde la persistencia entre cierres.
export const authStorage = {
  async getItem(key) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const value = await reqToPromise(tx.objectStore(STORE).get(key));
    return value ?? null;
  },
  async setItem(key, value) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).put(value, key));
  },
  async removeItem(key) {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).delete(key));
  },
};

// Le pide al navegador que no purgue nuestro storage bajo presión de espacio
// (best-effort: iOS puede igual denegarlo, pero no cuesta nada pedirlo).
export function requestPersistentStorage() {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }
}
