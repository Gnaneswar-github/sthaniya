import { PHOTOS } from "./data/photos";
import { PUNE } from "./data/pune";
import { supabase } from "./supabase";
import type { Interest, LocalityTag, Recommendation } from "./types";

/**
 * Single seam between the app and the recommendation dataset.
 *
 * Supabase is the source of truth so the data can be corrected in the dashboard without a
 * redeploy — which matters during the verification pass. The seeded files stay in the repo
 * as a fallback: a live demo should not go blank because a network call failed on stage.
 */

const SEEDED: Recommendation[] = [...PUNE];

type Row = {
  id: string;
  name: string;
  destination: string;
  tag: LocalityTag;
  interests: Interest[];
  window_start: string;
  window_end: string;
  vibe: string;
  description: string;
  why_it_fits: Record<string, string>;
  evidence_source: string;
  verified: boolean;
  priority: number;
};

function fromRow(row: Row): Recommendation {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    tag: row.tag,
    interests: row.interests,
    timeWindow: { start: row.window_start, end: row.window_end },
    vibe: row.vibe,
    description: row.description,
    whyItFits: row.why_it_fits,
    evidenceSource: row.evidence_source,
    verified: row.verified,
    priority: row.priority,
  };
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function withPhotos(records: Recommendation[]): Recommendation[] {
  return records.map((rec) => ({ ...rec, photo: PHOTOS[rec.id] }));
}

export async function getRecommendations(destination: string): Promise<Recommendation[]> {
  const wanted = normalise(destination);

  if (supabase) {
    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .ilike("destination", wanted);

    if (!error && data && data.length > 0) {
      return withPhotos((data as Row[]).map(fromRow));
    }
  }

  return withPhotos(SEEDED.filter((r) => normalise(r.destination) === wanted));
}
