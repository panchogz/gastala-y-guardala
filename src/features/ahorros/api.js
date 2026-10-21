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

export async function insertCuentaAhorro({ tipo, nombre, color, orden, moneda }) {
  const user_id = await getUserId();
  return queuedInsert("cuentas_ahorro", { tipo, nombre, color, orden, moneda, user_id });
}

export async function updateCuentaAhorro(id, patch) {
  await queuedUpdate("cuentas_ahorro", "id", id, patch);
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
    // Insert directo (sin cola offline) de varias filas en una sola llamada,
    // todas o ninguna: lo usa la importación de resúmenes, que ya exige
    // conexión en vez de encolar. Ver FEATURE_importacion_resumenes.md.
    async insertMany(cuentaId, rows) {
      const user_id = await getUserId();
      const payload = rows.map((r) => ({
        ...r,
        cuenta_id: cuentaId,
        user_id,
        id: crypto.randomUUID(),
      }));
      const { data, error } = await supabase.from(table).insert(payload).select();
      if (error) throw error;
      return data;
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
export const pesosApi = tableApi("activos_pesos");

// ---------- evolución mensual (una fila por cuenta, no por tipo) ----------

export async function fetchEvolucionCuentas() {
  const { data, error } = await supabase
    .from("evolucion_cuenta")
    .select("*")
    .order("mes", { ascending: true });
  if (error) throw error;
  return data;
}

export async function guardarSnapshotCuentas(cuentaTotales) {
  // cuentaTotales: [{ cuenta_id, valor_usd, valor_ars }, ...] — una entrada por
  // cada cuenta activa del usuario. Se borra la foto vieja del mes (si la hay) y
  // se inserta de cero: más simple que un upsert compuesto y da el mismo resultado
  // porque el set de cuentas puede cambiar de una foto a la otra.
  const user_id = await getUserId();
  const mes = currentMonthISO();
  await queuedDelete("evolucion_cuenta", "mes", mes);
  await Promise.all(
    cuentaTotales.map((c) =>
      queuedInsert("evolucion_cuenta", {
        user_id,
        mes,
        cuenta_id: c.cuenta_id,
        valor_usd: c.valor_usd,
        valor_ars: c.valor_ars,
      })
    )
  );
}
