// Cola de escrituras pendientes cuando no hay red, persistida en IndexedDB para
// sobrevivir a que se cierre la app/pestaña. Cada entrada es una operación de
// Supabase (insert/update/delete/upsert) a reintentar cuando vuelva la conexión.

const DB_NAME = "finanzas-offline-queue";
const DB_VERSION = 1;
const STORE = "pending_ops";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "queueId", autoIncrement: true });
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

const listeners = new Set();

async function notifyListeners() {
  const n = await getQueueCount();
  listeners.forEach((cb) => cb(n));
}

// Se suscribe a cambios en el tamaño de la cola (para mostrar un banner tipo
// "N cambios sin sincronizar"). Devuelve una función para desuscribirse.
export function subscribeQueueCount(cb) {
  listeners.add(cb);
  getQueueCount().then(cb);
  return () => listeners.delete(cb);
}

export async function enqueueOperation(op) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const queueId = await reqToPromise(store.add({ ...op, createdAt: Date.now() }));
  await notifyListeners();
  return queueId;
}

export async function getQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rows = await reqToPromise(store.getAll());
  return rows.sort((a, b) => a.queueId - b.queueId);
}

export async function getQueueCount() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  return reqToPromise(store.count());
}

export async function removeFromQueue(queueId) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  await reqToPromise(store.delete(queueId));
  await notifyListeners();
}

// Detecta errores de red reales (fetch que nunca llegó a responder) para
// distinguirlos de errores "normales" de Supabase (permisos, validación, etc.)
// que SÍ llegaron al servidor y no deben encolarse ni reintentarse solos.
// iOS a veces no actualiza navigator.onLine de inmediato al activar modo avión,
// así que no confiamos solo en eso: miramos también el tipo/mensaje del error,
// que es lo que realmente tira fetch cuando no hay conexión (TypeError en todos
// los navegadores; "Load failed" en Safari/WebKit, "Failed to fetch" en Chrome,
// "NetworkError" en Firefox).
export function isLikelyNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("internet connection appears to be offline")
  );
}

// Reintenta todas las operaciones encoladas, en el orden en que se guardaron.
// Si una falla por falta de red de nuevo, corta ahí (deja el resto para el
// próximo intento) en vez de seguir fallando en cascada. Si falla por un error
// real (no de red), la descarta para no reintentarla para siempre.
export async function processQueue(supabase) {
  const queue = await getQueue();
  for (const op of queue) {
    try {
      await replay(supabase, op);
      await removeFromQueue(op.queueId);
      console.warn(`[offline-queue] sincronizado: ${op.type} en "${op.table}"`, op.payload ?? op);
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        console.warn("[offline-queue] sigue sin haber conexión, corto el reintento por ahora", err);
        return;
      }
      console.error(
        `[offline-queue] se descarta ${op.type} en "${op.table}" por un error no recuperable`,
        op,
        err
      );
      await removeFromQueue(op.queueId);
    }
  }
}

async function replay(supabase, op) {
  const { table, type, payload, matchColumn, matchValue, onConflict } = op;
  const q = supabase.from(table);
  if (type === "insert") {
    const { error } = await q.insert(payload);
    if (error) throw error;
  } else if (type === "update") {
    const { error } = await q.update(payload).eq(matchColumn, matchValue);
    if (error) throw error;
  } else if (type === "delete") {
    const { error } = await q.delete().eq(matchColumn, matchValue);
    if (error) throw error;
  } else if (type === "upsert") {
    const { error } = await q.upsert(payload, { onConflict });
    if (error) throw error;
  }
}
