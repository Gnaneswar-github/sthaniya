import { ImageResponse } from "next/og";

/** App icons for installation, drawn at build time rather than shipped as files. */
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

const CARDINAL = [
  "M32 4c5 7 5 17 0 24-5-7-5-17 0-24Z",
  "M32 60c-5-7-5-17 0-24 5 7 5 17 0 24Z",
  "M4 32c7-5 17-5 24 0-7 5-17 5-24 0Z",
  "M60 32c-7 5-17 5-24 0 7-5 17-5 24 0Z",
];
const DIAGONAL = [
  "M12.2 12.2c8.4 1.6 14.2 7.4 15.8 15.8-8.4-1.6-14.2-7.4-15.8-15.8Z",
  "M51.8 51.8c-8.4-1.6-14.2-7.4-15.8-15.8 8.4 1.6 14.2 7.4 15.8 15.8Z",
  "M51.8 12.2c-1.6 8.4-7.4 14.2-15.8 15.8 1.6-8.4 7.4-14.2 15.8-15.8Z",
  "M12.2 51.8c1.6-8.4 7.4-14.2 15.8-15.8-1.6 8.4-7.4 14.2-15.8 15.8Z",
];

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size === "maskable";
  const px = size === "192" ? 192 : 512;
  // Maskable icons get cropped to a circle by some launchers, so the mark sits inside the safe zone.
  const mark = Math.round(px * (maskable ? 0.5 : 0.64));

  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d2f42 0%, #071c29 100%)",
          borderRadius: maskable ? 0 : Math.round(px * 0.22),
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 64 64">
          {CARDINAL.map((d) => (
            <path key={d} d={d} fill="#f5c164" />
          ))}
          {DIAGONAL.map((d) => (
            <path key={d} d={d} fill="#2fbf87" />
          ))}
          <circle cx="32" cy="32" r="4.5" fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
