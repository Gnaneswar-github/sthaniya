/**
 * Helpers for dictation: joining spoken phrases onto what someone has already typed, and picking
 * the language to listen in from the visitor's own browser — never a fixed one.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Appends a spoken phrase to existing text with sensible spacing and sentence capitals. */
export function appendSpoken(current: string, spoken: string): string {
  const words = spoken.replace(/\s+/g, " ").trim();
  if (!words) return current;
  const base = current.replace(/\s+$/, "");
  if (!base) return capitalise(words);
  return `${base} ${/[.!?]$/.test(base) ? capitalise(words) : words}`;
}

/** A two-letter language code for the transcription service, when the browser's tag has one. */
export function transcriptionLanguage(tag: string | undefined): string | undefined {
  const code = tag?.trim().slice(0, 2).toLowerCase();
  return code && /^[a-z]{2}$/.test(code) ? code : undefined;
}
