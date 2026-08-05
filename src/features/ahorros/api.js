import { supabase } from "../../lib/supabaseClient.js";
import { currentMonthISO } from "../../lib/helpers.js";
import { getUserId } from "../../lib/auth.js";
import { queuedInsert, queuedUpdate, queuedDelete, queuedUpsert } from "../../lib/queuedWrite.js";

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
  await queuedUpsert("cotizaciones", { user_id, dolar_ccl_mep }, "user_id");
}

export async function saveCotizacionUsdt(dolar_usdt) {
  const user_id = await getUserId();
  await queuedUpsert("cotizaciones", { user_id, dolar_usdt }, "user_id");
}

// ---------- cuentas de ahorro (lista dinámica, una por instrumento concreto) ----------

export async function fetchCuentasAhorro() {
  const { data, error } = await supabase
    .from("cuentas_ahorro")
    .select("*")
    .order("orden", { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertCuentaAhorro({ tipo, nombre, color, orden }) {
  const user_id = await getUserId();
  return queuedInsert("cuentas_ahorro", { tipo, nombre, color, orden, user_id });
}

export async function deleteCuentaAhorro(id) {
  // activos_bolsa/cripto/usdt.cuenta_id tiene ON DELETE CASCADE: borrar la cuenta
  // se lleva puestos sus activos sin necesidad de borrarlos a mano acá.
  await queuedDelete("cuentas_ahorro", "id", id);
}

// ---------- helpers genéricos por tabla de activos (scoped a una cuenta) ----------

function tableApi(table) {
  return {
    async fetchAll(cuentaId) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("cuenta_id", cuentaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async insert(cuentaId, row) {
      const user_id = await getUserId();
      return queuedInsert(table, { ...row, cuenta_id: cuentaId, user_id });
    },
    async update(id, patch) {
      await queuedUpdate(table, "id", id, patch);
    },
    async remove(id) {
      await queuedDelete(table, "id", id);
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
  await queuedUpsert(
    "evolucion_mensual",
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
    "user_id,mes"
  );
}
