/**
 * What each month was like in a city last year, from Open-Meteo's historical archive. Shown as
 * "last year", never as a promise about next year.
 */
export type MonthClimate = { month: number; high: number; low: number; rainyDays: number };

type Daily = {
  time?: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  precipitation_sum?: (number | null)[];
};

export async function lastYearByMonth(lat: number, lng: number): Promise<{ year: number; months: MonthClimate[] } | null> {
  const year = new Date().getUTCFullYear() - 1;
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
  });

  try {
    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      next: { revalidate: 2_592_000 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const daily = ((await response.json()) as { daily?: Daily }).daily;
    if (!daily?.time?.length) return null;

    const buckets = Array.from({ length: 12 }, () => ({ high: 0, low: 0, n: 0, rainy: 0 }));
    daily.time.forEach((date, i) => {
      const month = Number(date.slice(5, 7)) - 1;
      const high = daily.temperature_2m_max?.[i];
      const low = daily.temperature_2m_min?.[i];
      if (high == null || low == null) return;
      const bucket = buckets[month];
      bucket.high += high;
      bucket.low += low;
      bucket.n += 1;
      if ((daily.precipitation_sum?.[i] ?? 0) >= 1) bucket.rainy += 1;
    });

    const months = buckets.map((b, month) => ({
      month,
      high: b.n ? Math.round(b.high / b.n) : 0,
      low: b.n ? Math.round(b.low / b.n) : 0,
      rainyDays: b.rainy,
    }));
    return { year, months };
  } catch {
    return null;
  }
}
