import { supabase } from "../../lib/supabaseClient.js";
import { currentMonthISO } from "../../lib/helpers.js";
import { getUserId } from "../../lib/auth.js";

// ---------- cotización global (una fila por usuario, sin id fijo) ----------

export async function fetchCotizacion() {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  return data; // null si el usuario todavía no guardó ninguna cotización
}

export async function saveCotizacion(dolar_ccl_mep) {
  const user_id = await getUserId();
  const { error } = await supabase
    .from("cotizaciones")
    .upsert({ user_id, dolar_ccl_mep }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function saveCotizacionUsdt(dolar_usdt) {
  const user_id = await getUserId();
  const { error } = await supabase
    .from("cotizaciones")
    .upsert({ user_id, dolar_usdt }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---------- configuración de categorías (qué secciones usa cada usuario) ----------

export async function fetchAhorrosConfig() {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("ahorros_config")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveAhorrosConfig(patch) {
  const user_id = await getUserId();
  const { error } = await supabase
    .from("ahorros_config")
    .upsert({ user_id, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---------- helpers genéricos por tabla ----------

function tableApi(table) {
  return {
    async fetchAll() {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async insert(row) {
      const user_id = await getUserId();
      const { data, error } = await supabase
        .from(table)
        .insert({ ...row, user_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
  };
}

export const criptoApi = tableApi("activos_cripto");
export const bolsaApi = tableApi("activos_bolsa");
export const usdtApi = tableApi("activos_usdt");

// ---------- evolución mensual ----------

export async function fetchEvolucion() {
  const { data, error } = await supabase
    .from("evolucion_mensual")
    .select("*")
    .order("mes", { ascending: true });
  if (error) throw error;
  return data;
}

export async function guardarSnapshot(totales) {
  const user_id = await getUserId();
  const { error } = await supabase.from("evolucion_mensual").upsert(
    {
      mes: currentMonthISO(),
      user_id,
      cripto_usd: totales.criptoUSD,
      bolsa_usd: totales.bolsaUSD,
      dolares_usd: totales.dolaresUSD,
      cripto_ars: totales.criptoARS,
      bolsa_ars: totales.bolsaARS,
      dolares_ars: totales.dolaresARS,
    },
    { onConflict: "user_id,mes" }
  );
  if (error) throw error;
}
