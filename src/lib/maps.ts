/**
 * A Google Maps link for a named place, using the public Maps URLs scheme — no API key, and it
 * opens Google's own listing (photos, hours, reviews) rather than anything we'd have to source.
 *
 * The destination is appended so "Koshy's" finds the one in Bengaluru, not a namesake elsewhere,
 * unless the name already carries it.
 */
export function googleMapsUrl(name: string, near?: string | null): string {
  const place = name.trim();
  const context = near?.trim();
  const query =
    context && !place.toLowerCase().includes(context.toLowerCase()) ? `${place}, ${context}` : place;
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
}
