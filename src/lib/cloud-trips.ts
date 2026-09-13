import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DraftMeta } from "./generate-events";
import { supabase } from "./supabase";
import type { StoredTrip } from "./trip-storage";
import type { Recommendation, Trip, TripPrefs } from "./types";

/**
 * Trips in the traveller's account, shared with the people they invite. Row-level security in
 * Supabase decides who can read or change what; nothing here is trusted to enforce it.
 */

export type CloudTrip = {
  id: string;
  owner_id: string;
  title: string;
  data: Trip;
  pool: Recommendation[];
  meta: DraftMeta | null;
  invite_code: string;
  updated_at: string;
};

export type CloudTripSummary = {
  id: string;
  title: string;
  updated_at: string;
  owner_id: string;
  prefs: TripPrefs | null;
};

export type Member = { userId: string; role: "owner" | "editor"; name: string };
export type Vote = { placeId: string; userId: string; value: -1 | 1 };

function client() {
  if (!supabase) throw new Error("Accounts aren't configured on this deployment.");
  return supabase;
}

const titleFor = (trip: Trip) =>
  `${trip.prefs.destination} · ${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}`;

export async function createCloudTrip(stored: StoredTrip): Promise<string> {
  const { data, error } = await client()
    .from("trips")
    .insert({ title: titleFor(stored.trip), data: stored.trip, pool: stored.pool, meta: stored.meta })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCloudTrip(id: string, stored: StoredTrip): Promise<void> {
  const { error } = await client()
    .from("trips")
    .update({ title: titleFor(stored.trip), data: stored.trip, pool: stored.pool, meta: stored.meta })
    .eq("id", id);
  if (error) throw error;
}

export async function loadCloudTrip(id: string): Promise<CloudTrip | null> {
  const { data, error } = await client()
    .from("trips")
    .select("id, owner_id, title, data, pool, meta, invite_code, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CloudTrip | null) ?? null;
}

export async function listMyTrips(): Promise<CloudTripSummary[]> {
  const { data, error } = await client()
    .from("trips")
    .select("id, title, updated_at, owner_id, prefs:data->prefs")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CloudTripSummary[];
}

export async function deleteCloudTrip(id: string): Promise<void> {
  const { error } = await client().from("trips").delete().eq("id", id);
  if (error) throw error;
}

export async function joinTrip(code: string): Promise<string> {
  const { data, error } = await client().rpc("join_trip", { code });
  if (error) throw error;
  return data as string;
}

export async function listMembers(tripId: string): Promise<Member[]> {
  const db = client();
  const { data: rows, error } = await db.from("trip_members").select("user_id, role").eq("trip_id", tripId);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? "Traveller"]));
  return (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    role: r.role as Member["role"],
    name: names.get(r.user_id as string) ?? "Traveller",
  }));
}

export async function listVotes(tripId: string): Promise<Vote[]> {
  const { data, error } = await client().from("trip_votes").select("place_id, user_id, value").eq("trip_id", tripId);
  if (error) throw error;
  return (data ?? []).map((v) => ({ placeId: v.place_id as string, userId: v.user_id as string, value: v.value as -1 | 1 }));
}

/** 0 withdraws the vote. */
export async function castVote(tripId: string, placeId: string, userId: string, value: -1 | 0 | 1): Promise<void> {
  const db = client();
  if (value === 0) {
    const { error } = await db.from("trip_votes").delete().match({ trip_id: tripId, place_id: placeId, user_id: userId });
    if (error) throw error;
    return;
  }
  const { error } = await db
    .from("trip_votes")
    .upsert({ trip_id: tripId, place_id: placeId, user_id: userId, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Live updates: the trip itself, its votes and who has joined. Returns an unsubscribe. */
export function subscribeToTrip(
  tripId: string,
  handlers: { onTrip: (row: CloudTrip) => void; onVotes: () => void; onMembers: () => void },
): () => void {
  const db = client();
  const channel: RealtimeChannel = db
    .channel(`trip:${tripId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, (payload) =>
      handlers.onTrip(payload.new as CloudTrip),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "trip_votes", filter: `trip_id=eq.${tripId}` }, () =>
      handlers.onVotes(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` }, () =>
      handlers.onMembers(),
    )
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
