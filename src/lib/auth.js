import { supabase } from "./supabaseClient.js";

// supabase.auth.getSession() puede disparar un refresh de token contra la red
// si el token está por vencer — eso hace un fetch real que puede fallar sin
// pasar por ningún try/catch de la cola offline. Para que getUserId() nunca
// dependa de la red durante la sesión, cacheamos el user_id en memoria cada
// vez que cambia el estado de auth (ver App.jsx) y solo consultamos a
// Supabase como fallback si todavía no lo tenemos cacheado.
let cachedUserId = null;

export function setCachedUserId(id) {
  cachedUserId = id ?? null;
}

export async function getUserId() {
  if (cachedUserId) return cachedUserId;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("No hay sesión activa.");
  cachedUserId = uid;
  return uid;
}
