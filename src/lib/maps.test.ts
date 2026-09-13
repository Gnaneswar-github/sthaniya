import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "./maps";

describe("googleMapsUrl", () => {
  it("uses the keyless Maps URLs search scheme", () => {
    const url = new URL(googleMapsUrl("Koshy's", "Bengaluru"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Koshy's, Bengaluru");
  });

  it("doesn't repeat the destination when the name already includes it", () => {
    const url = new URL(googleMapsUrl("Temple of Literature, Hanoi", "Hanoi"));
    expect(url.searchParams.get("query")).toBe("Temple of Literature, Hanoi");
  });

  it("encodes non-Latin names safely", () => {
    const url = new URL(googleMapsUrl("Kiyomizu-dera (清水寺)", "Kyoto"));
    expect(url.searchParams.get("query")).toBe("Kiyomizu-dera (清水寺), Kyoto");
  });
});
