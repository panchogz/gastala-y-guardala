import { supabase } from "../../lib/supabaseClient.js";
import { currentMonthISO } from "../../lib/helpers.js";
import { getUserId } from "../../lib/auth.js";
import { queuedInsert, queuedUpdate, queuedDelete, queuedUpsert } from "../../lib/queuedWrite.js";

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
  return queuedInsert("tarjetas", { nombre, color, orden, user_id });
}

export async function deleteTarjeta(id) {
  // Borrado explícito de lo asociado primero: funciona haya o no ON DELETE CASCADE
  // configurado en las foreign keys. RLS ya restringe todo esto al usuario dueño.
  await queuedDelete("tarjeta_cuotas", "tarjeta_id", id);
  await queuedDelete("tarjeta_dolares", "tarjeta_id", id);
  await queuedDelete("tarjeta_recurrentes", "tarjeta_id", id);
  await queuedDelete("tarjeta_config", "tarjeta_id", id);
  await queuedDelete("total_mensual", "tarjeta_id", id);
  await queuedDelete("tarjetas", "id", id);
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
  await queuedUpsert(
    "tarjeta_config",
    { tarjeta_id: tarjetaId, user_id, salario_neto, cotizacion },
    "user_id,tarjeta_id"
  );
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
  return queuedInsert("tarjeta_cuotas", { tarjeta_id: tarjetaId, user_id, ...row });
}

export async function updateCuota(id, patch) {
  await queuedUpdate("tarjeta_cuotas", "id", id, patch);
}

export async function deleteCuota(id) {
  await queuedDelete("tarjeta_cuotas", "id", id);
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
  return queuedInsert("tarjeta_dolares", { tarjeta_id: tarjetaId, user_id, ...row });
}

export async function updateDolar(id, patch) {
  await queuedUpdate("tarjeta_dolares", "id", id, patch);
}

export async function deleteDolar(id) {
  await queuedDelete("tarjeta_dolares", "id", id);
}

// ---------- gastos recurrentes / suscripciones ----------

export async function fetchRecurrentes(tarjetaId) {
  const { data, error } = await supabase
    .from("tarjeta_recurrentes")
    .select("*")
    .eq("tarjeta_id", tarjetaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertRecurrente(tarjetaId, row) {
  const user_id = await getUserId();
  return queuedInsert("tarjeta_recurrentes", { tarjeta_id: tarjetaId, user_id, ...row });
}

export async function updateRecurrente(id, patch) {
  await queuedUpdate("tarjeta_recurrentes", "id", id, patch);
}

export async function deleteRecurrente(id) {
  await queuedDelete("tarjeta_recurrentes", "id", id);
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
  await queuedUpsert(
    "total_mensual",
    { mes: currentMonthISO(), tarjeta_id: tarjetaId, user_id, total },
    "user_id,mes,tarjeta_id"
  );
}
