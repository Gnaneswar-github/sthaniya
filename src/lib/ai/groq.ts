import { groundedPlace, type RawPlace } from "./place";
import { ObjectScanner } from "./scanner";
import type { GenerationInput, GenerationResult, GeneratorEvent, ItineraryGenerator } from "./types";
import { readEnv } from "@/lib/env";
import { categoryFromFacts, whatItIs } from "@/lib/grounding";
import { travellersIn } from "@/lib/intent/party";
import { describeHours, parseOpeningHours } from "@/lib/opening-hours";
import type { Candidate } from "@/lib/places/overpass";
import { tasteSummary } from "@/lib/taste";
import { INTERESTS, type Interest, type Recommendation, type TripPrefs } from "@/lib/types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const INTEREST_IDS = INTERESTS.map((i) => i.id) as Interest[];

const SYSTEM = `You are a local guide writing for Nativa, a travel planner whose entire premise is that it does not invent anything.

Absolute rules:
- You may ONLY use places from the CANDIDATES list, by their ref. Never add a place from your own knowledge, however famous. If no candidate fits, return fewer places.
- For each place, write a "whyItFits" line of at most 20 words saying how it answers what the traveller asked for.
- A whyItFits line may draw on only two sources: the traveller's own words, and the facts printed for that candidate. Nothing else.
- Never describe how a place looks: no materials, carvings, size, courtyards, gardens, seating, shade or views.
- Never say a place is quiet, busy, hidden, crowded, peaceful or rarely visited.
- Never say a place suits seniors, children or wheelchairs unless "wheelchair: yes" is printed for it.
- Never give history, age, prices, ratings or opening hours that are not printed.
- If you are unsure what a place actually is, leave it out.

Voice: plain, warm and specific. Never "nestled", "vibrant" or "must-visit".`;

const PLACE_SHAPE = `{"ref":"<candidate ref, must exist above>","interests":["from ${INTEREST_IDS.join("|")}"],"durationMinutes":<30-240>,"window":{"start":"HH:MM","end":"HH:MM"},"whyItFits":{"<interest id>":"<at most 20 words, from their words and this place's printed facts only>"}}`;

const MOBILITY_LINE: Record<string, string> = {
  none: "no limits",
  limited: "limited walking: keep visits short and places close to the centre and to each other",
  wheelchair: "wheelchair user: prefer places printed with wheelchair: yes, and keep places close together",
  pram: "pushing a pram or stroller: keep places close together",
};

function candidateLine(candidate: Candidate): string {
  const category = categoryFromFacts(candidate.facts, candidate.name);
  const hours = parseOpeningHours(candidate.facts.openingHours);
  const parts = [candidate.ref, candidate.name, whatItIs(category, candidate.facts)];
  if (candidate.facts.distanceKm !== undefined) parts.push(`${candidate.facts.distanceKm} km from centre`);
  if (hours) parts.push(`hours: ${describeHours(hours)}`);
  if (candidate.facts.wheelchair) parts.push(`wheelchair: ${candidate.facts.wheelchair}`);
  return parts.join(" | ");
}

function groupLine(prefs: TripPrefs): string {
  const { adults, children } = travellersIn(prefs);
  const people = `${adults} ${adults === 1 ? "adult" : "adults"}${children > 0 ? `, ${children} ${children === 1 ? "child" : "children"}` : ""}`;
  return `${prefs.travellerType} (${people})`;
}

function userPrompt(input: GenerationInput, format: "object" | "lines"): string {
  const { prefs, candidates, destination, season, countryName, target } = input;
  const taste = tasteSummary(prefs.taste);
  const days = Math.max(1, Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1);

  const output =
    format === "lines"
      ? `Return JSON Lines: one place per line, each exactly this shape, and nothing else — no array, no prose, no code fences. Put the strongest picks first.\n${PLACE_SHAPE}`
      : `Return JSON exactly:\n{"places":[${PLACE_SHAPE}]}`;

  return `TRAVELLER
Destination: ${destination}${countryName ? `, ${countryName}` : ""}
Dates: ${prefs.startDate} to ${prefs.endDate} (${days} ${days === 1 ? "day" : "days"}, ${season})
Group: ${groupLine(prefs)}
Getting around: ${MOBILITY_LINE[prefs.mobility ?? "none"]}
Interests: ${prefs.interests.join(", ")}
Pace: ${prefs.pace}
How local they want to go: ${prefs.dial} (tourist = famous things, local = a mix, insider = almost no famous things)
Budget per day for the group: ${prefs.budgetPerDay > 0 ? `${prefs.budgetPerDay} ${prefs.budgetCurrency}` : "not stated"}
In their own words: ${prefs.notes || "(nothing else given)"}
Learned from their past edits: ${taste || "nothing yet"}

CANDIDATES (the only places you may use; each line is ref | name | what it is | facts)
${candidates.map(candidateLine).join("\n")}

TASK
Choose about ${target} places that suit this traveller, this season and this pace.
Spread them across the day: mornings, meals at sensible hours, evenings.
Cover what they asked for: for every interest listed above, and anything specific they named in their own words, choose at least one place per day of the trip whenever candidates fit it.
Where a candidate prints hours, choose a window when it is open.
Meals are part of a day, not the whole of it: at most two restaurants or cafés per day of the trip.
Do not choose a place that is the destination itself or an administrative area (a city, district, province or region) — only places a person can actually go to.

${output}`;
}

type Selection = {
  byRef: Map<string, Candidate>;
  seen: Set<string>;
  rejected: string[];
  count: number;
};

export class GroqError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(status ? `Groq responded ${status}` : "Groq returned an unreadable response");
  }
}

function selection(input: GenerationInput): Selection {
  return { byRef: new Map(input.candidates.map((c) => [c.ref, c])), seen: new Set(), rejected: [], count: 0 };
}

/**
 * The guardrail. A place is only accepted if its ref matches a candidate we actually retrieved
 * from the map — so an invented restaurant cannot reach the itinerary even if the model writes
 * one. Everything said about it is then grounded in that candidate's facts.
 */
function toPlace(raw: RawPlace, input: GenerationInput, state: Selection): Recommendation | null {
  if (typeof raw.ref !== "string") return null;
  const candidate = state.byRef.get(raw.ref);
  if (!candidate) {
    state.rejected.push(raw.ref);
    return null;
  }
  if (state.seen.has(candidate.ref)) return null;
  state.seen.add(candidate.ref);
  state.count += 1;

  return groundedPlace(raw, candidate, {
    destination: input.destination,
    brief: input.prefs.notes ?? "",
    region: input.region,
    countryCode: input.countryCode,
    priority: state.count,
  });
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

  private request(input: GenerationInput, model: string, stream: boolean) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(input, stream ? "lines" : "object") },
        ],
        ...(stream ? { stream: true } : { response_format: { type: "json_object" } }),
        // gpt-oss reasons before answering and those tokens count against the per-minute limit.
        // "low" measured 23 reasoning tokens against 400 at the default, for the same choices.
        reasoning_effort: "low",
        temperature: 0.4,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(40_000),
    });
  }

  private static failure(response: Response): GroqError {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new GroqError(
      response.status,
      response.status === 429 || response.status >= 500,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
    );
  }

  /**
   * Streams places as the model writes them, so the first stops reach the traveller in seconds
   * instead of after the whole trip. Each passes the same candidate check as the batch path. If
   * streaming yields nothing usable — a busy model, a malformed stream — it falls back to the
   * batch call with its retries and second model, rather than failing.
   */
  async *stream(input: GenerationInput): AsyncGenerator<GeneratorEvent> {
    const model = this.models[0];
    const state = selection(input);
    let yielded = 0;

    try {
      const response = await this.request(input, model, true);
      if (!response.ok || !response.body) throw GroqGenerator.failure(response);

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const scanner = new ObjectScanner();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          let delta = "";
          try {
            delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content ?? "";
          } catch {
            continue;
          }
          if (!delta) continue;

          for (const raw of scanner.push(delta)) {
            const place = toPlace(raw as RawPlace, input, state);
            if (place) {
              yielded += 1;
              yield { type: "place", place };
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof GroqError && !error.retryable && yielded === 0) throw error;
      // Otherwise: keep what streamed, or fall through to the batch path below.
    }

    if (yielded > 0) {
      yield { type: "done", rejected: state.rejected.length, model };
      return;
    }

    const result = await this.generate(input);
    for (const place of result.places) yield { type: "place", place };
    yield { type: "done", rejected: result.rejected.length, model: result.model };
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
    const response = await this.request(input, model, false);
    if (!response.ok) throw GroqGenerator.failure(response);

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new GroqError(0, true);

    let parsed: { places?: RawPlace[] };
    try {
      parsed = JSON.parse(content) as { places?: RawPlace[] };
    } catch {
      throw new GroqError(0, true);
    }

    const state = selection(input);
    const places = (parsed.places ?? [])
      .map((raw) => toPlace(raw, input, state))
      .filter((place): place is Recommendation => place !== null);

    // The model that actually answered, which after a fallback isn't the preferred one.
    return { places, rejected: state.rejected, model };
  }
}

export function createGenerator(): ItineraryGenerator | null {
  const apiKey = readEnv("GROQ_API_KEY");
  if (!apiKey) return null;
  const primary = readEnv("GROQ_MODEL") ?? "openai/gpt-oss-120b";
  const fallback = readEnv("GROQ_FALLBACK_MODEL") ?? "openai/gpt-oss-20b";
  return new GroqGenerator(apiKey, [...new Set([primary, fallback])]);
}
