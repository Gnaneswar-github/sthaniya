import { ImageResponse } from "next/og";

/** App icons for installation, drawn at build time rather than shipped as files. */
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size === "maskable";
  const px = size === "192" ? 192 : 512;
  const mark = Math.round(px * (maskable ? 0.46 : 0.58));

  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #071c29 0%, #0d2f42 55%, #15795a 100%)",
          borderRadius: maskable ? 0 : Math.round(px * 0.22),
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 24 24">
          <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" fill="#2fbf87" />
          <path d="M5 19l8-8" stroke="#f5c164" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
