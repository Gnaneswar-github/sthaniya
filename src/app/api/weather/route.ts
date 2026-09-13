import { isRainy, type DayWeather, type TripWeather } from "@/lib/weather";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Daily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: (number | null)[];
  precipitation_sum?: (number | null)[];
};

/** GET ?lat&lng&start=YYYY-MM-DD&end=YYYY-MM-DD → TripWeather */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const start = Date.parse(url.searchParams.get("start") ?? "");
  const end = Date.parse(url.searchParams.get("end") ?? "");

  if (![lat, lng, start, end].every(Number.isFinite) || end < start || end - start > 21 * DAY) {
    return Response.json({ error: "lat, lng, start and end (≤ 21 days) are required" }, { status: 400 });
  }

  const now = Date.now();
  const forecastable = start >= now - DAY && end <= now + 15 * DAY;
  const tripDates = Array.from({ length: Math.round((end - start) / DAY) + 1 }, (_, i) => iso(start + i * DAY));

  // Outside the forecast window: the same calendar dates in the most recent year that has data.
  let yearsBack = 0;
  if (!forecastable) {
    yearsBack = 1;
    while (end - yearsBack * 365.25 * DAY > now - 6 * DAY) yearsBack += 1;
  }
  const shift = (ms: number) => {
    const date = new Date(ms);
    date.setUTCFullYear(date.getUTCFullYear() - yearsBack);
    return iso(date.getTime());
  };

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    timezone: "auto",
    start_date: forecastable ? iso(start) : shift(start),
    end_date: forecastable ? iso(end) : shift(end),
    daily: forecastable
      ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
      : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
  });
  const host = forecastable ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";

  try {
    const response = await fetch(`${host}?${params}`, {
      next: { revalidate: forecastable ? 10_800 : 604_800 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
    const daily = ((await response.json()) as { daily?: Daily }).daily ?? {};

    const days: DayWeather[] = (daily.time ?? []).map((_, i) => {
      const code = daily.weather_code?.[i] ?? 0;
      const rainChance = forecastable ? (daily.precipitation_probability_max?.[i] ?? null) : null;
      const rainMm = forecastable ? null : (daily.precipitation_sum?.[i] ?? null);
      return {
        date: tripDates[i] ?? daily.time![i],
        code,
        max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        rainChance,
        rainMm,
        rainy: isRainy(code, rainChance, rainMm),
      };
    });

    const result: TripWeather = { kind: forecastable ? "forecast" : "typical", days };
    return Response.json(result);
  } catch {
    return Response.json({ error: "Weather is unavailable right now." }, { status: 502 });
  }
}
