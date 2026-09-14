/**
 * Searches Wikimedia Commons for candidate photos of each seeded place and prints
 * the licence, author and URL for each hit so a human can pick and attribute one.
 *
 * Usage: node scripts/find-photos.mjs "Shaniwar Wada" "Parvati Hill Pune" ...
 */

const API = "https://commons.wikimedia.org/w/api.php";

async function search(term) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: "6",
    gsrlimit: "6",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    origin: "*",
  });

  const response = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": "Nativa/0.1 (demo project; contact via repo)" },
  });
  if (!response.ok) throw new Error(`${term}: HTTP ${response.status}`);

  const pages = (await response.json()).query?.pages ?? {};
  return Object.values(pages).map((page) => {
    const info = page.imageinfo?.[0] ?? {};
    const meta = info.extmetadata ?? {};
    const strip = (value) => (value ?? "").replace(/<[^>]*>/g, "").trim();
    return {
      title: page.title,
      licence: strip(meta.LicenseShortName?.value) || "unknown",
      author: strip(meta.Artist?.value) || "unknown",
      thumb: info.thumburl,
      descriptionUrl: info.descriptionurl,
    };
  });
}

/** Resolves exact File: titles to a stable thumbnail URL plus attribution. */
async function resolve(titles) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
  });

  const response = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": "Nativa/0.1 (demo project; contact via repo)" },
  });
  const pages = (await response.json()).query?.pages ?? {};

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info) {
      console.log(`${page.title}\n  MISSING`);
      continue;
    }
    const meta = info.extmetadata ?? {};
    const strip = (value) => (value ?? "").replace(/<[^>]*>/g, "").trim();
    const url = (info.thumburl ?? info.url).split("?")[0].replace("//thumb.wikimedia.org", "//upload.wikimedia.org");
    console.log(
      `${page.title}\n  url: ${url}\n  credit: ${strip(meta.Artist?.value)} / ${strip(meta.LicenseShortName?.value)}\n  page: ${info.descriptionurl}`,
    );
  }
}

const args = process.argv.slice(2);
if (args[0] === "--titles") {
  await resolve(args.slice(1));
} else {
  for (const term of args) {
    console.log(`\n=== ${term} ===`);
    try {
      for (const hit of await search(term)) {
        console.log(`${hit.title}\n  licence: ${hit.licence}\n  author: ${hit.author}\n  url: ${hit.thumb}`);
      }
    } catch (error) {
      console.log(`  failed: ${error.message}`);
    }
  }
}
