import { cleanEnvValue } from "@/lib/env";

export const maxDuration = 60;

const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST multipart { audio, language? } → { text }. The fallback for browsers without built-in
 * speech recognition: a short recording is transcribed by Whisper on Groq. Audio is passed
 * straight through and not stored.
 */
export async function POST(request: Request) {
  const key = cleanEnvValue(process.env.GROQ_API_KEY);
  if (!key) return Response.json({ error: "Dictation isn't available right now." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "No recording was received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "That recording is too long — try a shorter one." }, { status: 413 });
  }

  const upstream = new FormData();
  const name = audio instanceof File && audio.name ? audio.name : "speech.webm";
  upstream.append("file", audio, name);
  upstream.append("model", "whisper-large-v3-turbo");
  upstream.append("response_format", "json");
  const language = form?.get("language");
  if (typeof language === "string" && /^[a-z]{2}$/.test(language)) upstream.append("language", language);

  const response = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: upstream });
  if (!response.ok) {
    return Response.json({ error: "We couldn't turn that into text just now." }, { status: 502 });
  }
  const { text } = (await response.json()) as { text?: string };
  return Response.json({ text: (text ?? "").trim() });
}
