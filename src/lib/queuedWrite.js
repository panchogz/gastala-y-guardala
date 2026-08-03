// Envoltorios de insert/update/delete/upsert que caen a la cola offline
// (IndexedDB) en vez de tirar el error de red crudo al usuario.
//
// Reglas:
// 1) Si navigator.onLine ya es false, ni siquiera intentamos el fetch: se
//    encola directo.
// 2) Si igual falla por un error de red real (isLikelyNetworkError), también
//    se encola — cubre el caso de iOS donde navigator.onLine no se actualiza
//    al toque al activar modo avión.
// 3) Cualquier otro error (permisos, validación, etc.) se relanza tal cual;
//    esos SÍ llegaron al servidor y no tiene sentido encolarlos.
import { supabase } from "./supabaseClient.js";
import { enqueueOperation, isLikelyNetworkError } from "./offlineQueue.js";

export async function queuedInsert(table, row) {
  const payload = row.id ? row : { ...row, id: crypto.randomUUID() };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    console.warn(`[offline-queue] sin conexión: insert en "${table}" guardado localmente`, payload);
    await enqueueOperation({ table, type: "insert", payload });
    return { ...payload, _pending: true };
  }

  try {
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      console.warn(
        `[offline-queue] falló la red al insertar en "${table}", se guarda localmente`,
        err
      );
      await enqueueOperation({ table, type: "insert", payload });
      return { ...payload, _pending: true };
    }
    throw err;
  }
}

export async function queuedUpdate(table, matchColumn, matchValue, patch) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    console.warn(`[offline-queue] sin conexión: update en "${table}" guardado localmente`, patch);
    await enqueueOperation({ table, type: "update", payload: patch, matchColumn, matchValue });
    return;
  }

  try {
    const { error } = await supabase.from(table).update(patch).eq(matchColumn, matchValue);
    if (error) throw error;
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      console.warn(
        `[offline-queue] falló la red al actualizar "${table}", se guarda localmente`,
        err
      );
      await enqueueOperation({ table, type: "update", payload: patch, matchColumn, matchValue });
      return;
    }
    throw err;
  }
}

export async function queuedDelete(table, matchColumn, matchValue) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    console.warn(`[offline-queue] sin conexión: delete en "${table}" guardado localmente`);
    await enqueueOperation({ table, type: "delete", matchColumn, matchValue });
    return;
  }

  try {
    const { error } = await supabase.from(table).delete().eq(matchColumn, matchValue);
    if (error) throw error;
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      console.warn(`[offline-queue] falló la red al borrar en "${table}", se guarda localmente`, err);
      await enqueueOperation({ table, type: "delete", matchColumn, matchValue });
      return;
    }
    throw err;
  }
}

export async function queuedUpsert(table, row, onConflict) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    console.warn(`[offline-queue] sin conexión: upsert en "${table}" guardado localmente`, row);
    await enqueueOperation({ table, type: "upsert", payload: row, onConflict });
    return;
  }

  try {
    const { error } = await supabase.from(table).upsert(row, { onConflict });
    if (error) throw error;
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      console.warn(`[offline-queue] falló la red en upsert de "${table}", se guarda localmente`, err);
      await enqueueOperation({ table, type: "upsert", payload: row, onConflict });
      return;
    }
    throw err;
  }
}
