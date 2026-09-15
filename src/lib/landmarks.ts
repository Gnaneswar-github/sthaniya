import { allowedInterests, categoryFromFacts, fameOf } from "./grounding";
import type { Candidate } from "./places/overpass";
import type { Interest } from "./types";

/**
 * The one or two places in a town most visitors would regret missing — highest fame × fit — taken
 * straight from the candidate list. The model may skip them; the trip still considers them, so
 * "More local" and "Slow it down" have an anchor to keep. Chosen by code from real map and Wikipedia
 * entries, so this never adds a place that doesn't exist.
 */
export function landmarkCandidates(candidates: Candidate[], interests: Interest[], limit = 2): Candidate[] {
  return candidates
    .map((candidate) => {
      const category = categoryFromFacts(candidate.facts, candidate.name);
      const allowed = allowedInterests(category, candidate.facts);
      const hits = interests.filter((interest) => allowed.includes(interest)).length;
      const fame = fameOf(candidate.facts);
      return { candidate, fame, weight: fame * (hits + (interests.length === 0 ? 1 : 0)) };
    })
    .filter(({ fame, weight }) => fame >= 0.45 && weight > 0)
    .sort((a, b) => b.weight - a.weight || (a.candidate.facts.distanceKm ?? 99) - (b.candidate.facts.distanceKm ?? 99))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
