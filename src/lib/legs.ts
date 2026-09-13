import type { Trip, TripPrefs } from "./types";

/**
 * Multi-city trips. A route is a list of legs — a city and how many days in it — laid end to end
 * from the trip's start date. Each leg is drafted like a trip of its own, then joined.
 */

export type Leg = { destination: string; days: number };

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Applies a route to preferences, keeping the destination label and end date in step. */
export function withLegs(prefs: TripPrefs, legs: Leg[] | undefined): TripPrefs {
  const cleaned = (legs ?? []).map((leg) => ({ destination: leg.destination, days: Math.min(14, Math.max(1, Math.round(leg.days))) }));

  if (cleaned.length < 2) {
    const only = cleaned[0];
    return {
      ...prefs,
      legs: undefined,
      destination: only?.destination || prefs.destination.split(" → ")[0],
      endDate: only ? addDays(prefs.startDate, only.days - 1) : prefs.endDate,
    };
  }

  const total = cleaned.reduce((sum, leg) => sum + leg.days, 0);
  return {
    ...prefs,
    legs: cleaned,
    destination: cleaned.map((leg) => leg.destination).filter(Boolean).join(" → "),
    endDate: addDays(prefs.startDate, total - 1),
  };
}

/** Each leg with its own date range, consecutive from the trip's start. */
export function legDates(prefs: TripPrefs): { destination: string; startDate: string; endDate: string }[] {
  let cursor = prefs.startDate;
  return (prefs.legs ?? []).map((leg) => {
    const startDate = cursor;
    const endDate = addDays(startDate, leg.days - 1);
    cursor = addDays(endDate, 1);
    return { destination: leg.destination, startDate, endDate };
  });
}

/** Joins per-city trips into one, tagging every day with its city. */
export function mergeLegTrips(prefs: TripPrefs, parts: { destination: string; trip: Trip }[]): Trip {
  return {
    id: `trip-${Date.now().toString(36)}`,
    prefs,
    createdAt: new Date().toISOString(),
    days: parts.flatMap((part) => part.trip.days.map((day) => ({ ...day, destination: part.destination }))),
    notes: [...new Set(parts.flatMap((part) => part.trip.notes))],
  };
}
