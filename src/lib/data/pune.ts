import type { Recommendation } from "../types";

/**
 * Seeded anchor spots for Pune.
 *
 * Every record here is `verified: false` until a human has opened the real listing and
 * confirmed the place, its hours and the claim being made about it. PRD §9 treats
 * verification — not the number of cities — as the bar for a city being in scope.
 */
export const PUNE: Recommendation[] = [
  {
    id: "pune-dagdusheth",
    name: "Dagdusheth Halwai Ganpati Temple",
    destination: "Pune",
    tag: "tourist_essential",
    interests: ["spiritual"],
    timeWindow: { start: "06:30", end: "08:00" },
    vibe: "Bright, loud, genuinely moving",
    description:
      "Go at dawn, when it's mostly people on their way to work rather than people on their way to a photo.",
    whyItFits: {
      spiritual: "It's the one temple in Pune that locals and visitors both actually mean when they say 'the temple'.",
      local_life: "Morning darshan here is a daily routine for half the old city, not a tourist ritual.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 1,
  },
  {
    id: "pune-shaniwar-wada",
    name: "Shaniwar Wada",
    destination: "Pune",
    tag: "tourist_essential",
    interests: ["history"],
    timeWindow: { start: "09:00", end: "10:30" },
    vibe: "Open, sunbaked, more ruin than palace",
    description:
      "The Peshwa seat of power, burnt down and left as foundations — go for the scale and the gate, not for furnished rooms.",
    whyItFits: {
      history: "You can't really read Pune's Maratha history without standing in this courtyard first.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 2,
  },
  {
    id: "pune-aga-khan",
    name: "Aga Khan Palace",
    destination: "Pune",
    tag: "tourist_essential",
    interests: ["history"],
    timeWindow: { start: "10:45", end: "12:15" },
    vibe: "Quiet lawns, heavy history",
    description:
      "Gandhi, Kasturba and Mahadev Desai were interned here. The memorials in the garden land harder than the building does.",
    whyItFits: {
      history: "It's the rare freedom-movement site that still feels like a house someone lived in.",
      nature: "The lawns are the calmest green space you'll find this close to the centre.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 3,
  },
  {
    id: "pune-kelkar-museum",
    name: "Raja Dinkar Kelkar Museum",
    destination: "Pune",
    tag: "tourist_essential",
    interests: ["history", "local_life"],
    timeWindow: { start: "11:00", end: "12:30" },
    vibe: "Dense, cluttered, quietly obsessive",
    description:
      "One man's lifetime of collecting ordinary Indian objects — lamps, nutcrackers, door frames. Far better than it sounds.",
    whyItFits: {
      history: "History told through what people actually used at home, not through kings and dates.",
      local_life: "The everyday-object collection explains more about how India lived than any fort will.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 4,
  },
  {
    id: "pune-sinhagad",
    name: "Sinhagad Fort",
    destination: "Pune",
    tag: "tourist_essential",
    interests: ["nature", "history"],
    timeWindow: { start: "06:00", end: "10:00" },
    vibe: "Cold wind, steep climb, enormous view",
    description:
      "An hour out of the city and a real climb. Weekend mornings are crowded with Pune's own trekkers — that's part of the appeal.",
    whyItFits: {
      nature: "The best big-landscape morning available within reach of the city.",
      history: "Tanaji's fort — the one piece of Maratha history Punekars will bring up unprompted.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 5,
  },

  {
    id: "pune-vaishali",
    name: "Vaishali, FC Road",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["food", "local_life"],
    timeWindow: { start: "08:00", end: "09:30" },
    vibe: "Formica tables, unhurried, institution-grade",
    description:
      "Sambar, filter coffee and decades of students arguing at the same tables. Expect to wait; it's worth waiting.",
    whyItFits: {
      food: "This is the breakfast a Punekar would take you to before anything else opens.",
      local_life: "More of Pune's actual social life has happened here than at any monument in the city.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 1,
  },
  {
    id: "pune-bedekar",
    name: "Bedekar Tea Stall",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["food"],
    timeWindow: { start: "08:30", end: "10:00" },
    vibe: "Tiny, brisk, deadly serious about misal",
    description:
      "Pune misal at its sharpest. Order the kat separately if you want to survive it, and don't linger — nobody does.",
    whyItFits: {
      food: "If you eat one thing in Pune that you can't get properly anywhere else, make it this.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 2,
  },
  {
    id: "pune-parvati",
    name: "Parvati Hill",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["spiritual", "nature"],
    timeWindow: { start: "06:00", end: "07:30" },
    vibe: "Stone steps, morning walkers, whole-city view",
    description:
      "A flight of steps up to an old temple complex, climbed daily by half the neighbourhood. Go before the sun is properly up.",
    whyItFits: {
      spiritual: "A working temple people climb to out of habit, not a monument they visit.",
      nature: "The clearest view of Pune you can get without leaving the city.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 3,
  },
  {
    id: "pune-pataleshwar",
    name: "Pataleshwar Cave Temple",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["spiritual", "history"],
    timeWindow: { start: "07:30", end: "09:00" },
    vibe: "Dark, cool, startlingly old",
    description:
      "An 8th-century temple cut straight out of basalt, sitting in the middle of a busy road. Most people drive past it daily.",
    whyItFits: {
      spiritual: "Still an active shrine, and almost always empty enough to sit in.",
      history: "Rock-cut, centuries older than anything Peshwa-era in this city.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 4,
  },
  {
    id: "pune-vetal-tekdi",
    name: "Vetal Tekdi",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["nature", "local_life"],
    timeWindow: { start: "06:00", end: "07:45" },
    vibe: "Dust, birdsong, regulars who all know each other",
    description:
      "The city's own hill. No ticket, no gate — just paths worn in by people who walk them every single morning.",
    whyItFits: {
      nature: "The closest thing to wilderness inside Pune's limits.",
      local_life: "Walking here at 6am is the single most Pune thing you can do.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 5,
  },
  {
    id: "pune-tulshibaug",
    name: "Tulshibaug Market",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["local_life"],
    timeWindow: { start: "17:00", end: "19:00" },
    vibe: "Narrow, crowded, relentlessly practical",
    description:
      "Lanes of household goods, bangles and steel vessels behind an old temple. Come to watch the bargaining, not to buy.",
    whyItFits: {
      local_life: "This is where the city shops for itself, not for visitors.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 6,
  },
  {
    id: "pune-chitale",
    name: "Chitale Bandhu Mithaiwale",
    destination: "Pune",
    tag: "local_favourite",
    interests: ["food"],
    timeWindow: { start: "16:30", end: "17:30" },
    vibe: "Queue, counter, no seating, no nonsense",
    description:
      "Bakarwadi to take home. The shop famously used to shut in the afternoon and the city simply worked around it.",
    whyItFits: {
      food: "The thing Punekars actually carry with them when they travel.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 7,
  },

  {
    id: "pune-shinde-chhatri",
    name: "Shinde Chhatri, Wanowrie",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["history"],
    timeWindow: { start: "15:00", end: "16:30" },
    vibe: "Ornate, empty, oddly solemn",
    description:
      "A memorial to Mahadji Shinde with carving far more elaborate than anything at the famous sites — and usually nobody in it.",
    whyItFits: {
      history: "The best stonework in Pune is in a memorial most visitors never hear about.",
      spiritual: "Quiet enough to sit in for an hour without anyone hurrying you along.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 1,
  },
  {
    id: "pune-kasba-peth",
    name: "Kasba Peth lanes & Kasba Ganpati",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["local_life", "history", "spiritual"],
    timeWindow: { start: "09:00", end: "10:45" },
    vibe: "Old wooden facades, tight lanes, lived-in",
    description:
      "The oldest part of the city, and the home of Pune's presiding Ganpati. Walk it slowly; there is nothing to 'see' and everything to notice.",
    whyItFits: {
      local_life: "The one walk that shows you what Pune was before it became a metro.",
      history: "Older than the Peshwas, and still entirely residential.",
      spiritual: "Kasba Ganpati is the city's gram daivat — first honours in the festival, every year.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 2,
  },
  {
    id: "pune-taljai",
    name: "Taljai Tekdi",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["nature"],
    timeWindow: { start: "06:30", end: "08:00" },
    vibe: "Wooded, quiet, thinner crowd than Vetal",
    description:
      "The hill people go to when Vetal Tekdi feels busy. Denser tree cover, more birds, fewer conversations.",
    whyItFits: {
      nature: "Genuinely peaceful, and almost never mentioned to visitors.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 3,
  },
  {
    id: "pune-marz-o-rin",
    name: "Marz-O-Rin, MG Road",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["food", "local_life"],
    timeWindow: { start: "13:00", end: "14:30" },
    vibe: "Faded Irani cafe, soft light, slow",
    description:
      "Sandwiches, cold coffee and an interior that hasn't been updated in decades — deliberately. An afternoon holdout from an older Pune.",
    whyItFits: {
      food: "Not a destination dish, just a place worth an unhurried hour.",
      local_life: "One of the last Irani-cafe afternoons left in the city.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 4,
  },
  {
    id: "pune-pu-la-garden",
    name: "Pu La Deshpande Garden",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["nature"],
    timeWindow: { start: "08:00", end: "09:30" },
    vibe: "Japanese-garden calm, water, raked stone",
    description:
      "A Japanese-style garden modelled on one in Okayama, sitting incongruously beside a Pune canal. Go early, before the school groups.",
    whyItFits: {
      nature: "Manicured quiet — the opposite of the hills, and a good counterweight to them.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 5,
  },
  {
    id: "pune-khunya-murlidhar",
    name: "Khunya Murlidhar Temple",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["spiritual", "history"],
    timeWindow: { start: "07:00", end: "08:30" },
    vibe: "Small, old, tucked behind the noise",
    description:
      "A peth temple with a grim name and a long story behind it, wedged into a lane most visitors never turn down.",
    whyItFits: {
      spiritual: "Small enough that you'll likely have it to yourself.",
      history: "The kind of place where the story matters more than the building.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 6,
  },
  {
    id: "pune-laxmi-road",
    name: "Laxmi Road at dusk",
    destination: "Pune",
    tag: "hidden_gem",
    interests: ["local_life"],
    timeWindow: { start: "18:00", end: "19:30" },
    vibe: "Shoulder-to-shoulder, lit up, chaotic",
    description:
      "Not a sight — a street. Walk its length in the evening and you'll understand the city's density better than any museum will explain it.",
    whyItFits: {
      local_life: "An hour here beats a day of monuments for actually feeling the place.",
    },
    evidenceSource: "seeded_anchor",
    verified: false,
    priority: 7,
  },
];
