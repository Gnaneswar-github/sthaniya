/**
 * Finds wide, high-resolution, properly licensed candidates for the homepage hero.
 * Prints aspect ratio so a portrait shot never gets picked for a full-bleed banner.
 *
 * Usage: node scripts/find-hero.mjs "santorini oia sunset" "kyoto street evening"
 */

const UA = { "User-Agent": "Sthaniya/0.5 (residency demo; https://github.com/Gnaneswar-github/sthaniya)" };

async function search(term) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "2400",
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: UA });
  if (!response.ok) return [];
  const pages = (await response.json()).query?.pages ?? {};

  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      const strip = (v) => (v ?? "").replace(/<[^>]*>/g, "").trim();
      return {
        title: page.title,
        ratio: info.width / info.height,
        width: info.width,
        url: (info.thumburl ?? info.url).split("?")[0],
        credit: `${strip(info.extmetadata?.Artist?.value) || "Unknown"} / ${strip(info.extmetadata?.LicenseShortName?.value) || "?"}`,
        page: info.descriptionurl,
      };
    })
    .filter(Boolean)
    // A hero needs to be wide and big enough not to soften on a large screen.
    .filter((hit) => hit.ratio >= 1.5 && hit.width >= 2000);
}

for (const term of process.argv.slice(2)) {
  console.log(`\n=== ${term} ===`);
  for (const hit of await search(term)) {
    console.log(`${hit.title}\n  ratio ${hit.ratio.toFixed(2)}  ${hit.width}px  ${hit.credit}\n  ${hit.url}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
