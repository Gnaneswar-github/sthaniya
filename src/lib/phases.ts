/**
 * One light cycle across the product, so every surface has its own imagery while staying
 * recognisably the same site: discovery at sunset, understanding in golden hour, a trip in
 * morning light, and the honest "we don't have this yet" moment at dusk.
 *
 * The shared wave divider, gradient construction and type carry the identity; only the
 * photograph and the tint change. Every image is licensed and credited.
 */
export type Phase = "sunset" | "golden" | "dawn" | "dusk";

export type PhaseSpec = {
  image: string;
  credit: string;
  /** Tailwind gradient classes. Same construction everywhere, different hue per phase. */
  wash: string;
  veil: string;
};

export const PHASES: Record<Phase, PhaseSpec> = {
  sunset: {
    image: "/hero/santorini.jpg",
    credit: "Santorini · Sidvics / CC BY-SA 4.0",
    wash: "bg-gradient-to-r from-deep-2/95 via-deep/70 to-deep/25",
    veil: "bg-gradient-to-t from-deep-2/85 via-transparent to-deep-2/45",
  },
  golden: {
    image: "/hero/golden.jpg",
    credit: "Montreal at golden hour · Wilfredor / CC0",
    wash: "bg-gradient-to-r from-[#3a2410]/95 via-[#5c3a18]/72 to-[#8a5a22]/30",
    veil: "bg-gradient-to-t from-[#2a1a0c]/88 via-transparent to-[#3a2410]/40",
  },
  dawn: {
    image: "/hero/dawn.jpg",
    credit: "Tengger caldera at first light · Justin Raycraft / CC BY 2.0",
    wash: "bg-gradient-to-r from-[#0b2b36]/94 via-[#134653]/70 to-[#1d6473]/28",
    veil: "bg-gradient-to-t from-[#08212a]/85 via-transparent to-[#0b2b36]/40",
  },
  dusk: {
    image: "/hero/dusk.jpg",
    credit: "Twilight panorama · Diliff / CC BY-SA 3.0",
    // Heavier than the other phases on purpose: this photograph is full of city lights
    // exactly where the headline sits, and a lighter wash left the text unreadable.
    wash: "bg-gradient-to-r from-[#0b0f24]/97 via-[#171d3d]/90 to-[#2a3158]/60",
    veil: "bg-gradient-to-t from-[#080b1c]/88 via-[#0b0f24]/35 to-[#0b0f24]/55",
  },
};
