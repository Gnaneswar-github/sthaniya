/**
 * A small reader for OpenStreetMap `opening_hours`, covering the forms places actually use:
 * weekday ranges and lists, several time ranges, "off", "24/7" and public-holiday rules.
 *
 * Anything richer — months, sunrise, week numbers, comments — returns null, and the card then says
 * the hours are listed on the map rather than guessing what they mean. Travellers never see raw
 * OSM syntax either way.
 */

/** Minutes from midnight, [start, end). */
export type Interval = [number, number];
/** Index 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
export type WeekHours = Interval[][];
export type ParsedHours = { week: WeekHours; holidays: "closed" | "open" | "unknown"; alwaysOpen: boolean };

const DAY_CODES: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const DAY = "(?:Su|Mo|Tu|We|Th|Fr|Sa)";
const SELECTOR_ITEM = `(?:${DAY}(?:-${DAY})?|PH)`;
const RULE = new RegExp(`^(?:(${SELECTOR_ITEM}(?:\\s*,\\s*${SELECTOR_ITEM})*)\\s+)?(.+)$`, "i");
const UNSUPPORTED = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|easter|sunrise|sunset|dawn|dusk|SH)\b|["+[\]]|\|\|/i;

function toMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 24 || mins > 59 || (hours === 24 && mins > 0)) return null;
  return hours * 60 + mins;
}

function parseDays(selector: string): { days: number[]; holiday: boolean } | null {
  const days = new Set<number>();
  let holiday = false;
  for (const part of selector.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    if (token === "ph") {
      holiday = true;
      continue;
    }
    const range = token.match(/^(su|mo|tu|we|th|fr|sa)(?:-(su|mo|tu|we|th|fr|sa))?$/);
    if (!range) return null;
    const from = DAY_CODES[range[1]];
    const to = range[2] ? DAY_CODES[range[2]] : from;
    for (let day = from, guard = 0; guard < 7; day = (day + 1) % 7, guard++) {
      days.add(day);
      if (day === to) break;
    }
  }
  return { days: [...days], holiday };
}

function parseTimes(spec: string): Interval[] | null {
  const intervals: Interval[] = [];
  for (const part of spec.split(",")) {
    const match = part.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) return null;
    const start = toMinutes(match[1]);
    let end = toMinutes(match[2]);
    if (start === null || end === null) return null;
    // Past midnight: only today's part counts for planning a day.
    if (end <= start) end = 1440;
    intervals.push([start, end]);
  }
  return intervals.length > 0 ? intervals.sort((a, b) => a[0] - b[0]) : null;
}

export function parseOpeningHours(raw: string | null | undefined): ParsedHours | null {
  const text = raw?.trim();
  if (!text) return null;
  if (/^24\/7$/.test(text)) {
    return { week: Array.from({ length: 7 }, () => [[0, 1440] as Interval]), holidays: "open", alwaysOpen: true };
  }
  if (UNSUPPORTED.test(text)) return null;

  const week: WeekHours = Array.from({ length: 7 }, () => []);
  let holidays: ParsedHours["holidays"] = "unknown";
  let applied = 0;

  for (const rule of text.split(";").map((r) => r.trim()).filter(Boolean)) {
    const match = rule.match(RULE);
    if (!match) return null;
    const selector = match[1];
    const spec = match[2].trim().toLowerCase();
    const closed = spec === "off" || spec === "closed";
    // A bare "off" would close every day; listings that end that way mean something the syntax
    // can't say, so we don't pretend to know.
    if (!selector && closed) return null;

    const selected = selector ? parseDays(selector) : { days: [0, 1, 2, 3, 4, 5, 6], holiday: false };
    if (!selected) return null;
    const intervals = closed ? [] : spec === "24/7" ? [[0, 1440] as Interval] : parseTimes(spec);
    if (!intervals) return null;

    for (const day of selected.days) week[day] = intervals;
    if (selected.holiday) holidays = closed ? "closed" : "open";
    applied += 1;
  }

  return applied > 0 ? { week, holidays, alwaysOpen: false } : null;
}

/** The earliest start at or after `from` that fits a whole visit inside an open interval, or null. */
export function nextOpenStart(hours: ParsedHours, weekday: number, from: number, duration: number): number | null {
  for (const [start, end] of hours.week[weekday] ?? []) {
    const at = Math.max(from, start);
    if (at + duration <= end) return at;
  }
  return null;
}

export function isOpenFor(hours: ParsedHours, weekday: number, start: number, duration: number): boolean {
  return nextOpenStart(hours, weekday, start, duration) === start;
}

export function clockText(minutes: number): string {
  if (minutes === 0 || minutes === 1440) return "midnight";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const span = (intervals: Interval[]) => intervals.map(([s, e]) => `${clockText(s)} – ${clockText(e)}`).join(", ");
const same = (a: Interval[], b: Interval[]) => JSON.stringify(a) === JSON.stringify(b);

/** "Open daily 9 AM – 10 PM", or "Mon–Fri 9 AM – 5 PM · Sat 10 AM – 2 PM · closed Sun". */
export function describeHours(hours: ParsedHours): string {
  if (hours.alwaysOpen) return "Open 24 hours";
  if (ORDER.every((day) => same(hours.week[day], hours.week[1]))) {
    return hours.week[1].length > 0 ? `Open daily ${span(hours.week[1])}` : "Closed";
  }

  const groups: { from: number; to: number; intervals: Interval[] }[] = [];
  for (const day of ORDER) {
    const last = groups.at(-1);
    if (last && same(last.intervals, hours.week[day])) last.to = day;
    else groups.push({ from: day, to: day, intervals: hours.week[day] });
  }
  const label = (group: { from: number; to: number }) => (group.from === group.to ? NAMES[group.from] : `${NAMES[group.from]}–${NAMES[group.to]}`);
  const open = groups.filter((g) => g.intervals.length > 0).map((g) => `${label(g)} ${span(g.intervals)}`);
  const closed = groups.filter((g) => g.intervals.length === 0).map(label);
  return [...open, ...(closed.length > 0 ? [`closed ${closed.join(", ")}`] : [])].join(" · ");
}
