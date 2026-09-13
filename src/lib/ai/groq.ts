import type { GenerationInput, GenerationResult, ItineraryGenerator } from "./types";
import { readEnv } from "@/lib/env";
import { INTERESTS, type Category, type Interest, type LocalityTag, type PriceBand, type Recommendation } from "@/lib/types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const CATEGORIES: Category[] = ["food", "cafe", "temple", "sight", "museum", "market", "outdoors"];
const TAGS: LocalityTag[] = ["tourist_essential", "local_favourite", "hidden_gem"];
const BANDS: PriceBand[] = ["free", "low", "mid", "high", "unknown"];
const INTEREST_IDS = INTERESTS.map((i) => i.id) as Interest[];

const SYSTEM = `You are a local guide writing for Sthānīya, a travel planner whose entire premise is that it does not invent places.

Absolute rules:
- You may ONLY use places from the CANDIDATES list. Never add a place from your own knowledge, however famous. If a candidate list has no good restaurant, return fewer places.
- Never state a fact you cannot support from the candidate data: no prices, no ratings, no opening hours, no history, no claims about what a place serves unless the cuisine tag says so.
- Write about atmosphere, timing and who a place suits. That is judgement, which is yours to give. Specific factual claims are not.
- If you are unsure what a place actually is, leave it out.

Voice: a knowledgeable friend who lives there. Warm, specific, unhurried. Never a listicle, never marketing, never "nestled" or "vibrant" or "must-visit".`;

function userPrompt(input: GenerationInput): string {
  const { prefs, candidates, destination, season, countryName, target } = input;
  const lines = candidates.map(
    (c) =>
      `${c.ref} | ${c.name} | ${c.kind}${c.cuisine ? ` | cuisine: ${c.cuisine}` : ""}${
        c.notable ? " | notable" : ""
      }${c.openingHours ? ` | hours: ${c.openingHours}` : ""}`,
  );

  return `TRAVELLER
Destination: ${destination}${countryName ? `, ${countryName}` : ""}
Dates: ${prefs.startDate} to ${prefs.endDate} (${season})
Group: ${prefs.travellerType}
Interests: ${prefs.interests.join(", ")}
Pace: ${prefs.pace}
How local they want to go: ${prefs.dial} (tourist = famous things, local = a mix, insider = almost no famous things)
Budget per day: ${prefs.budgetPerDay > 0 ? `${prefs.budgetPerDay} ${prefs.budgetCurrency}` : "not stated"}
In their own words: ${prefs.notes || "(nothing else given)"}

CANDIDATES (the only places you may use)
${lines.join("\n")}

TASK
Choose about ${target} places that suit this traveller, this season and this pace.
Spread them across the day: mornings, meals at sensible hours, evenings.
Respect the locality preference when classifying.

Return JSON exactly:
{"places":[{
"ref":"<candidate ref, must exist above>",
"category":"one of ${CATEGORIES.join("|")}",
"tag":"one of ${TAGS.join("|")}",
"priceBand":"one of ${BANDS.join("|")} — use unknown unless it is genuinely free to walk into",
"interests":["from ${INTEREST_IDS.join("|")}"],
"durationMinutes":<30-240>,
"window":{"start":"HH:MM","end":"HH:MM"},
"vibe":"<4-8 words, atmosphere only>",
"description":"<one or two sentences, no invented facts>",
"whyItFits":{"<interest id>":"<one line tying it to what they asked for>"}
}]}`;
}

type RawPlace = {
  ref?: string;
  category?: string;
  tag?: string;
  priceBand?: string;
  interests?: string[];
  durationMinutes?: number;
  window?: { start?: string; end?: string };
  vibe?: string;
  description?: string;
  whyItFits?: Record<string, string>;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class GroqError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(status ? `Groq responded ${status}` : "Groq returned an unreadable response");
  }
}

function clampDuration(value: unknown): number {
  const n = typeof value === "number" ? value : 60;
  return Math.min(240, Math.max(30, Math.round(n)));
}

export class GroqGenerator implements ItineraryGenerator {
  readonly name = "groq";

  /**
   * `models` is an ordered preference list. Groq rate-limits each model separately — 8,000
   * tokens a minute apiece on this plan — so falling back to a second model turns "busy,
   * try later" into a trip for the second traveller who arrives in the same minute.
   */
  constructor(
    private readonly apiKey: string,
    private readonly models: string[],
  ) {}

  get model(): string {
    return this.models[0];
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    let lastError: unknown;
    const attempts = Math.max(3, this.models.length + 1);

    for (let attempt = 0; attempt < attempts; attempt++) {
      const model = this.models[attempt % this.models.length];
      try {
        const result = await this.attempt(input, model);
        if (result.places.length > 0 || attempt === attempts - 1) return result;
        lastError = new Error("Groq chose no usable places");
      } catch (error) {
        lastError = error;
        if (error instanceof GroqError && !error.retryable) throw error;

        // Only wait when every model has had a turn; until then the next model is fresh.
        const cycled = (attempt + 1) % this.models.length === 0;
        const wait = error instanceof GroqError && error.retryAfterMs ? error.retryAfterMs : 1500;
        if (cycled) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 10_000)));
      }
    }
    throw lastError;
  }

  private async attempt(input: GenerationInput, model: string): Promise<GenerationResult> {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(input) },
        ],
        response_format: { type: "json_object" },
        // gpt-oss reasons before answering and those tokens count against the per-minute
        // limit. "low" measured 23 reasoning tokens against 400 at the default, for the
        // same choices — choosing among given places doesn't need deliberation.
        reasoning_effort: "low",
        temperature: 0.5,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new GroqError(
        response.status,
        response.status === 429 || response.status >= 500,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new GroqError(0, true);

    let parsed: { places?: RawPlace[] };
    try {
      parsed = JSON.parse(content) as { places?: RawPlace[] };
    } catch {
      throw new GroqError(0, true);
    }
    return this.toRecommendations(parsed, input, model);
  }

  /**
   * The guardrail. A place is only accepted if its ref matches a candidate we actually
   * retrieved from OpenStreetMap — so an invented restaurant cannot reach the itinerary even
   * if the model produces one. Everything else is clamped into range rather than trusted.
   */
  private toRecommendations(
    parsed: { places?: RawPlace[] },
    input: GenerationInput,
    model: string,
  ): GenerationResult {
    const byRef = new Map(input.candidates.map((c) => [c.ref, c]));
    const seen = new Set<string>();
    const rejected: string[] = [];
    const places: Recommendation[] = [];

    for (const raw of parsed.places ?? []) {
      const candidate = raw.ref ? byRef.get(raw.ref) : undefined;
      if (!candidate) {
        if (raw.ref) rejected.push(raw.ref);
        continue;
      }
      if (seen.has(candidate.ref)) continue;
      seen.add(candidate.ref);

      const interests = (raw.interests ?? []).filter((i): i is Interest =>
        INTEREST_IDS.includes(i as Interest),
      );

      const start = TIME.test(raw.window?.start ?? "") ? raw.window!.start! : "10:00";
      const end = TIME.test(raw.window?.end ?? "") ? raw.window!.end! : "12:00";

      const whyItFits: Partial<Record<Interest, string>> = {};
      for (const [key, line] of Object.entries(raw.whyItFits ?? {})) {
        if (INTEREST_IDS.includes(key as Interest) && typeof line === "string") {
          whyItFits[key as Interest] = line;
        }
      }

      places.push({
        // The name always comes from OpenStreetMap, never from the model.
        id: `ai-${input.destination.toLowerCase().replace(/\s+/g, "-")}-${candidate.ref}`,
        name: candidate.name,
        destination: input.destination,
        tag: TAGS.includes(raw.tag as LocalityTag) ? (raw.tag as LocalityTag) : "local_favourite",
        category: CATEGORIES.includes(raw.category as Category)
          ? (raw.category as Category)
          : "sight",
        priceBand: BANDS.includes(raw.priceBand as PriceBand)
          ? (raw.priceBand as PriceBand)
          : "unknown",
        durationMinutes: clampDuration(raw.durationMinutes),
        coords: candidate.coords,
        interests: interests.length > 0 ? interests : ["local_life"],
        timeWindow: { start, end },
        vibe: (raw.vibe ?? "").slice(0, 80) || candidate.kind,
        description: (raw.description ?? "").slice(0, 400),
        whyItFits,
        evidenceSource: "openstreetmap+ai",
        verified: false,
        priority: places.length + 1,
      });
    }

    // The model that actually answered, which after a fallback isn't the preferred one.
    return { places, rejected, model };
  }
}

export function createGenerator(): ItineraryGenerator | null {
  const apiKey = readEnv("GROQ_API_KEY");
  if (!apiKey) return null;
  const primary = readEnv("GROQ_MODEL") ?? "openai/gpt-oss-120b";
  const fallback = readEnv("GROQ_FALLBACK_MODEL") ?? "openai/gpt-oss-20b";
  return new GroqGenerator(apiKey, [...new Set([primary, fallback])]);
}
