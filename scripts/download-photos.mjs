/**
 * Downloads each Commons photo into public/photos so the app never depends on
 * Wikimedia's CDN at request time — they rate-limit hotlinking, which would fail
 * exactly when it matters most. Attribution still ships with every card.
 *
 * Usage: node scripts/download-photos.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";

const sources = JSON.parse(
  await readFile(new URL("../src/lib/data/photos.json", import.meta.url), "utf8"),
);

const OUT = new URL("../public/photos/", import.meta.url);
await mkdir(OUT, { recursive: true });

for (const [id, photo] of Object.entries(sources)) {
  const filename = `${id}.jpg`;

  const response = await fetch(photo.remoteUrl, {
    headers: { "User-Agent": "Nativa/0.1 (residency demo; https://github.com/Gnaneswar-github/sthaniya)" },
  });
  if (!response.ok) {
    console.log(`FAILED ${id}: HTTP ${response.status}`);
    continue;
  }

  await writeFile(new URL(filename, OUT), Buffer.from(await response.arrayBuffer()));
  console.log(`saved ${filename}  (${photo.credit})`);

  // Wikimedia asks for considerate request rates.
  await new Promise((resolve) => setTimeout(resolve, 400));
}
