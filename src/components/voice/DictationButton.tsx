"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { transcriptionLanguage } from "@/lib/voice";

type Mode = "live" | "record" | "none";
type Phase = "idle" | "listening" | "transcribing" | "denied" | "error";

type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/**
 * Live speech recognition where the browser offers it (Chrome, Edge, Safari), otherwise a short
 * recording sent to our transcription endpoint (Firefox and others). No button at all when the
 * browser can do neither, rather than one that can't work.
 */
function detectMode(): Mode {
  if (typeof window === "undefined") return "none";
  const w = window as SpeechWindow;
  if (w.SpeechRecognition || w.webkitSpeechRecognition) return "live";
  if (typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") return "record";
  return "none";
}
const subscribe = () => () => undefined;

const MAX_RECORDING_MS = 90_000;
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

/**
 * A microphone button that writes what someone says into a field. `onText` receives each finished
 * phrase; the field decides how to join it onto what's already there.
 */
export function DictationButton({
  onText,
  tone = "light",
  label = "Speak instead of typing",
  className = "",
}: {
  onText: (spoken: string) => void;
  /** "light" sits on white fields; "dark" on the dark hero or photographs. */
  tone?: "light" | "dark";
  label?: string;
  className?: string;
}) {
  const detected = useSyncExternalStore(subscribe, detectMode, () => "none" as Mode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  // Some browsers expose live recognition but can't reach its service (Brave, privacy modes):
  // after one "network" failure, recording takes over.
  const [forceRecord, setForceRecord] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef(0);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(
    () => () => {
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      window.clearTimeout(stopTimer.current);
    },
    [],
  );

  const mode: Mode = detected === "live" && forceRecord ? (typeof MediaRecorder !== "undefined" ? "record" : "none") : detected;
  if (mode === "none") return null;

  function startLive() {
    const w = window as SpeechWindow;
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onTextRef.current(result[0].transcript);
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setPhase("denied");
      else if (event.error === "network") {
        setForceRecord(true);
        setPhase("error");
      } else if (event.error === "no-speech" || event.error === "aborted") setPhase("idle");
      else setPhase("error");
    };
    rec.onend = () => {
      recognition.current = null;
      setInterim("");
      setPhase((current) => (current === "listening" ? "idle" : current));
    };
    recognition.current = rec;
    setPhase("listening");
    rec.start();
  }

  async function startRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("denied");
      return;
    }
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      window.clearTimeout(stopTimer.current);
      recorder.current = null;
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1500) {
        setPhase("idle");
        return;
      }
      setPhase("transcribing");
      try {
        const body = new FormData();
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        body.append("audio", blob, `speech.${extension}`);
        const language = transcriptionLanguage(navigator.language);
        if (language) body.append("language", language);
        const response = await fetch("/api/transcribe", { method: "POST", body });
        if (!response.ok) throw new Error(String(response.status));
        const { text } = (await response.json()) as { text?: string };
        if (text?.trim()) onTextRef.current(text);
        setPhase("idle");
      } catch {
        setPhase("error");
      }
    };
    recorder.current = rec;
    rec.start();
    setPhase("listening");
    stopTimer.current = window.setTimeout(() => {
      if (rec.state === "recording") rec.stop();
    }, MAX_RECORDING_MS);
  }

  function toggle() {
    if (phase === "listening") {
      recognition.current?.stop();
      if (recorder.current?.state === "recording") recorder.current.stop();
      return;
    }
    if (phase === "transcribing") return;
    if (mode === "live") {
      try {
        startLive();
      } catch {
        setPhase("error");
      }
    } else {
      void startRecording();
    }
  }

  const listening = phase === "listening";
  const message =
    phase === "listening"
      ? interim || (mode === "live" ? "Listening… tap the mic to stop" : "Recording… tap the mic when you're done")
      : phase === "transcribing"
        ? "Writing down what you said…"
        : phase === "denied"
          ? "Microphone is blocked. Allow it for this site in your browser settings, or keep typing."
          : phase === "error"
            ? "Couldn't catch that. Tap the mic to try again, or type instead."
            : "";

  const idleStyle =
    tone === "dark"
      ? "text-white/85 ring-1 ring-white/30 hover:bg-white/10 hover:text-white"
      : "text-ink-soft ring-1 ring-line hover:text-brand hover:ring-brand";

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : label}
        title={listening ? "Stop dictation" : label}
        className={`relative grid h-10 w-10 place-items-center rounded-full transition active:scale-95 ${
          listening ? "bg-danger text-white ring-0" : phase === "transcribing" ? "text-brand ring-1 ring-brand/40" : idleStyle
        }`}
      >
        {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
        {phase === "transcribing" ? (
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] animate-spin" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
        )}
      </button>
      {message && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-30 mt-2 w-max max-w-[16rem] rounded-xl bg-deep px-3 py-2 text-xs leading-snug text-white shadow-[0_12px_28px_-14px_rgba(7,28,41,0.8)] sm:max-w-[20rem]"
        >
          {message}
        </span>
      )}
    </span>
  );
}
