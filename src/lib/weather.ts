/**
 * Weather for trip days from Open-Meteo. Inside the 16-day forecast window it's a forecast;
 * further out it's what the same dates looked like last year, labelled as such — a useful guide
 * to "pack a jacket", never presented as a prediction.
 */

export type DayWeather = {
  date: string;
  code: number;
  max: number;
  min: number;
  /** Forecast only: highest chance of precipitation that day, in percent. */
  rainChance: number | null;
  /** Typical only: precipitation that fell on the same date last year, in mm. */
  rainMm: number | null;
  rainy: boolean;
};

export type TripWeather = { kind: "forecast" | "typical"; days: DayWeather[] };

export type WeatherIcon = "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather interpretation codes, as Open-Meteo reports them. */
export function describeWeather(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code <= 2) return { label: "Partly cloudy", icon: "partly" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
  return { label: "Mixed", icon: "cloud" };
}

export function isRainy(code: number, rainChance: number | null, rainMm: number | null): boolean {
  const wetCode = (code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  if (rainChance !== null) return wetCode && rainChance >= 55;
  if (rainMm !== null) return rainMm >= 5;
  return wetCode;
}
