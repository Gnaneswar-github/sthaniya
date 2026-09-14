import type { DraftMeta } from "./generate-events";
import type { Recommendation, Trip } from "./types";

/**
 * The traveller's current trip, kept on their device. The place pool travels with it so a
 * restored or shared drafted trip can still swap and add — v4 stored the trip alone and lost that.
 */
export const TRIP_STORAGE_KEY = "nativa.trip.v5";
/** The key from before the rename to Nativa; read once so a trip in progress isn't lost. */
const LEGACY_TRIP_STORAGE_KEY = "sthaniya.trip.v5";

export type StoredTrip = { trip: Trip; pool: Recommendation[]; meta: DraftMeta | null };

/** Reads a value under its current key, moving it over from the pre-rename key if needed. */
export function readMigrated(key: string, legacyKey: string): string | null {
  const current = window.localStorage.getItem(key);
  if (current !== null) return current;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy !== null) {
    try {
      window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
    } catch {
      // Storage full or blocked: keep reading the old key.
    }
  }
  return legacy;
}

export function saveTrip(stored: StoredTrip) {
  try {
    window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the trip simply won't survive a reload.
  }
}

export function loadTrip(): StoredTrip | null {
  try {
    const raw = readMigrated(TRIP_STORAGE_KEY, LEGACY_TRIP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTrip;
    return parsed?.trip?.days ? { trip: parsed.trip, pool: parsed.pool ?? [], meta: parsed.meta ?? null } : null;
  } catch {
    return null;
  }
}

export function clearTrip() {
  try {
    window.localStorage.removeItem(TRIP_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
