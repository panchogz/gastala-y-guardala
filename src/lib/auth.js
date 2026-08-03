import { supabase } from "./supabaseClient.js";

// Lee la sesión desde el cliente local (sin round-trip a Supabase) y devuelve
// el user_id del usuario logueado. Se usa para completar user_id en cada
// insert/upsert sin pedirlo en ningún formulario.
export async function getUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("No hay sesión activa.");
  return uid;
}
