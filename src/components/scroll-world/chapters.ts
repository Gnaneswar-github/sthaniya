/**
 * The scene ledger: every chapter's story beat, camera and world state as data, so the page,
 * the camera rig and the lighting all read from one contract instead of scattered thresholds.
 *
 * The light follows the site's own cycle — sunset, golden hour, dusk, night, dawn — and each
 * chapter tells one true thing about how Sthānīya works. No chapter differs only by copy: each
 * moves the camera somewhere new and changes the time of day.
 */

export type Vec3 = readonly [number, number, number];

export type WorldState = {
  skyTop: string;
  horizon: string;
  sea: string;
  /** Degrees above the horizon; negative is below it. */
  sunElevation: number;
  /** Degrees around the island, 0 facing the town's seaward side. */
  sunAzimuth: number;
  sunColor: string;
  sunIntensity: number;
  /** How much the sun disc and its halo show in the sky. */
  sunGlow: number;
  moon: number;
  hemi: number;
  fog: number;
  windows: number;
  lanterns: number;
  stars: number;
  beam: number;
  exposure: number;
};

export type Chapter = {
  id: string;
  /** Short name for the chapter rail. */
  label: string;
  eyebrow: string;
  title: string;
  accent?: string;
  body: string;
  /** Scroll dwell as a multiple of the viewport height. */
  weight: number;
  camera: {
    position: Vec3;
    target: Vec3;
    fov: number;
    /** Authored phone framing, used when an automatic pull-back would frame the wrong thing. */
    mobile?: { position: Vec3; target: Vec3; fov: number };
  };
  world: WorldState;
};

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "arrive",
    label: "Arrive",
    eyebrow: "Your next journey",
    title: "Travel like you",
    accent: "actually live there.",
    body: "Describe the trip the way you'd describe it to a friend. We read it, show you exactly what we understood, and build something you can argue with.",
    weight: 1,
    camera: { position: [70, 22, 330], target: [0, 16, 40], fov: 40 },
    world: {
      skyTop: "#12324a",
      horizon: "#f2955e",
      sea: "#1d4b60",
      sunElevation: 3,
      sunAzimuth: 115,
      sunColor: "#ffae6b",
      sunIntensity: 2.4,
      sunGlow: 1,
      moon: 0,
      hemi: 0.9,
      fog: 0.0016,
      windows: 0.25,
      lanterns: 0.1,
      stars: 0,
      beam: 0,
      exposure: 1.05,
    },
  },
  {
    id: "tell",
    label: "Tell us",
    eyebrow: "In your own words",
    title: "Say it the way",
    accent: "you'd tell a friend.",
    body: "Three days, your partner, quiet temples, no crowds, a budget in any currency. One sentence is enough — we pick out the dates, the pace and what you'd rather skip.",
    weight: 1.3,
    camera: { position: [78, 14, 212], target: [8, 7, 132], fov: 46 },
    world: {
      skyTop: "#3f7fa0",
      horizon: "#f7c875",
      sea: "#2f7282",
      sunElevation: 15,
      sunAzimuth: 60,
      sunColor: "#ffd494",
      sunIntensity: 2.8,
      sunGlow: 0.75,
      moon: 0,
      hemi: 1.15,
      fog: 0.0018,
      windows: 0,
      lanterns: 0,
      stars: 0,
      beam: 0,
      exposure: 1.1,
    },
  },
  {
    id: "understood",
    label: "Understood",
    eyebrow: "Nothing hidden",
    title: "See exactly what",
    accent: "we understood.",
    body: "Every detail we read shows the words it came from, so you can adjust anything before a single stop is chosen.",
    weight: 1.3,
    camera: { position: [-34, 28, 132], target: [0, 18, 70], fov: 50 },
    world: {
      skyTop: "#161c3c",
      horizon: "#c46a78",
      sea: "#1c2748",
      sunElevation: -3,
      sunAzimuth: 125,
      sunColor: "#ff8f7d",
      sunIntensity: 0.9,
      sunGlow: 0.55,
      moon: 0.2,
      hemi: 0.85,
      fog: 0.0022,
      windows: 0.85,
      lanterns: 0.95,
      stars: 0.3,
      beam: 0.35,
      exposure: 1.1,
    },
  },
  {
    id: "real",
    label: "Real places",
    eyebrow: "On the map",
    title: "Real places,",
    accent: "never invented.",
    body: "Every stop is a place that exists, drawn from OpenStreetMap and Wikipedia, then arranged around your season, your pace and the things you love.",
    weight: 1.3,
    camera: { position: [48, 56, 58], target: [-14, 44, -12], fov: 46 },
    world: {
      skyTop: "#04070f",
      horizon: "#1b2552",
      sea: "#0b1430",
      sunElevation: 34,
      sunAzimuth: -40,
      sunColor: "#9fb3ff",
      sunIntensity: 0.55,
      sunGlow: 0,
      moon: 1,
      hemi: 0.38,
      fog: 0.0022,
      windows: 1,
      lanterns: 1,
      stars: 1,
      beam: 1,
      exposure: 1.15,
    },
  },
  {
    id: "yours",
    label: "Yours",
    eyebrow: "Morning, your way",
    title: "Then make it",
    accent: "entirely yours.",
    body: "Swap a stop, make it more local, slow a day down. It's a plan you can shape, not a verdict.",
    weight: 1.2,
    // On a phone the pull-back would slide behind the island's dark far slope, so the
    // sunrise gets its own framing from above the lower town.
    camera: {
      position: [6, 64, 22],
      target: [0, 32, 260],
      fov: 54,
      mobile: { position: [0, 58, 70], target: [0, 8, 230], fov: 62 },
    },
    world: {
      skyTop: "#1f6676",
      horizon: "#f4bd8e",
      sea: "#2b6c78",
      sunElevation: 5,
      sunAzimuth: -8,
      sunColor: "#ffc59a",
      sunIntensity: 2.1,
      sunGlow: 1,
      moon: 0,
      hemi: 1,
      fog: 0.0017,
      windows: 0.12,
      lanterns: 0.2,
      stars: 0.08,
      beam: 0.15,
      exposure: 1.05,
    },
  },
];
