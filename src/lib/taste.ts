import { CATEGORIES, type Category, type TasteProfile } from "./types";

/**
 * Taste learned only from a traveller's own edits — "More like this" and "Not for me" — and kept
 * on their device. It nudges ranking and is described to the model in plain words; it never
 * leaves the browser except as part of a trip request.
 */

const KEY = "sthaniya.taste.v1";
const CAP = 5;

export const emptyTaste = (): TasteProfile => ({ likes: {}, dislikes: {} });

export function readTaste(): TasteProfile {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyTaste();
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    return { likes: parsed.likes ?? {}, dislikes: parsed.dislikes ?? {} };
  } catch {
    return emptyTaste();
  }
}

export function recordTaste(category: Category, signal: "like" | "dislike"): TasteProfile {
  const taste = readTaste();
  const bucket = signal === "like" ? taste.likes : taste.dislikes;
  bucket[category] = Math.min((bucket[category] ?? 0) + 1, CAP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(taste));
  } catch {
    // Blocked storage: the preference simply isn't remembered.
  }
  return taste;
}

export function hasTaste(taste?: TasteProfile): boolean {
  return Boolean(taste && (Object.values(taste.likes).some(Boolean) || Object.values(taste.dislikes).some(Boolean)));
}

/** "enjoys museums, cafés; less keen on markets" — or "" when nothing has been learned. */
export function tasteSummary(taste?: TasteProfile): string {
  if (!taste) return "";
  const ranked = (bucket: TasteProfile["likes"]) =>
    Object.entries(bucket)
      .filter(([, n]) => (n ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([category]) => (CATEGORIES[category as Category] ?? category).toLowerCase());

  const likes = ranked(taste.likes);
  const dislikes = ranked(taste.dislikes);
  return [likes.length ? `enjoys ${likes.join(", ")}` : "", dislikes.length ? `less keen on ${dislikes.join(", ")}` : ""]
    .filter(Boolean)
    .join("; ");
}
