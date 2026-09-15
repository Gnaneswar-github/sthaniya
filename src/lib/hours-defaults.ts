import type { Category } from "./types";

/**
 * When a place lists no `opening_hours` on the map, a regional rule of thumb can still keep the
 * scheduler from sending people to a locked gate. Every rule is shown as "usually" with "check
 * locally" — never as fact. Adjust the values here; nothing else needs to change.
 *
 * To confirm (HANDOFF P0-5, question 1): the midday closing window for temples in Kumbakonam and
 * the rest of the listed states. The values below are the handoff's working assumption.
 */
export type HoursDefault = {
  id: string;
  /** OSM `religion` values the rule applies to. A place with no religion tag matches on `categories`. */
  religions: string[];
  categories: Category[];
  countryCodes: string[];
  /** State or region names as the geocoder reports them. */
  regions: string[];
  /** In opening_hours syntax, so the same reader serves both. */
  hours: string;
  /** Shown on the stop card. */
  note: string;
};

export const HOURS_DEFAULTS: HoursDefault[] = [
  {
    id: "south-india-hindu-temple",
    religions: ["hindu"],
    categories: ["temple"],
    countryCodes: ["IN"],
    regions: ["Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana"],
    hours: "Mo-Su 06:00-12:00,16:00-21:00",
    note: "Usually open about 6 AM – 12 PM and 4 PM – 9 PM, closed around midday. Check locally.",
  },
];

export const hoursDefaultById = (id: string | undefined) => HOURS_DEFAULTS.find((rule) => rule.id === id);

export function matchHoursDefault(input: {
  religion?: string;
  category: Category;
  region?: string | null;
  countryCode?: string | null;
}): HoursDefault | undefined {
  const region = input.region?.trim().toLowerCase();
  if (!region) return undefined;
  return HOURS_DEFAULTS.find(
    (rule) =>
      (input.religion ? rule.religions.includes(input.religion.toLowerCase()) : rule.categories.includes(input.category)) &&
      rule.regions.some((name) => name.toLowerCase() === region) &&
      (!input.countryCode || rule.countryCodes.includes(input.countryCode.toUpperCase())),
  );
}
