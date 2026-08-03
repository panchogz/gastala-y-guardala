import { supabase } from "../../lib/supabaseClient.js";
import { currentMonthISO } from "../../lib/helpers.js";
import { getUserId } from "../../lib/auth.js";

// ---------- tarjetas (lista dinámica) ----------

export async function fetchTarjetas() {
  const { data, error } = await supabase
    .from("tarjetas")
    .select("*")
    .order("orden", { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertTarjeta({ nombre, color, orden }) {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("tarjetas")
    .insert({ nombre, color, orden, user_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTarjeta(id) {
  // Borrado explícito de lo asociado primero: funciona haya o no ON DELETE CASCADE
  // configurado en las foreign keys. RLS ya restringe todo esto al usuario dueño.
  await supabase.from("tarjeta_cuotas").delete().eq("tarjeta_id", id);
  await supabase.from("tarjeta_dolares").delete().eq("tarjeta_id", id);
  await supabase.from("tarjeta_config").delete().eq("tarjeta_id", id);
  await supabase.from("total_mensual").delete().eq("tarjeta_id", id);
  const { error } = await supabase.from("tarjetas").delete().eq("id", id);
  if (error) throw error;
}

// ---------- config (salario neto + cotización por tarjeta) ----------

export async function fetchConfig(tarjetaId) {
  const { data, error } = await supabase
    .from("tarjeta_config")
    .select("*")
    .eq("tarjeta_id", tarjetaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveConfig(tarjetaId, { salario_neto, cotizacion }) {
  const user_id = await getUserId();
  const { error } = await supabase
    .from("tarjeta_config")
    .upsert(
      { tarjeta_id: tarjetaId, user_id, salario_neto, cotizacion },
      { onConflict: "user_id,tarjeta_id" }
    );
  if (error) throw error;
}

// ---------- compras en cuotas ----------

export async function fetchCuotas(tarjetaId) {
  const { data, error } = await supabase
    .from("tarjeta_cuotas")
    .select("*")
    .eq("tarjeta_id", tarjetaId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertCuota(tarjetaId, row) {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("tarjeta_cuotas")
    .insert({ tarjeta_id: tarjetaId, user_id, ...row })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCuota(id, patch) {
  const { error } = await supabase.from("tarjeta_cuotas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCuota(id) {
  const { error } = await supabase.from("tarjeta_cuotas").delete().eq("id", id);
  if (error) throw error;
}

// ---------- gastos en dólares ----------

export async function fetchDolares(tarjetaId) {
  const { data, error } = await supabase
    .from("tarjeta_dolares")
    .select("*")
    .eq("tarjeta_id", tarjetaId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertDolar(tarjetaId, row) {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("tarjeta_dolares")
    .insert({ tarjeta_id: tarjetaId, user_id, ...row })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDolar(id, patch) {
  const { error } = await supabase.from("tarjeta_dolares").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDolar(id) {
  const { error } = await supabase.from("tarjeta_dolares").delete().eq("id", id);
  if (error) throw error;
}

// ---------- total mensual ----------

export async function fetchMonthly() {
  const { data, error } = await supabase
    .from("total_mensual")
    .select("*")
    .order("mes", { ascending: true });
  if (error) throw error;
  return data;
}

export async function registrarMes(tarjetaId, total) {
  const user_id = await getUserId();
  const { error } = await supabase
    .from("total_mensual")
    .upsert(
      { mes: currentMonthISO(), tarjeta_id: tarjetaId, user_id, total },
      { onConflict: "user_id,mes,tarjeta_id" }
    );
  if (error) throw error;
}
