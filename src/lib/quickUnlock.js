// Desbloqueo rápido (Face ID/Touch ID vía WebAuthn, o PIN) como capa extra
// sobre una sesión de Supabase Auth ya iniciada. No reemplaza el login por
// OTP ni valida nada contra el backend: es un gate puramente local para no
// tener que reescribir el código cada vez que se reabre la app o vuelve de
// segundo plano. La config se guarda en IndexedDB (mismo patrón que
// authStorage.js) y queda scoped por user_id, así cada cuenta tiene su
// propio método (o ninguno).
const DB_NAME = "finanzas-quick-unlock";
const DB_VERSION = 1;
const STORE = "config";

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

// El "success" de un request individual (put/delete) no garantiza que la
// transacción ya haya confirmado en disco. En iOS, la hoja del sistema de
// Face ID/Touch ID suspende el WKWebView justo cuando este código corre
// (llamado desde setupBiometric, inmediatamente después de que
// navigator.credentials.create() resuelve) — si la pestaña se
// suspende/recarga antes de que la transacción termine de commitear, el
// registro se pierde en silencio aunque el flujo de setup haya parecido
// completarse. Por eso las escrituras esperan tx.oncomplete, no solo el
// onsuccess del request.
function txToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getUnlockConfig(userId) {
  if (!userId) return null;
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const value = await reqToPromise(tx.objectStore(STORE).get(userId));
  return value ?? null;
}

export async function saveUnlockConfig(userId, config) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(config, userId);
  await txToPromise(tx);
}

export async function clearUnlockConfig(userId) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(userId);
  await txToPromise(tx);
}

// Se guarda por separado del método en sí (con método "skip" alcanzaría,
// pero así "omitir" y "todavía no se preguntó" quedan distinguibles si en el
// futuro se quiere volver a preguntar tras un tiempo).
export async function markSetupAsked(userId) {
  const existing = await getUnlockConfig(userId);
  await saveUnlockConfig(userId, { method: null, ...existing, askedSetup: true });
}

// ---------- WebAuthn (Face ID / Touch ID / Windows Hello) ----------

export async function isBiometricAvailable() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

// Ceremonia local: crea una credencial "resident key" sin server-side (no
// hay challenge validado contra ningún backend, es solo para poder pedir de
// vuelta esa misma credencial con .get() más adelante).
export async function registerBiometric(userId, userLabel) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Gastala y Guardala", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userLabel || userId,
        displayName: userLabel || userId,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  });
  if (!credential) throw new Error("No se pudo crear la credencial biométrica.");
  return bufToBase64Url(credential.rawId);
}

// Éxito de la ceremonia (el usuario pasó Face ID/Touch ID/PIN del SO) =
// desbloqueado. No hay firma que validar contra un servidor.
export async function verifyBiometric(credentialId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: base64UrlToBuf(credentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}

// ---------- PIN ----------

async function hashPin(pin, saltHex) {
  const enc = new TextEncoder().encode(saltHex + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSaltHex() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function setupPin(userId, pin) {
  const pinSalt = randomSaltHex();
  const pinHash = await hashPin(pin, pinSalt);
  await saveUnlockConfig(userId, { method: "pin", pinSalt, pinHash, askedSetup: true });
}

export async function verifyPin(userId, pin) {
  const config = await getUnlockConfig(userId);
  if (!config || config.method !== "pin") return false;
  const hash = await hashPin(pin, config.pinSalt);
  return hash === config.pinHash;
}

export async function setupBiometric(userId, userLabel) {
  const credentialId = await registerBiometric(userId, userLabel);
  await saveUnlockConfig(userId, { method: "webauthn", credentialId, askedSetup: true });
}
