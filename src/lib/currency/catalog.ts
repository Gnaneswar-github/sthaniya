/**
 * Currency reference data. Symbols and country mappings are facts about money, not
 * destination content — and `Intl` owns all the formatting rules, so nothing here encodes
 * decimal places or grouping.
 */

export type CurrencyCode = string;

export type Currency = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Locale used for grouping conventions — en-IN gives INR its lakh/crore grouping. */
  locale: string;
};

export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", locale: "si-LK" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", locale: "ar-AE" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "THB", name: "Thai Baht", symbol: "฿", locale: "th-TH" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ" },
  { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", locale: "ms-MY" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", locale: "vi-VN" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", locale: "tr-TR" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", locale: "es-MX" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", locale: "ko-KR" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", locale: "zh-CN" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾", locale: "ka-GE" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "DH", locale: "ar-MA" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", locale: "ne-NP" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: CurrencyCode): Currency | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function isKnownCurrency(code: string): boolean {
  return BY_CODE.has(code.toUpperCase());
}

/** ISO 3166-1 alpha-2 → currency. Used to infer a sensible default, never to force one. */
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR", LK: "LKR", US: "USD", GB: "GBP", JP: "JPY", AU: "AUD", CA: "CAD",
  SG: "SGD", AE: "AED", TH: "THB", ID: "IDR", CH: "CHF", NZ: "NZD", ZA: "ZAR",
  MY: "MYR", VN: "VND", TR: "TRY", MX: "MXN", BR: "BRL", KR: "KRW", CN: "CNY",
  GE: "GEL", MA: "MAD", NP: "NPR",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", IE: "EUR",
  AT: "EUR", BE: "EUR", GR: "EUR", FI: "EUR", SK: "EUR", SI: "EUR", LV: "EUR",
  LT: "EUR", EE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

/** Symbols and loose words people actually type into a budget box. */
export const SYMBOL_CURRENCY: Record<string, CurrencyCode> = {
  "₹": "INR", $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₺": "TRY",
  "₫": "VND", "₩": "KRW", "₾": "GEL", "฿": "THB",
  rs: "INR", rupees: "INR", rupee: "INR", dollar: "USD", dollars: "USD",
  euro: "EUR", euros: "EUR", pound: "GBP", pounds: "GBP", quid: "GBP",
  yen: "JPY", dirham: "AED", dirhams: "AED", baht: "THB", rupiah: "IDR",
};
