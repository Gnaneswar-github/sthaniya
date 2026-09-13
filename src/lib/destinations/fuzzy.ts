/**
 * Small, dependency-free fuzzy matcher. Good enough to rank a handful of candidates from a
 * geocoder; deliberately not a search engine. If we ever need real relevance, this is the
 * one function to replace.
 */

export function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, capped — we only care whether a short word is a near miss. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0 || b.length === 0) return Math.max(a.length, b.length);

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** 0 → no match, 1 → exact. Tuned so prefixes beat typos and typos still surface. */
export function score(query: string, candidate: string): number {
  const q = normalise(query);
  const c = normalise(candidate);
  if (!q || !c) return 0;

  if (c === q) return 1;
  if (c.startsWith(q)) return 0.9 - Math.min(0.2, (c.length - q.length) / 100);
  if (c.includes(q)) return 0.72;

  const queryTokens = q.split(" ");
  const candidateTokens = c.split(" ");
  const overlap = queryTokens.filter((token) =>
    candidateTokens.some((other) => other === token || other.startsWith(token)),
  ).length;
  if (overlap > 0) return 0.45 + 0.2 * (overlap / queryTokens.length);

  // Typo tolerance, scaled to word length so "Tokio" matches but "Oslo" doesn't match "Cairo".
  const tolerance = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  const best = Math.min(...candidateTokens.map((token) => distance(q, token)), distance(q, c));
  if (best <= tolerance) return 0.4 - best * 0.08;

  return 0;
}
