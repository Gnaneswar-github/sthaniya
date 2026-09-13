/**
 * Environment values the way they were meant to be written, not the way a shell happened to
 * store them.
 *
 * Values piped in from Windows PowerShell arrive with an invisible byte-order mark (U+FEFF)
 * at the front. Locally that never shows up; in production it made every Groq request fail
 * with "Cannot convert argument to a ByteString", because an HTTP header cannot hold that
 * character. Stray quotes and trailing newlines from copy-paste are the same class of bug.
 */

// Built from code points so the pattern itself contains nothing invisible.
const INVISIBLE = new RegExp(
  `[${String.fromCharCode(0xfeff, 0x200b, 0x200c, 0x200d, 0x2060)}]`,
  "g",
);

export function cleanEnvValue(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;

  const cleaned = raw
    .replace(INVISIBLE, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();

  return cleaned === "" ? undefined : cleaned;
}

/** Server-only lookup. `NEXT_PUBLIC_` values must be read literally so the build can inline them. */
export function readEnv(name: string): string | undefined {
  return cleanEnvValue(process.env[name]);
}
