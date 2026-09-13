import { describe, expect, it } from "vitest";
import { earnsCommission, staysLink, toursLink } from "./affiliates";

describe("booking links", () => {
  it("work as plain links before any partner programme is set up", () => {
    const link = new URL(toursLink("Belém Tower, Lisbon", {}).url);
    expect(link.hostname).toBe("www.getyourguide.com");
    expect(link.searchParams.get("q")).toBe("Belém Tower, Lisbon");
    expect(link.searchParams.has("partner_id")).toBe(false);
    expect(earnsCommission({})).toBe(false);
  });

  it("carry partner IDs once they exist", () => {
    expect(new URL(toursLink("Lisbon", { getYourGuide: "ABC123" }).url).searchParams.get("partner_id")).toBe("ABC123");
    const viator = toursLink("Lisbon", { viator: "P00012345" });
    expect(viator.provider).toBe("Viator");
    expect(new URL(viator.url).searchParams.get("pid")).toBe("P00012345");
    expect(earnsCommission({ booking: "999" })).toBe(true);
  });

  it("searches stays for the trip's own dates and party", () => {
    const url = new URL(
      staysLink({ city: "Lisbon", checkin: "2026-11-02", checkout: "2026-11-05", travellerType: "couple" }, { booking: "42" }).url,
    );
    expect(url.searchParams.get("checkin")).toBe("2026-11-02");
    expect(url.searchParams.get("checkout")).toBe("2026-11-05");
    expect(url.searchParams.get("group_adults")).toBe("2");
    expect(url.searchParams.get("aid")).toBe("42");
  });
});
