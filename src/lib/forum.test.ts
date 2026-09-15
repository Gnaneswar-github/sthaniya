import { describe, expect, it } from "vitest";
import { FORUM_REGIONS, FORUM_THEMES, regionLabel, repliesLabel, themeLabel } from "./forum";
import { anyColumnLike, cleanSearchTerm } from "./supabase-public";

describe("forum search terms", () => {
  it("keeps words in any script", () => {
    expect(cleanSearchTerm("  Kyōto   rail pass ")).toBe("Kyōto rail pass");
    expect(cleanSearchTerm("मुंबई लोकल")).toBe("मुंबई लोकल");
  });

  it("strips characters that could break out of the filter", () => {
    expect(cleanSearchTerm('a),title.eq."x"%*')).toBe("a title eq x");
  });

  it("caps the length", () => {
    expect(cleanSearchTerm("x".repeat(200))).toHaveLength(80);
  });

  it("builds one ilike clause per column", () => {
    expect(anyColumnLike("rail pass", ["title", "body"])).toBe('title.ilike."%rail pass%",body.ilike."%rail pass%"');
  });
});

describe("forum vocabulary", () => {
  it("has unique slugs", () => {
    expect(new Set(FORUM_REGIONS.map((r) => r.slug)).size).toBe(FORUM_REGIONS.length);
    expect(new Set(FORUM_THEMES.map((t) => t.slug)).size).toBe(FORUM_THEMES.length);
  });

  it("labels known slugs and ignores unknown ones", () => {
    expect(regionLabel("latin-america")).toBe("Central & South America");
    expect(themeLabel("trains")).toBe("Trains & road trips");
    expect(regionLabel("atlantis")).toBeNull();
  });

  it("pluralises replies", () => {
    expect(repliesLabel(1)).toBe("1 reply");
    expect(repliesLabel(3)).toBe("3 replies");
  });
});
