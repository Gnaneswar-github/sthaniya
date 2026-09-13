import type { WeatherIcon } from "@/lib/weather";

const PATHS: Record<WeatherIcon, string[]> = {
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"],
  partly: ["M8 10.5a3.5 3.5 0 1 1 6.2-2.2", "M7.5 19h9a3.5 3.5 0 1 0-.8-6.9A4.5 4.5 0 0 0 7 13.5 2.8 2.8 0 0 0 7.5 19Z", "M8 3v1.2M3.8 7H5M4.8 3.8l.9.9"],
  cloud: ["M7 18.5h10a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.5 12 3.3 3.3 0 0 0 7 18.5Z"],
  fog: ["M7 12.5h10a4 4 0 1 0-.9-7.9", "M4 16h16M6 19.5h12"],
  drizzle: ["M7 14h10a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.5 7.5 3.3 3.3 0 0 0 7 14Z", "M9 17.5l-.5 1.5M13 17.5l-.5 1.5M17 17.5l-.5 1.5"],
  rain: ["M7 13h10a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.5 6.5 3.3 3.3 0 0 0 7 13Z", "M8.5 16l-1.2 3.5M12.5 16l-1.2 3.5M16.5 16l-1.2 3.5"],
  snow: ["M7 13h10a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.5 6.5 3.3 3.3 0 0 0 7 13Z", "M8.5 17h.01M12 19h.01M15.5 17h.01M10 21h.01M14 21h.01"],
  storm: ["M7 12.5h10a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.5 6 3.3 3.3 0 0 0 7 12.5Z", "M12.5 14l-2.5 4h3l-2 4"],
};

export function WeatherGlyph({ icon, className = "h-4 w-4" }: { icon: WeatherIcon; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
