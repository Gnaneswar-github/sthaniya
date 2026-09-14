import Image from "next/image";
import { PHASES, type Phase } from "@/lib/phases";

/**
 * The banner every inner page wears. Same gradient construction, same wave, same type as the
 * landing hero — only the photograph and its tint change, which is what keeps the pages
 * feeling like one product rather than four.
 */
export function PageHero({
  phase,
  title,
  accent,
  subtitle,
  children,
  size = "compact",
}: {
  phase: Phase;
  title: string;
  /** Second line, set in the phase's accent colour. */
  accent?: string;
  subtitle?: string;
  children?: React.ReactNode;
  size?: "compact" | "tall";
}) {
  const spec = PHASES[phase];

  return (
    <section className="relative isolate overflow-hidden bg-deep-2">
      <Image
        src={spec.image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div aria-hidden className={`absolute inset-0 ${spec.wash}`} />
      <div aria-hidden className={`absolute inset-0 ${spec.veil}`} />

      <div
        className={`relative mx-auto w-full max-w-5xl px-5 ${
          size === "tall" ? "pb-32 pt-16 sm:pb-36 sm:pt-20" : "pb-24 pt-14 sm:pb-32 sm:pt-16"
        }`}
      >
        <h1 className="rise max-w-3xl text-balance font-display text-[2.1rem] font-semibold leading-[1.06] text-white sm:text-5xl">
          {title}
          {accent && (
            <>
              {" "}
              <span className="text-gold-bright">{accent}</span>
            </>
          )}
        </h1>

        {subtitle && (
          <p className="rise rise-1 mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
            {subtitle}
          </p>
        )}

        {children && <div className="rise rise-2 mt-6">{children}</div>}
      </div>

      <WaveDivider />

      <p className="pointer-events-none absolute bottom-[62px] right-3 z-10 text-[10px] text-white/55 sm:bottom-[92px]">
        {spec.credit}
      </p>
    </section>
  );
}

/** The paper edge under every banner. Overlaps by a pixel so no hairline of the photo shows through. */
export function WaveDivider() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className="absolute inset-x-0 -bottom-px h-[57px] w-full text-paper sm:h-[87px]"
    >
      <path
        d="M0 62c180-34 340-44 520-30 180 13 300 44 470 44 150 0 300-26 450-56V90H0Z"
        fill="currentColor"
      />
    </svg>
  );
}
