/**
 * How people actually type place names. This is language data — abbreviations and common
 * shorthand — not destination data, so it doesn't conflict with the rule against hardcoded
 * place lists: every entry expands into a query the geocoder answers for itself.
 */
export const ALIASES: Record<string, string> = {
  nyc: "New York City",
  ny: "New York",
  la: "Los Angeles",
  sf: "San Francisco",
  dc: "Washington, D.C.",
  vegas: "Las Vegas",
  nola: "New Orleans",
  philly: "Philadelphia",
  chi: "Chicago",

  uk: "United Kingdom",
  gb: "United Kingdom",
  usa: "United States",
  us: "United States",
  uae: "United Arab Emirates",
  nz: "New Zealand",

  blr: "Bengaluru",
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  madras: "Chennai",
  calcutta: "Kolkata",
  pondy: "Puducherry",

  saigon: "Ho Chi Minh City",
  ktm: "Kathmandu",
  cbo: "Colombo",
  bkk: "Bangkok",
  kl: "Kuala Lumpur",
  hk: "Hong Kong",
  sg: "Singapore",

  cdmx: "Mexico City",
  ba: "Buenos Aires",
  rio: "Rio de Janeiro",
};

/** Expands a whole-string abbreviation. Leaves anything longer alone. */
export function expandAlias(text: string): string {
  const key = text.trim().toLowerCase().replace(/\./g, "");
  return ALIASES[key] ?? text.trim();
}
