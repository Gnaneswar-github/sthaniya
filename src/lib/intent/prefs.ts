import { addDays, withLegs } from "../legs";
import type { ParsedIntent } from "../parse-intent";
import type { TripPrefs } from "../types";
import { perDayForGroup } from "./budget";
import { todayIso, type Clock } from "./dates";
import { travellersIn } from "./party";

/** Which values we chose rather than read, so "What we understood" can mark them. */
export type Guesses = {
  dates: boolean;
  travellerType: boolean;
  party: boolean;
  pace: boolean;
  dial: boolean;
  interests: boolean;
  budgetBasis: boolean;
  budgetCurrency: boolean;
};

/**
 * Everything the parser missed falls back to a default the interface flags as a guess. The currency
 * falls back to whatever the traveller is browsing in — never to a fixed one — and the dates never
 * silently become "tomorrow".
 */
export function prefsFromIntent(intent: ParsedIntent, raw: string, displayCurrency: string, clock: Clock = { now: new Date() }): { prefs: TripPrefs; guessed: Guesses } {
  const days = intent.durationDays?.value ?? 3;
  // No time phrase at all: a week from today, clearly marked as our pick.
  const startDate = intent.dates?.startDate ?? addDays(todayIso(clock), 7);
  const endDate = intent.dates?.endDate ?? addDays(startDate, Math.max(0, days - 1));
  const mobility = intent.mobility?.value ?? "none";
  const travellerType = intent.travellerType?.value ?? "solo";

  const base: TripPrefs = {
    destination: intent.destination?.value ?? "",
    startDate,
    endDate,
    travellerType,
    interests: intent.interests.length > 0 ? intent.interests.map((i) => i.value) : ["food", "local_life"],
    dial: intent.dial?.value ?? "local",
    // Limited walking makes a relaxed pace the sensible starting point — still marked as our guess.
    pace: intent.pace?.value ?? (mobility !== "none" ? "relaxed" : "balanced"),
    budgetPerDay: 0,
    budgetCurrency: intent.budget?.currency ?? displayCurrency,
    notes: raw,
    mobility,
    ...(intent.party ? { adults: intent.party.adults, children: intent.party.children } : {}),
  };

  if (intent.budget) {
    const budget = { amount: intent.budget.amount, currency: intent.budget.currency ?? displayCurrency, basis: intent.budget.basis, perPerson: intent.budget.perPerson };
    base.budget = budget;
    base.budgetPerDay = Math.round(perDayForGroup(budget, days, travellersIn(base).total));
  }

  const prefs = intent.legs ? withLegs(base, intent.legs.map(({ destination, days: d }) => ({ destination, days: d }))) : base;

  return {
    prefs,
    guessed: {
      dates: !intent.dates || intent.dates.guessed,
      travellerType: !intent.travellerType,
      party: !intent.party || intent.party.guessed,
      pace: !intent.pace,
      dial: !intent.dial,
      interests: intent.interests.length === 0,
      budgetBasis: Boolean(intent.budget?.basisGuessed),
      budgetCurrency: Boolean(intent.budget && !intent.budget.currency),
    },
  };
}

/** Keeps the derived per-day figure in step whenever days, people or the budget change. */
export function withBudget(prefs: TripPrefs): TripPrefs {
  if (!prefs.budget) return prefs;
  const days = Math.max(1, Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1);
  return { ...prefs, budgetCurrency: prefs.budget.currency, budgetPerDay: Math.round(perDayForGroup(prefs.budget, days, travellersIn(prefs).total)) };
}
