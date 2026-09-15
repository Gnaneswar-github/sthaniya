# Nativa: Handoff for Claude Code

**Live site:** https://gonativa.vercel.app
**Prepared:** 15 Sept 2026, from a live test of the production site (no access to the code at the time)
**Owner:** Gnaneswar

> **How to use this file.** Put it in the repo as `docs/HANDOFF.md`, then tell Claude Code:
> *"Read docs/HANDOFF.md. Start with Section 0, then work through the tasks in order. For each task, first find the real code, tell me what you found, then make the change with tests."*

---

## 0. Read this first (instructions for Claude Code)

1. **This document was written without seeing the code.** File names in *italics* are known from the founder's own description. Everything else ("probably in…") is a guess. **Before editing, locate the real code and report what you found.** If the code already behaves correctly, say so and skip that task.
2. **Work one task at a time.** Use one branch or commit per task, with a short summary of what changed and how it was tested.
3. **Never break the three product promises** (Section 1). If a fix would break one, stop and ask.
4. **Every fix needs a test.** The test briefs in Section 5 are the regression suite. Tests that depend on "today" must use a **fixed injected clock**, never the real date.
5. **Don't add new AI round-trips to edits.** "Replace / cheaper / more local / slower" must stay instant, deterministic rules.
6. **Don't invent data.** No prices, ratings, history or opening hours that aren't in the source data. When something is unknown, the UI should say "not known" or "check locally".
7. **Ask before:** changing the database schema, adding a paid service, changing environment variables in production, or deleting user content.

---

## 1. What Nativa is (context)

A traveller describes a trip the way they'd tell a friend. Nativa shows what it understood, then builds a day-by-day plan **only from places that exist on the map**, and the traveller can reshape it in one tap.

### The three promises (non-negotiable)

| Promise | Meaning in code |
|---|---|
| **Real places only** | The AI chooses and describes places, but never supplies them. Every stop comes from OpenStreetMap or Wikipedia. Anything the AI returns outside the candidate list is dropped. |
| **Show your working** | Every value read from the sentence is shown next to the words it came from. Guesses are marked as guesses. |
| **A plan you can edit** | Edits are instant deterministic rules over place data, not another AI call. |

### Known pipeline (`/api/generate`, streamed)

| Step | What happens | Known file |
|---|---|---|
| 1. Read the sentence | Rule-based parser extracts dates, days, group, budget, currency, pace, interests, dislikes, and keeps the source phrase for each | *parse-intent.ts* |
| 2. Confirm | "What we understood" screen with source phrases and guesses | *Understanding.tsx* |
| 3. Find candidates | Geocode, then named places from OpenStreetMap (Overpass), or Wikipedia geosearch when OSM is slow | *overpass.ts*, *wikigeo.ts* |
| 4. AI chooses | Groq model picks and orders places from the list and writes atmosphere and fit | *ai/groq.ts* |
| 5. Validate and show | Drops any place not in the candidate list, then attaches photos (Wikimedia Commons), weather (Open-Meteo) and map links | *generate/route.ts* |
| Edits | Replace, cheaper, more local, slower | *trip-engine.ts* |

**Stack seen from outside:** Next.js on Vercel, TypeScript, Groq, Overpass API, Wikipedia geosearch, Wikimedia Commons, Open-Meteo, PWA.

---

## 2. The test that produced these findings

**Input typed on the home page:**

```
A long weekend in Kumbakonam next month with my parents who can't walk much. We love temples and filter coffee, want to avoid crowds, around 15000 rupees total.
```

**Test date:** Tuesday 15 Sept 2026. The settings from "What we understood" were left unchanged. Then "Build my trip", "Slow it down" and "Make it more local" were pressed in that order.

### What "What we understood" showed

| Field | Shown | Expected | Status |
|---|---|---|---|
| Destination | Kumbakonam (from "in Kumbakonam") | Kumbakonam | ✅ |
| Dates | 3 days (from "long weekend"), **no dates** | 3 days **in October 2026** (from "next month") | ❌ month ignored |
| Who's going | Family (from "my parents") | Family, **3 adults** | ⚠️ headcount not shown |
| Interests | Cafés, Spiritual (label says only "from 'coffee'") | Cafés, Spiritual, with **both** source phrases ("filter coffee", "temples") | ⚠️ |
| How local | Local (guessed) | Local (guessed) | ✅ |
| Pace | **Balanced** (guessed) | **Relaxed**, from "can't walk much" | ❌ |
| Budget | **₹15,000 / day** (from "around 15000 rupees total") | **₹15,000 total ≈ ₹5,000 / day** | ❌ |
| Avoid | crowds, with an honest note | same | ✅ (keep this, it's good) |
| Mobility | not captured | **limited walking** (from "can't walk much") | ❌ |

### What the plan showed

- Dated **Wed 16 – Fri 18 Sept** (tomorrow), with weather for those dates. The traveller asked for next month.
- **14 stops over 3 days**, "Getting around: 5 hr 30 min". Too much for parents who can't walk much.
- The "Route in Google Maps" link used **`travelmode=walking`**.
- The Booking.com link used **`group_adults=2`**, but the group is 3 adults.
- Local scores were **identical per label**: every Hidden Gem 92, every Local Favourite 74, every Tourist Essential 38.
- Descriptions contained **unsupported claims**, for example:
  - "Thiru Meenakshi Sundareshwarar Temple … **marble-lined sanctum** … spacious courtyards"
  - "Sarangapani Temple … **simple stone carvings**" (it is one of the town's major temples)
  - "St. Mary Cathedral … **colonial-style church**", shown with category **"Temple"** and "Tickets & tours"
  - "Sri Karumbairam Vinayagar Temple … **ample space for seniors**"
  - "… is small and **seldom visited**" / "**often quiet**"
  - After "more local": "Nandavanam … lush, quiet garden walk … **with benches**"
- Restaurants had the fit line **"Picked for the spiritual you asked for."**
- Opening hours were shown as raw OSM syntax: **`Mo-Su,PH 09:00-22:00; off`**
- Temples were scheduled at **1:45 PM, 3:00 PM and 3:30 PM**. Many Tamil Nadu temples close from about 12:00–12:30 until about 16:00 (needs checking, see Task P0-5).
- **Only one coffee stop** in 3 days, despite "filter coffee".
- The summary line "**14 stops fit this trip beautifully** …" was still shown after "Slow it down" reduced the plan to 11 stops.
- **"Slow it down"** removed 3 Hidden Gems, and the local score dropped from 73 to 67.
- **"Make it more local"** swapped 4 stops and **removed Sarangapani Temple**. Result: 7 of 11 stops were small neighbourhood shrines.
- Places a local would expect to be at least *considered* for this brief never appeared: **Adi Kumbeswarar Temple**, **Mahamaham Tank** and, just outside town, **Airavatesvara Temple (Darasuram)**. *Verify these exist in OSM near the geocode and check the search radius.*
- The "Stays" and "Tickets & tours" links have `rel="sponsored"` but **no partner or affiliate ID** in the URL.

### Other pages

- `/forum`: empty ("Start the first conversation").
- `/stories`: empty ("The first stories are on their way").
- `/destinations`: 12 guides (Tokyo, Kyoto, Istanbul, Lisbon, Mexico City, Marrakesh, Hanoi, Varanasi, George Town, Tbilisi, Oaxaca City, Pune). **No Kumbakonam**, even though it's the pitch city.

---

## 3. Task list (in priority order)

Priority key:
- **P0:** a real traveller gets a wrong or unsafe plan.
- **P1:** damages trust or the "local" promise.
- **P2:** business and growth.
- **P3:** later.

Each task has: **Problem → Where to look → Required behaviour → Acceptance criteria → Tests.**

---

### P0-1. Stop invented descriptions ("Real places only" must cover the words too)

**Problem.** The place is real, but the atmosphere and description text is invented by the model (marble, benches, "seldom visited", "space for seniors", "colonial-style"). This is exactly the failure Nativa promises to avoid. A church is also labelled "Temple".

**Where to look.** *ai/groq.ts* (prompt and output schema), *generate/route.ts* (validation step), and wherever the category label ("Temple", "Café", "Food") is assigned.

**Required behaviour.**

1. **Build a facts pack for each candidate** before calling the AI. It holds only verifiable fields:
   - `name`, `category` (derived from OSM tags), `religion`, `denomination`, `cuisine`, `amenity`/`tourism`/`historic`/`leisure`, `opening_hours` (raw and humanised), `wheelchair`, `fee`, `heritage`, `website`
   - the Wikipedia/Wikidata ID if present
   - the Wikipedia summary if present (first ~300 characters)
   - distance from the day's anchor point
2. **Split the text into two fields:**
   - `what_it_is`: generated **deterministically in code** from the facts pack (e.g. "Hindu temple", "Café · opens 09:00–22:00", "Catholic church · Wikipedia: …"). No AI.
   - `why_it_fits`: written by the AI. It may reference **only** the traveller's brief and fields in the facts pack. Max ~20 words.
3. **Remove the free "atmosphere" line**, or keep it only when a Wikipedia summary exists and the line is drawn from that summary.
4. **Add a post-check.** Reject or regenerate `why_it_fits` if it mentions physical features, crowd levels, accessibility, materials, age or history that aren't in the facts pack. A simple first version is a banned-claims list checked against the facts pack, for example: `marble|granite|benches|seldom|often quiet|crowd|spacious|courtyard|colonial|ancient|century|wheelchair|accessible|seniors|shaded`. If a banned word appears and has no supporting tag, drop the sentence.
5. **Fix category mapping:**
   - `amenity=place_of_worship` + `religion=christian` → "Church"
   - `religion=muslim` → "Mosque"
   - `religion=hindu` → "Temple", and so on
   - Never default all places of worship to "Temple".
6. **Show "Tickets & tours" only** when `tourism=attraction`/`museum`, or `fee=yes`, or a Wikidata ID with notable sitelinks exists. Never show it on small free shrines.

**Acceptance criteria.**

- For the Kumbakonam brief, no stop text contains any claim that isn't traceable to a tag or a Wikipedia summary.
- St. Mary Cathedral is labelled "Church".
- A unit test feeds a fake AI response containing "marble-lined sanctum" for a place with no such tag, and the sentence is removed.

**Tests.** Add `grounding.test.ts` with 5 fake AI outputs (clean, invented material, invented crowd claim, invented accessibility, wrong religion), each with the expected result.

---

### P0-2. Understand relative dates ("next month", "this weekend", "tomorrow")

**Problem.** "Next month" was ignored and the plan defaulted to tomorrow, so the weather was for the wrong dates.

**Where to look.** *parse-intent.ts* (date extraction) and the code that sets default dates when none are found.

**Required behaviour.**

1. Parse at least these phrases, using the **traveller's timezone** from the browser (not the server's):
   - `tomorrow`, `today`, `tonight`
   - `this weekend`, `next weekend`
   - `next week`, `next month`
   - `in <Month>`, `early/mid/late <Month>`
   - `<day> <Month>` and `<Month> <day>`
   - date ranges (`12–15 Oct`)
   - `for Christmas/New Year`
   - Optional: `Diwali`, `Pongal`, `Dev Deepavali`, from a small hard-coded table **for the next two years only, marked as guessed**
2. If only a month is known, choose a sensible start date and **mark it as guessed**. For a "long weekend", pick the first Friday–Sunday of that month. The UI must say "we picked these dates, change them".
3. **Never silently default to tomorrow** when the sentence contains any time phrase. If no time phrase exists, leave dates empty and ask in "What we understood" (a pre-filled guess is fine if it's marked as guessed).
4. **Weather:**
   - If the trip starts beyond the forecast range (check Open-Meteo's current forecast horizon; it's believed to be about 16 days), show **"typical for this month (last year)"** from the climate/history data used by the city guides.
   - Label it clearly and don't show a daily forecast.
   - Season must follow hemisphere (this already exists; keep it).

**Acceptance criteria.**

- With a fixed clock of 15 Sept 2026, "long weekend … next month" gives Fri 2 – Sun 4 Oct 2026, marked as guessed, with the source phrase "next month".
- The plan does not show a 16–18 Sept forecast.

**Tests.** Add `parse-dates.test.ts` covering every phrase above, using an injected clock.

---

### P0-3. Budget: "total" vs "per day" vs "per person"

**Problem.** "Around 15000 rupees total" was read as ₹15,000 **per day**, three times the real budget.

**Where to look.** *parse-intent.ts* (budget and currency extraction), and wherever the budget is converted to a per-day value.

**Required behaviour.**

1. Detect the budget basis:
   - **total:** `total`, `in total`, `overall`, `all in`, `for the whole trip`, `for the trip`
   - **per day:** `per day`, `a day`, `daily`, `/day`
   - **per person:** `per person`, `each`, `pp`, `per head`
   - These combine (per person + total).
2. Store `{ amount, currency, basis: 'total' | 'per_day', perPerson: boolean, source }`. Derive `perDayPerPerson` in one place.
3. **UI:** "Read as ₹15,000 total for 3 days ≈ ₹5,000 / day for the group", with the source phrase shown.
4. If there's no basis word, **guess "total" when the amount is large relative to typical daily spend, otherwise "per day"**, and mark it as guessed. A simpler rule is fine too: default to total for trips of 2+ days, marked as guessed.
5. Keep the existing "assuming INR" note.

**Acceptance criteria.** The Kumbakonam brief shows ₹15,000 total ≈ ₹5,000/day. "€80 a day" shows €80/day. "₹15,000 per person for 3 days" shows per person, total.

**Tests.** Add `parse-budget.test.ts`.

---

### P0-4. Mobility and group size ("parents who can't walk much")

**Problem.** Limited walking was ignored:
- pace stayed "Balanced"
- 5 stops a day
- 5h30 of getting around
- walking directions
- the Booking link searched for 2 adults instead of 3

**Where to look.** *parse-intent.ts*, *Understanding.tsx*, *trip-engine.ts* (pace rules), the Google Maps link builder, and the Booking link builder.

**Required behaviour.**

1. **New intent field** `mobility: 'none' | 'limited' | 'wheelchair' | 'pram'`, with its source phrase. Trigger phrases:
   - **limited:** `can't walk much`, `cannot walk far`, `bad knees`, `elderly`, `senior`, `older parents`, `grandparents`, `limited mobility`
   - **wheelchair:** `wheelchair`
   - **pram:** `pram`, `stroller`, `toddler`, `baby`
2. **Show it** in "What we understood" as its own row ("Getting around: limited walking, read from 'can't walk much'"), editable.
3. **When mobility ≠ none:**
   - Default pace → **Relaxed** (still marked as guessed)
   - Cap stops per day at **3**
   - Cap walking between consecutive stops at **~1 km**; beyond that, suggest auto/taxi
   - Google Maps links use `travelmode=driving`
   - Prefer places with `wheelchair=yes|limited`, and never claim accessibility without that tag
   - Add a visible note: "We kept days short and walking low. Check steps and access at each place."
4. **Headcount.** Add `adults`/`children` to the intent:
   - `my parents` = 2 + the traveller = **3 adults**
   - `my wife`/`my husband`/`my partner` = 2
   - `with friends, 5 of us` = 5
   - Mark as guessed when inferred. Use it in the Booking link (`group_adults`, `group_children`).

**Acceptance criteria.** The Kumbakonam brief gives mobility=limited, pace Relaxed (guessed), 3 adults, ≤3 stops/day, driving links, and a Booking link with `group_adults=3`.

**Tests.** Add `parse-mobility.test.ts` and `trip-engine.mobility.test.ts`.

---

### P0-5. Don't schedule visits when places are likely closed

**Problem.** Temples were scheduled for 1:45, 3:00 and 3:30 PM. **Many South Indian Hindu temples close from roughly midday until about 4 PM.** The founder should confirm this for Kumbakonam before it's coded as a rule. Opening hours are also shown as raw OSM code.

**Where to look.** *trip-engine.ts* (time windows) and the stop card component.

**Required behaviour.**

1. **Parse `opening_hours`** with a proper library (e.g., currently the `opening_hours` npm package; confirm it's maintained). Use it to:
   - avoid scheduling a stop outside its open hours
   - show human text ("Open daily 9 AM – 10 PM")
2. **When `opening_hours` is missing**, apply a **regional default rule, marked "usually"**:
   - Hindu temples in Tamil Nadu, Kerala, Karnataka, Andhra Pradesh and Telangana: open ~06:00–12:00 and ~16:00–21:00
   - Put these values in one config file so the founder can adjust them
   - Card text: "Usually closed around midday. Check locally."
3. **Scheduler:** fill mornings and late afternoons with temples; put meals, cafés and rest in the midday gap.
4. **Never show raw OSM syntax** to users. Keep the "· OpenStreetMap" source credit.

**Acceptance criteria.** No Hindu temple in a Tamil Nadu plan is scheduled between 12:30 and 16:00 unless its own `opening_hours` says it's open then. No raw `Mo-Su,PH …` text is visible anywhere.

**Tests.** Add `schedule.hours.test.ts`.

---

### P1-6. Make "local" mean something (ranking and the "More local" button)

**Problem.**
- The local score looks fixed by label (92 / 74 / 38), so it isn't based on evidence.
- "Make it more local" removed Sarangapani Temple, one of the town's most important temples, and filled the plan with small shrines (7 of 11 stops).
- Major places a local would name never appeared.
- Only one coffee stop despite "filter coffee".
- In practice "more local" currently means "less documented", which isn't the same as "where locals go".

**Where to look.** *trip-engine.ts* (the more-local rule, scoring, labels), *overpass.ts* (query radius and tag filters), *wikigeo.ts*.

**Required behaviour.**

1. **Report first.** Before changing anything, write a short note on how the local score, the labels (Tourist Essential / Local Favourite / Hidden Gem) and the more-local swap are computed today.
2. **Replace constant scores with a transparent formula.** Suggested signals (tune later):
   - `fame`: has Wikipedia/Wikidata, sitelink count, `tourism=attraction`, `heritage=*`
   - `everyday_use`: amenity types locals use daily (café, restaurant, market, temple of daily worship)
   - `local_endorsement`: from the new endorsements data (P2-11), **the strongest signal when present**
   - `fit`: matches interests and pace
   - `practical`: open at the planned time, distance
   - Show the score as a small breakdown on tap ("Why 74?").
3. **Anchors.** At **Tourist** and **Local**, keep the top 1–2 "Don't miss" places per city (highest fame × fit). "More local" must **never remove** an anchor or a locally endorsed place. At **Insider**, anchors may go, but show them in a "You're skipping" list.
4. **Variety cap.** At most 2 stops of the same sub-type per day (e.g., small shrines), unless the traveller asked for only that.
5. **Interest coverage.** Every stated interest appears at least once per day when candidates exist. Filter coffee → at least one café per day.
6. **Search radius.** Check that the Overpass query reaches major sites within ~5 km of the city centre (Darasuram is ~4 km from Kumbakonam). Log candidate counts per category.
7. **Hidden Gem label.** Only apply it when the place has local evidence, not merely because it lacks a Wikipedia page. Without evidence, label it "Small local place".

**Acceptance criteria.** For the Kumbakonam brief at "Local":
- Sarangapani survives "More local"
- no more than 2 small shrines per day
- at least one coffee stop per day
- Adi Kumbeswarar and Mahamaham Tank are considered (in the candidate list) if they exist in OSM
- scores differ between places with the same label

**Tests.** Add `trip-engine.local.test.ts` with fixture candidates.

---

### P1-7. Text and UI bugs

| # | Bug | Fix |
|---|---|---|
| a | "14 stops fit this trip beautifully …" stays after edits | Recompute the summary after every edit and remove "beautifully". Template: "11 stops over 3 days, about 4 h of getting around." |
| b | Restaurants: "Why it fits: Picked for the spiritual you asked for." | The fallback fit line must use the stop's own category/interest ("Picked for the food you asked for"). If the stop matches no stated interest, say "Nearby lunch stop between temples." |
| c | Raw OSM opening hours shown | See P0-5 |
| d | "Tickets & tours" on small free temples | See P0-1 item 6 |
| e | Interest row shows only one source phrase ("coffee") | Show every source phrase that triggered each chip ("temples" → Spiritual, "filter coffee" → Cafés) |
| f | "Slow it down" drops Hidden Gems first, so the local score falls | Remove the lowest-fit, non-anchor stops first, keeping local balance roughly stable |

---

### P1-8. Hide empty community sections

**Problem.** `/forum` and `/stories` are empty and make the site look inactive.

**Required behaviour.**
- Add feature flags (`NEXT_PUBLIC_SHOW_FORUM`, `NEXT_PUBLIC_SHOW_STORIES`, or a server setting).
- Hide nav links and home-page teasers when off.
- Keep the routes working for the admin.
- Turn them back on when there are at least ~10 approved posts or stories (configurable).
- **Don't delete** any code or data.

---

### P2-9. Make booking links honest and useful

**Problem.** Links are marked `rel="sponsored"` but carry no partner ID, so they earn nothing and the label is misleading.

**Required behaviour.**

1. Add env vars (e.g. `BOOKING_AFFILIATE_ID`, `GYG_PARTNER_ID`). **The founder must join those programmes himself.** Claude Code must not sign up for anything.
2. When an ID is present, append it to the link and keep `rel="sponsored"`. When absent, use `rel="noopener noreferrer"` only.
3. Add a one-line disclosure near the links: "Nativa may earn a small fee from these links. It never changes which places we suggest."
4. **Guard the promise with a test.** Ranking and selection functions must not import or read anything affiliate-related. Add a lint rule or unit test that fails if they do.
5. Use the correct headcount and dates from P0-2 and P0-4 in the links.

---

### P2-10. Measure what users do

**Required behaviour.**
- Add privacy-friendly event tracking (e.g., currently Vercel Web Analytics custom events or PostHog; the founder chooses).
- **Events:** `brief_submitted`, `understanding_edited` (with the field name), `trip_built` (stops, days, dial), `edit_used` (replace / more-like-this / not-for-me / cheaper / more-local / slower), `trip_shared`, `trip_saved`, `calendar_exported`, `booking_link_clicked` (with partner name), `feedback_sent`.
- **No personal data and no brief text in events.** Never put user data in URLs.
- Add a simple `/admin/metrics` page (admin only) with weekly counts.

---

### P2-11. Kumbakonam as the flagship city and a local endorsements store

**Required behaviour.**

1. **Data model** `place_endorsement`:
   - `osm_type`, `osm_id`, `city`, `endorser_type` (resident | visitor | founder), `reason_tag` (daily_worship | best_coffee | family_friendly | skip_if_short | …), `note`, `created_at`, `approved`
   - **Ask before creating the migration.**
2. **Seed file** `data/endorsements/kumbakonam.json` for the founder to fill in by hand.
3. A simple **admin form** to add endorsements, and a **public form** ("Would you take a friend here?"). Public entries stay unapproved until an admin approves them, like the rest of the community content.
4. Feed endorsements into P1-6 scoring.
5. **Add a Kumbakonam city guide** in the same format as the 12 existing ones.

---

### P2-12. Make the brief reader smarter without losing "show your working" (later)

**Idea.**
- Keep the rule-based parser as the fast, free first pass.
- Add an optional AI extraction pass that returns the same schema, where **every value must include a `source` string that appears word-for-word in the original sentence**. Values whose source isn't found in the sentence are dropped or marked as guessed.
- Do this only after P0-2, P0-3 and P0-4 pass with rules.

**Why.** It catches phrasing the rules will miss ("long weekend with my in-laws", mixed-language briefs) and keeps the same honesty as the "real places only" check.

---

### P3-13. AI pre-screen for the moderation queues (later)

- Before a human reviews a feedback item, story or forum post, run a cheap check: spam, personal details (phone, email, address), off-topic, abusive.
- Show the flags in the admin queue.
- **A human still approves or declines everything.** Nothing is auto-published.

---

## 4. Suggested order of work

1. **P0-2 dates**, **P0-3 budget**, **P0-4 mobility and headcount** (all in the parser; quick wins with clear tests)
2. **P0-1 grounded descriptions** and category fix
3. **P0-5 opening hours and the midday rule**
4. **P1-7 text bugs** and **P1-8 hide empty sections**
5. **P1-6 local ranking** (report first, then change)
6. **P2-10 analytics**
7. **P2-9 booking links**
8. **P2-11 Kumbakonam endorsements and guide**
9. **P2-12**, **P3-13**

After each step, run the full regression suite (Section 5) and re-run the Kumbakonam test by hand on a preview deployment.

---

## 5. Regression suite: test briefs and expected readings

Use a **fixed clock of Tuesday 15 Sept 2026, timezone Asia/Kolkata**, unless stated otherwise. "(g)" means the value must be marked as guessed.

| # | Brief | Expected reading |
|---|---|---|
| 1 | A long weekend in Kumbakonam next month with my parents who can't walk much. We love temples and filter coffee, want to avoid crowds, around 15000 rupees total. | Kumbakonam · Fri 2 – Sun 4 Oct 2026 (g) · 3 days · Family, 3 adults (g) · Spiritual + Cafés · pace Relaxed (g) · mobility limited · ₹15,000 total ≈ ₹5,000/day · avoid crowds |
| 2 | 3 days in Kyoto in November with my wife, love gardens, hate queues | Kyoto · November (g start date) · 3 days · Couple, 2 adults · Nature · avoid queues/crowds · season autumn |
| 3 | A week in Lisbon solo, €80 a day | Lisbon · 7 days · Solo, 1 adult · €80 per day · dates empty or guessed (g) |
| 4 | Weekend in Pune with two kids under 5, we'll have a stroller | Pune · this coming weekend Sat 19 – Sun 20 Sept (g) · 2 days · Family, 2 adults (g) + 2 children · mobility pram |
| 5 | Hanoi next week, 5 days, $500 all in, street food | Hanoi · starts Mon 21 Sept (g) · 5 days · USD 500 total ≈ $100/day · Food |
| 6 | December in Buenos Aires, 4 days | Buenos Aires · December (g) · 4 days · season **summer** (southern hemisphere) |
| 7 | Mexico City for 2 days, my dad uses a wheelchair | Mexico City · 2 days · Family, 2 adults (g) · mobility wheelchair · driving links |
| 8 | Tokyo for 10 days, ¥20,000 per day, anime and food | Tokyo · 10 days · JPY 20,000 per day · Food (+ anime kept as a note if there's no chip) |
| 9 | Long weekend in Marrakesh with friends, 5 of us, 2000 dirhams each | Marrakesh · 3 days · Friends, 5 adults · MAD 2,000 per person, basis total (g) |
| 10 | Istanbul in 3 days, avoid touristy stuff, love bookshops | Istanbul · 3 days · dial Insider (g) · avoid touristy · bookshops kept as a note or mapped to an interest |
| 11 | Kyoto tomorrow, just one day | Kyoto · Wed 16 Sept 2026 · 1 day · forecast weather allowed |
| 12 | Tbilisi this weekend | Tbilisi · Sat 19 – Sun 20 Sept 2026 (g) · 2 days |
| 13 | Oaxaca, 6 days in early March, slow pace, mezcal | Oaxaca City · early March 2027 (g) · 6 days · pace Relaxed (read, not guessed) · climate data instead of forecast |
| 14 | Penang for 4 days with my elderly mother, halal food please | George Town · 4 days · Family, 2 adults (g) · mobility limited · halal kept as a note (or a dietary filter if one exists) |
| 15 | Chennai to Kumbakonam to Thanjavur over 5 days | Multi-city: Chennai → Kumbakonam → Thanjavur · 5 days · days split across cities |
| 16 | ₹15,000 per person for 3 days in Goa | Goa · 3 days · ₹15,000 per person, total |
| 17 | Two weeks in Japan | Japan (country) · 14 days · ask the traveller to pick cities, or guess a route (g) |
| 18 | Paris | Paris · everything else empty or guessed, no crash |
| 19 | Madurai 2 days, temples mattum | Madurai · 2 days · Spiritual · no crash on mixed language |
| 20 | 3 days in Kumbakonam, packed schedule, we walk a lot, ₹3000 a day | Kumbakonam · 3 days · pace Packed · mobility none · ₹3,000/day |

**Plan-level checks for brief 1** (after P0 and P1 fixes):
- ≤3 stops per day
- driving links
- no temple scheduled between 12:30 and 16:00 without its own open hours
- ≥1 café per day
- Sarangapani still present after "More local"
- no invented physical or crowd claims
- St. Mary Cathedral (if chosen) labelled Church, without "Tickets & tours"
- summary text matches the stop count after every edit
- Booking link `group_adults=3` with October dates

---

## 6. Things not to do

- Don't let the AI add places, prices, ratings, opening hours, history or accessibility claims.
- Don't make edits call the AI.
- Don't let affiliate or partner data touch ranking or selection.
- Don't auto-publish community content.
- Don't put brief text or personal details in URLs, analytics or logs.
- Don't delete the forum or stories code. Hide it behind flags.
- Don't hard-code "tomorrow" as a default date.
- Don't show raw OSM tag syntax to travellers.
- Don't remove the OSM, Wikimedia and Open-Meteo credits. Each photo must keep its author and licence line.

---

## 7. Questions for the founder (answer before or during the work)

1. Temple hours: confirm the midday closing window for Kumbakonam temples (P0-5).
2. Should "long weekend" mean Fri–Sun or Sat–Mon?
3. Budget with no basis word: default to "total" or "per day"?
4. Which analytics tool (Vercel Analytics, PostHog, other)?
5. Have you joined the Booking.com and GetYourGuide partner programmes? What are the IDs?
6. Who can approve endorsements, only you or trusted locals too?
7. What forum and stories thresholds should switch those sections back on?
8. Is the Overpass API the public instance? If traffic grows, check its usage policy or move to a self-hosted or paid instance.

---

## 8. Ready-to-paste prompts for Claude Code

**Kick-off**
```
Read docs/HANDOFF.md fully. Then, without changing any code, give me a short map of the repo: where intent parsing, the Understanding screen, candidate fetching, the Groq call, validation, trip-engine edits, link builders and the stop card live. For each task P0-1 to P1-8, tell me which files it touches and whether the problem still exists.
```

**For each task**
```
Do task <ID> from docs/HANDOFF.md. First show me the current code path and your plan in 5 bullet points. Then implement it, add the tests listed, run the whole test suite, and summarise what changed. Do not touch anything outside this task.
```

**After each P0 task**
```
Run the regression briefs in Section 5 of docs/HANDOFF.md through the parser with the fixed clock and print a table of actual vs expected. List any mismatches.
```

**Local check before deploying**
```
Start the app locally, build the trip for brief 1 in Section 5, press "Slow it down" and then "Make it more local", and check every plan-level item listed under Section 5. Report pass/fail for each.
```

---

## 9. Status: P0-1 to P1-8 implemented (15 Sept 2026)

All eight P0/P1 tasks are in the code, with tests. No database schema, paid service or production environment variable was changed. P2 and P3 tasks are not started.

### Defaults chosen where Section 7 asked the founder

| Question | Default used | Where to change it |
|---|---|---|
| 1. Temple hours | Hindu temples in Tamil Nadu, Kerala, Karnataka, Andhra Pradesh, Telangana with no `opening_hours`: usually 06:00–12:00 and 16:00–21:00, shown as "usually … check locally" | `src/lib/hours-defaults.ts` |
| 2. Long weekend | Friday–Sunday | `src/lib/intent/dates.ts` |
| 3. Budget with no basis word | Total for trips of 2+ days, per day for 1 day, always marked as guessed | `src/lib/intent/budget.ts` |
| 7. Community thresholds | Forum and stories hidden until 10 approved posts; force with `NEXT_PUBLIC_SHOW_FORUM` / `NEXT_PUBLIC_SHOW_STORIES` = 1/0, change with `COMMUNITY_MIN_POSTS` | `src/lib/community.ts` |
| No time phrase at all | Dates pre-filled a week from today, marked "we picked these dates" (never tomorrow) | `src/lib/intent/prefs.ts` |

Questions 4, 5, 6 and 8 (analytics tool, partner IDs, endorsement approvers, Overpass instance) belong to P2 work and are still open.

### What changed, by task

| Task | Change | Main files | Tests |
|---|---|---|---|
| P0-1 Grounded descriptions | Candidates carry a facts pack (religion, denomination, cuisine, wheelchair, fee, heritage, hours, Wikipedia/Wikidata, distance). Category, label and the "what it is" line are built in code from facts. The model returns only its choice, window, interests and a ≤20-word fit line; every sentence with an unsupported claim (materials, size, crowds, quiet, accessibility, history, fame, prices, hours, views) is dropped. Churches → Church, mosques → Mosque, never "Temple" by default. "Tickets & tours" only for attractions, museums, `fee=yes` or heritage + Wikidata. | `lib/grounding.ts`, `lib/ai/place.ts`, `lib/ai/groq.ts`, `lib/places/overpass.ts`, `lib/types.ts` | `grounding.test.ts` |
| P0-2 Relative dates | today/tonight/tomorrow, this/next weekend, next week/month, in/early/mid/late Month, day+month, ranges, Christmas/New Year, in the traveller's timezone with an injected clock. Guessed dates are marked. Weather beyond the forecast window already falls back to last year's same dates, labelled "typical". | `lib/intent/dates.ts`, `lib/intent/prefs.ts`, `components/Understanding.tsx` | `parse-dates.test.ts` |
| P0-3 Budget basis | `{ amount, currency, basis, perPerson }` kept on the trip; the per-day group figure is derived in one function. "Read as ₹15,000 total for 3 days ≈ ₹5,000 / day for the group", with basis and per-person editable. | `lib/intent/budget.ts`, `components/Understanding.tsx` | `parse-budget.test.ts` |
| P0-4 Mobility and headcount | `mobility` (limited / wheelchair / pram) and adults/children read from the sentence, shown and editable. With any mobility: pace defaults to Relaxed (guessed), ≤3 stops a day, driving directions, a taxi hint for hops over 1 km, step-free places ranked up, and a visible note. Booking links carry `group_adults` / `group_children`. | `lib/intent/party.ts`, `lib/trip-engine.ts`, `lib/export.ts`, `lib/affiliates.ts`, `components/TripView.tsx` | `parse-mobility.test.ts`, `trip-engine.mobility.test.ts` |
| P0-5 Opening hours | A small `opening_hours` reader (no new dependency). The scheduler waits for a place to open, orders temples into mornings and late afternoons with meals in the gap, and flags a stop with no open slot. Cards show "Open daily 9 AM – 10 PM", never raw syntax. | `lib/opening-hours.ts`, `lib/hours-defaults.ts`, `lib/trip-engine.ts`, `components/ItemCard.tsx` | `schedule.hours.test.ts` |
| P1-6 Local ranking | See the report below. Scores now come from a formula over map facts with a tap-to-see breakdown; 1–2 anchors per city are always kept at Tourist/Local and never removed by "More local" or "Slow it down" (listed as "You're skipping" at Insider); max 2 of the same sub-type a day; every stated interest covered each day where candidates exist; no "Hidden Gem" without local evidence ("Small local place" instead). Overpass now also fetches ways (large temples are mapped as areas), searches 5 km before 12 km, and logs candidate counts by category. | `lib/trip-engine.ts`, `lib/grounding.ts`, `lib/places/overpass.ts`, `app/api/generate/route.ts` | `trip-engine.local.test.ts` |
| P1-7 Text and UI bugs | (a) summary recomputed after every edit, "beautifully" gone; (b) fit lines only name interests the place can serve, with "A nearby food stop…" otherwise; (c) hours humanised; (d) tickets gated; (e) every source phrase shown per interest chip; (f) "Slow it down" removes the lowest-fit non-anchor stop and keeps local balance. | `lib/trip-engine.ts`, `components/PlanFlow.tsx`, `components/TripView.tsx`, `components/ItemCard.tsx` | covered above |
| P1-8 Hide empty community | Nav, footer, guide stories section, stories→forum link and sitemap entries appear only when the threshold is met or the flag forces them. Routes and admin pages still work; no code or data removed. | `lib/community.ts`, `components/Shell.tsx`, `app/sitemap.ts`, guide and stories pages | — |

The Section 5 regression suite is `src/lib/regression-briefs.test.ts`: all 20 briefs, 113 field checks, all passing with the fixed clock.

### P1-6 report: how "local" worked before this change

- **Local score:** a constant per label: Hidden Gem 92, Local Favourite 74, Tourist Essential 38. No evidence was involved.
- **Labels:** chosen by the model per place ("tourist_essential", "local_favourite", "hidden_gem"), so a place without a Wikipedia page easily became a Hidden Gem.
- **"Make it more local":** replaced every stop scoring below 74 (all Tourist Essentials) with any unused place scoring higher, ranked by interest fit. Nothing protected major places, so Sarangapani could be swapped out, and nothing limited how many small shrines ended up in a day.
- **"Slow it down":** removed the lowest-scoring stop per day, where the score included the dial affinity. At "Local", Hidden Gems scored lower than Local Favourites, so they went first and the trip's local score fell.

### Follow-ups found during the local check

- **Landmarks the model skips.** The server now adds the top one or two landmarks from the candidate list (fame × fit, with Wikipedia article length as a sourced signal) when the model passes over them, so anchors exist for "More local" to keep. `lib/landmarks.ts`, `app/api/generate/route.ts`.
- **Mis-tagged places.** St. Mary Cathedral is tagged `religion=hindu` on OpenStreetMap; a name that clearly says church or mosque now wins over a contradicting tag, and the temple hours rule no longer applies to it.
- **Wikipedia event articles** ("Mahamaham stampede") are no longer offered as stops.
- **Thin map data is said out loud.** When an interest has no places, or fewer than the trip has days, the trip says so instead of silently leaving it out.
- **Map outages.** The public Overpass instance timed out repeatedly during testing. Wikipedia landmarks are now always merged in (not only as a fallback), the everyday-places query is kept unchanged so a week's cache keeps serving it, and a timed-out answer (which returns HTTP 200 and would otherwise be cached) is retried once under a different URL. HANDOFF question 8 stands: a paid or self-hosted Overpass instance would remove this dependency.

### Local check of brief 1 (production build, 15 Sept 2026)

The "What we understood" screen read: Kumbakonam · Fri 2 – Sun 4 Oct (marked as our pick, from "next month · long weekend") · 3 adults (counted from "my parents") · limited walking · Spiritual from "temples", Cafés from "filter coffee" · pace Relaxed (picked from "can't walk much") · "₹15,000 total for 3 days ≈ ₹5,000 / day for the group".

During this run the public Overpass instance was not answering from the test machine (rate-limited after repeated probes), so candidates came from Wikipedia only (30 temples, 30 other places).

| Check | Built | After "Slow it down" | After "Make it more local" |
|---|---|---|---|
| ≤3 stops per day | PASS (2/3/2) | PASS (2/2/2) | PASS (2/2/2) |
| Driving links | PASS | PASS | PASS |
| No temple 12:30–16:00 without own hours | PASS | PASS | PASS |
| ≥1 café per day | FAIL: no cafés in the Wikipedia-only candidates; the trip says "We couldn't find any places for cafés…" | FAIL (same) | FAIL (same) |
| Sarangapani still present | FAIL: its Wikipedia article has no coordinates, so it can only come from OpenStreetMap, which was unavailable. Adi Kumbeswarar and Nageswaraswamy were kept as landmarks through both edits. | FAIL (same) | FAIL (same) |
| No invented physical or crowd claims | PASS | PASS | PASS |
| St. Mary Cathedral labelled Church, no Tickets | PASS (not chosen; unit-tested with its real tags) | PASS | PASS |
| Summary matches stop count | PASS (7) | PASS (6) | PASS (6) |
| Booking `group_adults=3`, October dates | PASS (2–5 Oct) | PASS | PASS |
| No raw OSM hours visible | PASS | PASS | PASS |

With OpenStreetMap available, Kumbakonam's 4 km node query returns Sarangapani Temple, St. Mary Cathedral, 14 places of worship, 6 restaurants and only 1 café (Rola Bakery). So a café every day is not possible from map data alone for this town; the trip says so. Endorsements (P2-11) are the way to add the coffee places locals know.

### Not done yet

P2-9 booking link disclosure and ranking isolation test, P2-10 analytics and `/admin/metrics`, P2-11 endorsements store and a Kumbakonam guide (needs a migration, so ask first), P2-12 AI extraction pass, P3-13 moderation pre-screen.
