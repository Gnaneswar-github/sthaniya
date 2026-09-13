import { describe, expect, it } from "vitest";
import { cleanEnvValue } from "./env";

const BOM = String.fromCharCode(0xfeff);

describe("cleanEnvValue", () => {
  it("strips the byte-order mark PowerShell prepends to piped values", () => {
    // The production failure: "Bearer " + this value could not be sent as a header.
    const cleaned = cleanEnvValue(`${BOM}gsk_example`);
    expect(cleaned).toBe("gsk_example");
    expect(() => new Headers({ Authorization: `Bearer ${cleaned}` })).not.toThrow();
  });

  it("removes surrounding whitespace, newlines and quotes", () => {
    expect(cleanEnvValue('  "openai/gpt-oss-120b"\r\n')).toBe("openai/gpt-oss-120b");
    expect(cleanEnvValue("'value'")).toBe("value");
  });

  it("treats blank values as unset", () => {
    expect(cleanEnvValue(undefined)).toBeUndefined();
    expect(cleanEnvValue(`${BOM}  `)).toBeUndefined();
  });
});
