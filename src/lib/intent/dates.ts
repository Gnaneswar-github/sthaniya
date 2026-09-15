import { addDays } from "../legs";

/**
 * When a trip is, read from the sentence. "Today" is the traveller's own today — their timezone,
 * not the server's — and it is injected, so tests never depend on the real date.
 *
 * Anything we had to choose ("next month" → a particular weekend) is marked `guessed`, and the
 * interface says "we picked these dates — change them". Nothing ever silently becomes tomorrow.
 */

export type Clock = { now: Date; timeZone?: string };

export type DateReading = {
  startDate: string;
  /** Set only when the sentence gave an end (a range). Otherwise the duration decides. */
  endDate: string | null;
  guessed: boolean;
  matched: string;
};

const MONTH_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
const ORDINAL = "(?:st|nd|rd|th)?";
const monthOf = (word: string) => MONTH_INDEX[word.toLowerCase().replace(".", "")];

export function todayIso(clock: Clock): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: clock.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(clock.now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return clock.now.toISOString().slice(0, 10);
  }
}

const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const weekdayOf = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).getUTCDay();
const onOrAfter = (isoDate: string, weekday: number) => addDays(isoDate, (weekday - weekdayOf(isoDate) + 7) % 7);
const later = (a: string, b: string) => (a > b ? a : b);
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** The next time this month and day come round, today included. */
function forward(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4));
  if (day < 1 || day > daysIn(year, month)) return null;
  const thisYear = iso(year, month, day);
  return thisYear >= today ? thisYear : iso(year + 1, month, day);
}

export function parseWhen(text: string, clock: Clock, options: { longWeekend?: boolean } = {}): DateReading | null {
  const today = todayIso(clock);
  const year = Number(today.slice(0, 4));
  const monthNow = Number(today.slice(5, 7)) - 1;
  const weekday = weekdayOf(today);
  const long = Boolean(options.longWeekend);

  // A range: "12–15 Oct", "Oct 12 to 15".
  let hit = text.match(new RegExp(`\\b(\\d{1,2})${ORDINAL}\\s*(?:-|–|—|to|until|till)\\s*(\\d{1,2})${ORDINAL}\\s+(?:of\\s+)?${MONTH}\\b`, "i"));
  if (hit) {
    const month = monthOf(hit[3]);
    const start = forward(today, month, Number(hit[1]));
    if (start && Number(hit[2]) >= Number(hit[1])) {
      return { startDate: start, endDate: iso(Number(start.slice(0, 4)), month, Math.min(Number(hit[2]), daysIn(Number(start.slice(0, 4)), month))), guessed: false, matched: hit[0] };
    }
  }
  hit = text.match(new RegExp(`\\b${MONTH}\\s+(\\d{1,2})${ORDINAL}\\s*(?:-|–|—|to|until|till)\\s*(\\d{1,2})${ORDINAL}\\b`, "i"));
  if (hit) {
    const month = monthOf(hit[1]);
    const start = forward(today, month, Number(hit[2]));
    if (start && Number(hit[3]) >= Number(hit[2])) {
      return { startDate: start, endDate: iso(Number(start.slice(0, 4)), month, Math.min(Number(hit[3]), daysIn(Number(start.slice(0, 4)), month))), guessed: false, matched: hit[0] };
    }
  }

  // A single day: "3 October", "October 3rd".
  hit = text.match(new RegExp(`\\b(\\d{1,2})${ORDINAL}\\s+(?:of\\s+)?${MONTH}\\b`, "i"));
  if (hit) {
    const start = forward(today, monthOf(hit[2]), Number(hit[1]));
    if (start) return { startDate: start, endDate: null, guessed: false, matched: hit[0] };
  }
  hit = text.match(new RegExp(`\\b${MONTH}\\s+(\\d{1,2})${ORDINAL}\\b(?!\\s*(?:days?|nights?|weeks?|people|of us|,\\s*\\d))`, "i"));
  if (hit) {
    const start = forward(today, monthOf(hit[1]), Number(hit[2]));
    if (start) return { startDate: start, endDate: null, guessed: false, matched: hit[0] };
  }

  // Relative days.
  hit = text.match(/\bday after tomorrow\b/i);
  if (hit) return { startDate: addDays(today, 2), endDate: null, guessed: false, matched: hit[0] };
  hit = text.match(/\btomorrow\b/i);
  if (hit) return { startDate: addDays(today, 1), endDate: null, guessed: false, matched: hit[0] };
  hit = text.match(/\b(?:today|tonight)\b/i);
  if (hit) return { startDate: today, endDate: null, guessed: false, matched: hit[0] };

  // Weekends, weeks and months. A long weekend starts on the Friday.
  const saturday = weekday === 6 ? today : weekday === 0 ? addDays(today, -1) : onOrAfter(today, 6);
  const weekendStart = (sat: string) => later(long ? addDays(sat, -1) : sat, today);

  hit = text.match(/\bnext weekend\b/i);
  if (hit) return { startDate: later(long ? addDays(saturday, 6) : addDays(saturday, 7), today), endDate: null, guessed: true, matched: hit[0] };
  hit = text.match(/\b(?:this|this coming|the coming|coming) (?:long )?weekend\b/i);
  if (hit) return { startDate: weekendStart(saturday), endDate: null, guessed: true, matched: hit[0] };
  hit = text.match(/\bnext week\b/i);
  if (hit) return { startDate: addDays(today, (8 - weekday) % 7 || 7), endDate: null, guessed: true, matched: hit[0] };
  hit = text.match(/\bnext month\b/i);
  if (hit) {
    const first = monthNow === 11 ? iso(year + 1, 0, 1) : iso(year, monthNow + 1, 1);
    return { startDate: long ? onOrAfter(first, 5) : first, endDate: null, guessed: true, matched: hit[0] };
  }

  // A named month: "in November", "early March", "mid-October". "May" needs a preposition.
  for (const month of text.matchAll(new RegExp(`\\b(?:(in|during|for|next|this)\\s+)?(?:(early|mid|middle of|late|end of|start of|beginning of)[\\s-]+)?${MONTH}\\b`, "gi"))) {
    const word = month[3].toLowerCase();
    if (word === "may" && !month[1] && !month[2]) continue;
    if (word === "mar" && !month[1] && !month[2]) continue;
    const index = monthOf(word);
    const qualifier = month[2]?.toLowerCase() ?? "";
    const day = /early|start|beginning/.test(qualifier) ? 1 : /mid|middle/.test(qualifier) ? 15 : /late|end/.test(qualifier) ? 22 : 1;
    const targetYear = index < monthNow ? year + 1 : year;
    let start = iso(targetYear, index, day);
    if (long) start = onOrAfter(start, 5);
    if (start <= today) start = addDays(today, 1);
    return { startDate: start, endDate: null, guessed: true, matched: month[0].trim() };
  }

  // Festivals with a fixed date.
  hit = text.match(/\bchristmas\b/i);
  if (hit) return { startDate: forward(today, 11, 24)!, endDate: null, guessed: true, matched: hit[0] };
  hit = text.match(/\bnew year(?:'s)?(?: eve)?\b/i);
  if (hit) return { startDate: forward(today, 11, 30)!, endDate: null, guessed: true, matched: hit[0] };

  // A bare "weekend" or "long weekend" means the coming one.
  hit = text.match(/\b(?:long )?weekend\b/i);
  if (hit) return { startDate: weekendStart(saturday), endDate: null, guessed: true, matched: hit[0] };

  return null;
}
