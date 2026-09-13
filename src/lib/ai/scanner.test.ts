import { describe, expect, it } from "vitest";
import { ObjectScanner } from "./scanner";

const place = (ref: string) =>
  JSON.stringify({ ref, window: { start: "09:00", end: "11:00" }, description: 'Braces {inside} "quotes"' });

describe("ObjectScanner", () => {
  it("emits each place the moment its object closes, across arbitrary chunk boundaries", () => {
    const scanner = new ObjectScanner();
    const text = `${place("p1")}\n${place("p2")}\n`;
    const seen: unknown[] = [];
    for (let i = 0; i < text.length; i += 7) seen.push(...scanner.push(text.slice(i, i + 7)));
    expect(seen.map((o) => (o as { ref: string }).ref)).toEqual(["p1", "p2"]);
  });

  it("ignores nested objects and still finds places inside a wrapping object", () => {
    const scanner = new ObjectScanner();
    const found = scanner.push(`{"places":[${place("a")},${place("b")}]}`);
    const refs = found.map((o) => (o as { ref?: string }).ref).filter(Boolean);
    expect(refs).toEqual(["a", "b"]);
  });

  it("survives prose and code fences around the JSON", () => {
    const scanner = new ObjectScanner();
    const found = scanner.push("Here you go:\n```json\n" + place("x") + "\n```");
    expect(found).toHaveLength(1);
  });
});
