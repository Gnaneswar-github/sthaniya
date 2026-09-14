/**
 * Pulls a real, licensed lead image and a real summary for each curated destination.
 * Wikipedia for the summary, Commons for the image. Nothing here is written by us, so
 * the global rails carry sourced content rather than invented content.
 *
 * Usage: node scripts/find-destination-photos.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";

const DESTINATIONS = {
  tokyo: { title: "Tokyo", commons: "Tokyo skyline" },
  kyoto: { title: "Kyoto", commons: "Kyoto street" },
  istanbul: { title: "Istanbul", commons: "Istanbul Bosphorus" },
  lisbon: { title: "Lisbon", commons: "Lisbon tram street" },
  "mexico-city": { title: "Mexico City", commons: "Mexico City street" },
  marrakesh: { title: "Marrakesh", commons: "Marrakesh medina" },
  hanoi: { title: "Hanoi", commons: "Hanoi old quarter" },
  varanasi: { title: "Varanasi", commons: "Varanasi ghats" },
  "george-town-penang": { title: "George Town, Penang", commons: "George Town Penang street" },
  tbilisi: { title: "Tbilisi", commons: "Tbilisi old town" },
  oaxaca: { title: "Oaxaca City", commons: "Oaxaca city street" },
  pune: { title: "Pune", commons: "Pune city" },
};

const UA = { "User-Agent": "Nativa/0.3 (residency demo; https://github.com/Gnaneswar-github/sthaniya)" };
const OUT = new URL("../public/destinations/", import.meta.url);
await mkdir(OUT, { recursive: true });

async function summary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: UA });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    title: data.title,
    extract: data.extract,
    lat: data.coordinates?.lat ?? null,
    lng: data.coordinates?.lon ?? null,
    wikipediaUrl: data.content_urls?.desktop?.page ?? null,
  };
}

async function commonsImage(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "1",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1600",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: UA });
  if (!response.ok) return null;
  const pages = (await response.json()).query?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const strip = (v) => (v ?? "").replace(/<[^>]*>/g, "").trim();
  return {
    url: (info.thumburl ?? info.url).split("?")[0],
    credit: `${strip(info.extmetadata?.Artist?.value) || "Unknown"} / ${strip(info.extmetadata?.LicenseShortName?.value) || "see source"}`,
    sourceUrl: info.descriptionurl,
    file: page.title,
  };
}

const result = {};
for (const [id, spec] of Object.entries(DESTINATIONS)) {
  const [info, image] = await Promise.all([summary(spec.title), commonsImage(spec.commons)]);
  if (!info || !image) {
    console.log(`${id}: INCOMPLETE (summary:${Boolean(info)} image:${Boolean(image)})`);
    continue;
  }

  const download = await fetch(image.url, { headers: UA });
  if (!download.ok) {
    console.log(`${id}: image download failed HTTP ${download.status}`);
    continue;
  }
  await writeFile(new URL(`${id}.jpg`, OUT), Buffer.from(await download.arrayBuffer()));

  result[id] = { ...info, credit: image.credit, imageSourceUrl: image.sourceUrl };
  console.log(`${id}: ok — ${image.file} — ${image.credit}`);
  await new Promise((r) => setTimeout(r, 500));
}

await writeFile(
  new URL("../src/lib/data/destinations.json", import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(`\nwrote src/lib/data/destinations.json (${Object.keys(result).length} destinations)`);
