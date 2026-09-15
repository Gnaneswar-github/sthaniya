import { googleMapsUrl } from "./maps";
import { clockLabel } from "./trip-engine";
import type { ItineraryItem, Trip } from "./types";

/**
 * Getting a trip out of Nativa and into the tools people already travel with: their calendar,
 * Google Maps directions, and a message they can paste to whoever they're travelling with.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Floating local time ("wall clock" at the destination), which is what a traveller expects. */
function icsDateTime(isoDate: string, minutesFromMidnight: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + minutesFromMidnight * 60_000);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

const escapeIcs = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 asks for lines of at most 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export function tripToIcs(trip: Trip): string {
  const stamp = icsDateTime(new Date().toISOString().slice(0, 10), new Date().getUTCHours() * 60);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nativa//Trip//EN", "CALSCALE:GREGORIAN"];

  trip.days.forEach((day) => {
    day.items.forEach((item) => {
      const place = item.place;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${item.itemId}@nativa`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDateTime(day.date, item.startMinutes)}`,
        `DTEND:${icsDateTime(day.date, item.startMinutes + item.durationMinutes)}`,
        `SUMMARY:${escapeIcs(place.name)}`,
        `LOCATION:${escapeIcs(`${place.name}, ${place.destination}`)}`,
        `DESCRIPTION:${escapeIcs(`${place.vibe}\n${googleMapsUrl(place.name, place.destination)}`)}`,
        ...(place.coords ? [`GEO:${place.coords.lat};${place.coords.lng}`] : []),
        "END:VEVENT",
      );
    });
  });

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/**
 * Google Maps directions through a day's stops, in order. On foot by default; by car when someone
 * in the group can't walk far, uses a wheelchair or pushes a pram. The URL scheme allows a limited
 * number of waypoints, so very long days are trimmed to the first ten stops.
 */
export function dayDirectionsUrl(items: ItineraryItem[], travelMode: "walking" | "driving" = "walking"): string | null {
  if (items.length === 0) return null;
  const point = (item: ItineraryItem) =>
    item.place.coords ? `${item.place.coords.lat},${item.place.coords.lng}` : `${item.place.name}, ${item.place.destination}`;

  if (items.length === 1) return googleMapsUrl(items[0].place.name, items[0].place.destination);

  const stops = items.slice(0, 10);
  const params = new URLSearchParams({
    api: "1",
    origin: point(stops[0]),
    destination: point(stops[stops.length - 1]),
    travelmode: travelMode,
  });
  const waypoints = stops.slice(1, -1).map(point);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

/** A plain-text version for WhatsApp, Messages or email. */
export function tripToText(trip: Trip): string {
  const header = `${trip.prefs.destination} — ${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}`;
  const body = trip.days.map((day, index) => {
    const date = new Date(day.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const stops = day.items.map((item) => `• ${clockLabel(item.startMinutes)}  ${item.place.name}`).join("\n");
    return `Day ${index + 1} · ${date}\n${stops || "• Free day"}`;
  });
  return [header, ...body, "Planned with Nativa"].join("\n\n");
}
