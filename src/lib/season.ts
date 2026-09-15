/** Seasons differ by hemisphere; a December trip is not winter everywhere. */
export function seasonFor(isoDate: string, lat: number | null): string {
  const month = new Date(isoDate).getUTCMonth();
  if (Number.isNaN(month)) return "unknown season";

  const northern = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const season = northern[month];
  if (lat === null) return season;

  if (lat >= -23.5 && lat <= 23.5) {
    return month >= 4 && month <= 9 ? "tropical wet season" : "tropical dry season";
  }
  if (lat < 0) {
    const flipped: Record<string, string> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
    return flipped[season] ?? season;
  }
  return season;
}
