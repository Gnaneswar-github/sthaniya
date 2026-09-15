import { describe, expect, it } from "vitest";
import { mergeWikipedia, type Candidate } from "./places/overpass";

const osm = (name: string, lat: number, facts: Candidate["facts"] = { amenity: "place_of_worship", religion: "hindu" }): Candidate => ({
  ref: "p0",
  name,
  kind: "place of worship",
  coords: { lat, lng: 79.38 },
  notable: false,
  facts,
});
const wiki = (title: string, lat: number): Candidate => ({
  ref: "w0",
  name: title,
  kind: "place with a Wikipedia article",
  coords: { lat, lng: 79.38 },
  notable: true,
  facts: { hasWikipedia: true },
  wikipedia: `en:${title}`,
});

describe("merging Wikipedia landmarks into map places", () => {
  it("links a map entry to its article instead of listing the place twice", () => {
    const merged = mergeWikipedia([osm("Sarangapani Temple", 10.9591)], [wiki("Sarangapani Temple", 10.9594)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].facts.hasWikipedia).toBe(true);
    expect(merged[0].facts.religion).toBe("hindu");
    expect(merged[0].wikipedia).toBe("en:Sarangapani Temple");
  });

  it("matches despite honorifics and a town in brackets", () => {
    const merged = mergeWikipedia([osm("Arulmigu Adi Kumbeswarar Temple", 10.9552)], [wiki("Adi Kumbeswarar Temple (Kumbakonam)", 10.9556)]);
    expect(merged).toHaveLength(1);
  });

  it("adds landmarks the map lists no point for", () => {
    const merged = mergeWikipedia([osm("Sarangapani Temple", 10.9591)], [wiki("Mahamaham Tank", 10.9587)]);
    expect(merged.map((c) => c.name)).toEqual(["Sarangapani Temple", "Mahamaham Tank"]);
  });

  it("keeps same-named places that are far apart", () => {
    const merged = mergeWikipedia([osm("Vinayagar Temple", 10.9)], [wiki("Vinayagar Temple", 11.1)]);
    expect(merged).toHaveLength(2);
  });
});
