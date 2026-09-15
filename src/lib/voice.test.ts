import { describe, expect, it } from "vitest";
import { appendSpoken, transcriptionLanguage } from "./voice";

describe("appendSpoken", () => {
  it("starts an empty field with a capital", () => {
    expect(appendSpoken("", "three days in kyoto")).toBe("Three days in kyoto");
  });

  it("continues a sentence without a capital", () => {
    expect(appendSpoken("3 days in Kyoto", "with my partner")).toBe("3 days in Kyoto with my partner");
  });

  it("starts a new sentence after a full stop", () => {
    expect(appendSpoken("3 days in Kyoto.", "we love tofu")).toBe("3 days in Kyoto. We love tofu");
  });

  it("collapses stray whitespace and ignores silence", () => {
    expect(appendSpoken("Hello  ", "  there   friend ")).toBe("Hello there friend");
    expect(appendSpoken("Unchanged", "   ")).toBe("Unchanged");
  });
});

describe("transcriptionLanguage", () => {
  it("reads the language part of a browser tag", () => {
    expect(transcriptionLanguage("hi-IN")).toBe("hi");
    expect(transcriptionLanguage("en")).toBe("en");
  });

  it("returns nothing it can't use", () => {
    expect(transcriptionLanguage(undefined)).toBeUndefined();
    expect(transcriptionLanguage("1x")).toBeUndefined();
  });
});
