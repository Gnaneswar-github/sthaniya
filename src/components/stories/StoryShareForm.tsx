"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckIcon, CloseIcon } from "../icons";
import { DictationButton } from "../voice/DictationButton";
import { track } from "@/lib/analytics";
import { compressPhoto } from "@/lib/compress-photo";
import { PLACE_KINDS, STORY_BUCKET, STORY_LIMITS, type PlaceKind, type StoryRealm } from "@/lib/stories";
import { appendSpoken } from "@/lib/voice";

type Photo = { key: string; blob: Blob; preview: string };
type PlaceRow = { key: string; kind: PlaceKind; name: string };
type Phase = "form" | "sending" | "sent" | "error";

const fieldClass =
  "w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand focus:bg-paper-raised";
const labelClass = "text-sm font-semibold text-ink";

let keySeed = 0;
const nextKey = () => `k${++keySeed}`;

function monthLabel(value: string): string | null {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Share a travel memory: where, when, the story, the places worth passing on and a few photos.
 * Every text field can be spoken instead of typed. Nothing becomes public until it's reviewed.
 */
export function StoryShareForm({ initialPlace = "" }: { initialPlace?: string }) {
  const [realm, setRealm] = useState<StoryRealm>("earth");
  const [place, setPlace] = useState(initialPlace);
  const [month, setMonth] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [places, setPlaces] = useState<PlaceRow[]>([{ key: "first", kind: "stay", name: "" }]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [progress, setProgress] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const photosRef = useRef<Photo[]>([]);
  const ids = { place: useId(), month: useId(), title: useId(), body: useId(), name: useId(), email: useId(), photos: useId() };

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const bodyShort = body.trim().length < STORY_LIMITS.bodyMin;
  const ready = place.trim().length >= 2 && title.trim().length >= 3 && !bodyShort && name.trim().length >= 1 && consent;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = STORY_LIMITS.photos - photos.length;
    const chosen = [...files].filter((file) => file.type.startsWith("image/")).slice(0, room);
    if (chosen.length === 0) return;
    setPreparing(true);
    setProblem(null);
    const prepared: Photo[] = [];
    for (const file of chosen) {
      try {
        const blob = await compressPhoto(file);
        prepared.push({ key: nextKey(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        setProblem("One photo couldn't be read. JPEG, PNG and WebP photos work best.");
      }
    }
    setPhotos((current) => [...current, ...prepared].slice(0, STORY_LIMITS.photos));
    setPreparing(false);
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const gone = current.find((photo) => photo.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((photo) => photo.key !== key);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || phase === "sending") return;
    if (trap) {
      setPhase("sent");
      return;
    }
    setPhase("sending");
    setProblem(null);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) throw new Error("Sharing stories isn't switched on for this site yet.");
      const id = crypto.randomUUID();
      const paths: string[] = [];
      for (const [index, photo] of photos.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
        const path = `stories/${id}/${index + 1}.jpg`;
        const { error } = await supabase.storage.from(STORY_BUCKET).upload(path, photo.blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("A photo didn't upload. Check your connection and try again.");
        paths.push(path);
      }
      setProgress("Sending your story…");
      const { error } = await supabase.from("stories").insert({
        id,
        realm,
        place: place.trim().slice(0, STORY_LIMITS.place),
        travelled_on: monthLabel(month),
        title: title.trim().slice(0, STORY_LIMITS.title),
        body: body.trim().slice(0, STORY_LIMITS.body),
        places: places
          .filter((row) => row.name.trim())
          .slice(0, STORY_LIMITS.places)
          .map((row) => ({ kind: row.kind, name: row.name.trim().slice(0, 120) })),
        photos: paths,
        author_name: name.trim().slice(0, STORY_LIMITS.name),
        author_email: email.trim() || null,
        consent: true,
      });
      if (error) throw new Error("We couldn't send your story just now. Please try again in a moment.");
      track("story_shared", { realm, photos: paths.length });
      setPhase("sent");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setPhase("error");
    } finally {
      setProgress("");
    }
  }

  if (phase === "sent") {
    return (
      <div className="grid justify-items-center gap-3 rounded-3xl border border-line bg-paper-raised px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h2 className="font-display text-3xl text-ink">Thank you{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}</h2>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
          Your {place.trim() || "travel"} story is with our team. Once it&rsquo;s approved it will appear on Nativa for other travellers.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/stories" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep">
            Read traveller stories
          </Link>
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
            Plan a trip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border border-line bg-paper-raised p-5 sm:p-7">
      <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-ink-soft">
        Prefer talking? Tap the <span className="font-semibold text-ink">microphone</span> next to any box and say it — we&rsquo;ll write it down.
      </p>

      <fieldset>
        <legend className={`${labelClass} mb-2`}>Where were you?</legend>
        <div className="grid grid-cols-2 rounded-full bg-paper-sunken p-1 text-sm font-semibold">
          {(
            [
              ["earth", "On Earth"],
              ["beyond", "Out of this world"],
            ] as [StoryRealm, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={realm === id}
              onClick={() => setRealm(id)}
              className={`rounded-full py-2.5 transition ${realm === id ? "bg-paper-raised text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {realm === "beyond" && (
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Space flights, stargazing deserts, the aurora — anything that didn&rsquo;t feel like this planet. These go on the &ldquo;Beyond&rdquo; shelf.
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.place} className={labelClass}>
              {realm === "earth" ? "Place" : "Where, exactly?"}
            </label>
            <DictationButton onText={(spoken) => setPlace((current) => appendSpoken(current, spoken).slice(0, STORY_LIMITS.place))} />
          </div>
          <input
            id={ids.place}
            required
            minLength={2}
            maxLength={STORY_LIMITS.place}
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder={realm === "earth" ? "Kyoto, Japan" : "Zero-gravity flight over Bordeaux"}
            className={fieldClass}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex h-10 items-center">
            <label htmlFor={ids.month} className={labelClass}>
              When <span className="font-normal text-ink-faint">— month</span>
            </label>
          </div>
          <input id={ids.month} type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.title} className={labelClass}>
            Give it a title
          </label>
          <DictationButton onText={(spoken) => setTitle((current) => appendSpoken(current, spoken).slice(0, STORY_LIMITS.title))} />
        </div>
        <input
          id={ids.title}
          required
          minLength={3}
          maxLength={STORY_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Lanterns, a tiny inn and the best tofu of my life"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.body} className={labelClass}>
            Your story
          </label>
          <DictationButton label="Speak your story" onText={(spoken) => setBody((current) => appendSpoken(current, spoken).slice(0, STORY_LIMITS.body))} />
        </div>
        <textarea
          id={ids.body}
          required
          minLength={STORY_LIMITS.bodyMin}
          maxLength={STORY_LIMITS.body}
          rows={7}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What did you do, where did you go, what would you tell a friend heading there?"
          className={`${fieldClass} resize-y leading-relaxed`}
        />
        <p className="flex justify-between text-xs text-ink-faint">
          <span>{bodyShort ? `At least ${STORY_LIMITS.bodyMin} characters` : "Looks good"}</span>
          <span className="tabular-nums">
            {body.length} / {STORY_LIMITS.body}
          </span>
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className={labelClass}>
          Places you&rsquo;d recommend <span className="font-normal text-ink-faint">— hotels, food, spots</span>
        </legend>
        {places.map((row, index) => (
          <div key={row.key} className="flex items-center gap-2 rounded-2xl border border-line bg-paper p-1.5 pl-2">
            <select
              aria-label={`Kind of place ${index + 1}`}
              value={row.kind}
              onChange={(event) => setPlaces((current) => current.map((r) => (r.key === row.key ? { ...r, kind: event.target.value as PlaceKind } : r)))}
              className="rounded-xl border border-line bg-paper-raised px-2 py-2 text-sm text-ink"
            >
              {PLACE_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
            <input
              aria-label={`Name of place ${index + 1}`}
              value={row.name}
              maxLength={120}
              onChange={(event) => setPlaces((current) => current.map((r) => (r.key === row.key ? { ...r, name: event.target.value } : r)))}
              placeholder={row.kind === "stay" ? "Hotel or guesthouse" : row.kind === "food" ? "Restaurant, café or stall" : "Street, view, market…"}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <DictationButton
              label={`Speak the name of place ${index + 1}`}
              onText={(spoken) => setPlaces((current) => current.map((r) => (r.key === row.key ? { ...r, name: appendSpoken(r.name, spoken).slice(0, 120) } : r)))}
            />
            <button
              type="button"
              onClick={() => setPlaces((current) => (current.length > 1 ? current.filter((r) => r.key !== row.key) : [{ ...row, name: "" }]))}
              aria-label={`Remove place ${index + 1}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-paper-sunken hover:text-danger"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        {places.length < STORY_LIMITS.places && (
          <button
            type="button"
            onClick={() => setPlaces((current) => [...current, { key: nextKey(), kind: "food", name: "" }])}
            className="justify-self-start text-sm font-semibold text-brand hover:underline"
          >
            + Add a place
          </button>
        )}
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor={ids.photos} className={labelClass}>
          Photos <span className="font-normal text-ink-faint">— up to {STORY_LIMITS.photos}, your own only</span>
        </label>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-dashed border-line-strong bg-paper p-2 sm:grid-cols-6">
          {photos.map((photo, index) => (
            <div key={photo.key} className="relative aspect-square overflow-hidden rounded-xl bg-paper-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the visitor's own photo before upload. */}
              <img src={photo.preview} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(photo.key)}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-deep/80 text-white"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < STORY_LIMITS.photos && (
            <label
              htmlFor={ids.photos}
              className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong bg-paper-raised text-center text-xs text-ink-soft transition hover:border-brand hover:text-brand"
            >
              {preparing ? "Preparing…" : "+ Add photo"}
            </label>
          )}
        </div>
        <input
          id={ids.photos}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            void addPhotos(event.target.files);
            event.target.value = "";
          }}
        />
        <p className="text-xs text-ink-faint">Photos are resized before upload, and the location data cameras hide inside them is removed.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.name} className={labelClass}>
              Name to show
            </label>
            <DictationButton label="Speak your name" onText={(spoken) => setName((current) => appendSpoken(current, spoken).slice(0, STORY_LIMITS.name))} />
          </div>
          <input id={ids.name} required maxLength={STORY_LIMITS.name} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Priya S." className={fieldClass} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex h-10 items-center">
            <label htmlFor={ids.email} className={labelClass}>
              Email <span className="font-normal text-ink-faint">— private, optional</span>
            </label>
          </div>
          <input id={ids.email} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Only if we may contact you" className={fieldClass} />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]" />
        <span>These are my own photos and words, and Nativa may publish them with the name above. No faces of other people without their OK.</span>
      </label>

      <input tabIndex={-1} aria-hidden autoComplete="off" name="website" value={trap} onChange={(event) => setTrap(event.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />

      {problem && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={!ready || phase === "sending" || preparing}
          className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-55"
        >
          {phase === "sending" ? progress || "Sending…" : "Send for review"}
        </button>
        <p className="text-center text-xs text-ink-faint">Nothing is public until our team has reviewed it.</p>
      </div>
    </form>
  );
}
