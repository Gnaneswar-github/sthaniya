/**
 * Resolves each seeded place to real coordinates via OpenStreetMap Nominatim.
 * Keyless, but rate-limited to one request per second by their usage policy.
 *
 * Usage: node scripts/geocode.mjs
 * Prints `id: { lat, lng }` lines plus the matched display name so a human can sanity-check
 * that the geocoder found the right place before the values are trusted.
 */

const QUERIES = {
  "pune-dagdusheth": "Shrimant Dagadusheth Halwai Ganpati Mandir, Budhwar Peth, Pune",
  "pune-vaishali": "Vaishali, Fergusson College Road, Shivajinagar, Pune",
  "pune-bedekar": "Bedekar Misal, Narayan Peth, Pune",
  "pune-parvati": "Parvati Hill Temple, Parvati Paytha, Pune",
  "pune-chitale": "Chitale Bandhu, Pune",
  "pune-kasba-peth": "Kasba Ganpati, Kasba Peth, Pune",
  "pune-taljai": "Taljai Tekdi, Pune",
  "pune-pu-la-garden": "Pune Okayama Friendship Garden, Pune",
  "pune-khunya-murlidhar": "Khunya Murlidhar Mandir, Sadashiv Peth, Pune",
};

for (const [id, query] of Object.entries(QUERIES)) {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "Sthaniya/0.2 (residency demo; https://github.com/Gnaneswar-github/sthaniya)" },
  });

  if (!response.ok) {
    console.log(`${id}: HTTP ${response.status}`);
  } else {
    const [hit] = await response.json();
    if (!hit) console.log(`${id}: NO MATCH — "${query}"`);
    else console.log(`${id}: { lat: ${Number(hit.lat).toFixed(5)}, lng: ${Number(hit.lon).toFixed(5)} }  // ${hit.display_name.slice(0, 70)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1100));
}
