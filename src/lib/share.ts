import type { Recommendation, Trip } from "./types";

/**
 * Share links that need no server and no account: the trip itself travels in the URL fragment,
 * compressed. The fragment is never sent to our server, so a shared trip stays between the
 * people who have the link.
 */

export type SharedTrip = { v: 1; trip: Trip; pool: Recommendation[] };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeTrip(trip: Trip, pool: Recommendation[]): Promise<string> {
  const used = new Set(trip.days.flatMap((d) => d.items.map((i) => i.place.id)));
  // Keep a handful of unused places so the recipient can still swap and add.
  const spare = pool.filter((p) => !used.has(p.id)).slice(0, 12);
  const payload: SharedTrip = { v: 1, trip, pool: spare };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(await transform(json, new CompressionStream("deflate-raw")));
}

export async function decodeTrip(encoded: string): Promise<SharedTrip | null> {
  try {
    const bytes = await transform(fromBase64Url(encoded), new DecompressionStream("deflate-raw"));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SharedTrip;
    if (parsed?.v !== 1 || !parsed.trip?.days) return null;
    return parsed;
  } catch {
    return null;
  }
}
