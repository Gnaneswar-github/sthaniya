import { describe, expect, it } from "vitest";
import { readMobility, readParty, travellersIn } from "./intent/party";

describe("mobility", () => {
  it.each([
    ["with my parents who can't walk much", "limited", "can't walk much"],
    ["with my parents who can’t walk much", "limited", "can’t walk much"],
    ["my mother cannot walk far", "limited", "cannot walk far"],
    ["dad has bad knees", "limited", "bad knees"],
    ["Penang for 4 days with my elderly mother", "limited", "elderly"],
    ["with my grandparents", "limited", "grandparents"],
    ["limited mobility", "limited", "limited mobility"],
    ["my dad uses a wheelchair", "wheelchair", "wheelchair"],
    ["two kids under 5, we'll have a stroller", "pram", "stroller"],
    ["with a pram", "pram", "pram"],
    ["travelling with our baby", "pram", "baby"],
  ])("%s → %s", (text, value, matched) => {
    expect(readMobility(text)).toEqual({ value, matched });
  });

  it("reads nothing when people walk a lot", () => {
    expect(readMobility("packed schedule, we walk a lot")).toBeNull();
    expect(readMobility("3 days in Tokyo with my wife")).toBeNull();
  });

  it("puts a wheelchair ahead of other signals", () => {
    expect(readMobility("my elderly dad uses a wheelchair")?.value).toBe("wheelchair");
  });
});

describe("headcount", () => {
  it.each([
    ["with my parents who can't walk much", { adults: 3, children: 0, guessed: true }],
    ["3 days in Kyoto with my wife", { adults: 2, children: 0, guessed: false }],
    ["A week in Lisbon solo", { adults: 1, children: 0, guessed: false }],
    ["with friends, 5 of us", { adults: 5, children: 0, guessed: false }],
    ["Weekend in Pune with two kids under 5", { adults: 2, children: 2, guessed: true }],
    ["my dad uses a wheelchair", { adults: 2, children: 0, guessed: true }],
    ["with my elderly mother", { adults: 2, children: 0, guessed: true }],
    ["we are 4 people", { adults: 4, children: 0, guessed: false }],
  ])("%s", (text, expected) => {
    expect(readParty(text)).toMatchObject(expected);
  });

  it("returns nothing when the group isn't mentioned", () => {
    expect(readParty("3 days in Kumbakonam, packed schedule")).toBeNull();
  });

  it("falls back to the traveller type when no headcount was given", () => {
    expect(travellersIn({ travellerType: "couple" })).toEqual({ adults: 2, children: 0, total: 2 });
    expect(travellersIn({ travellerType: "family", adults: 3, children: 1 })).toEqual({ adults: 3, children: 1, total: 4 });
  });
});
