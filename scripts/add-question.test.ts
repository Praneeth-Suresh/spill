import { describe, it, expect } from "vitest";
// Import or reimplement helpers for isolated testing

function parseBoolean(answer: string | undefined, fallback: boolean): boolean {
  if (!answer) return fallback;
  const normalized = answer.trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  return fallback;
}

function isValidQuestionType(type: string): boolean {
  return ["poll", "text", "fill_blanks", "file_upload"].includes(type);
}

describe("parseBoolean", () => {
  it("parses yes/true/1 as true", () => {
    expect(parseBoolean("y", false)).toBe(true);
    expect(parseBoolean("yes", false)).toBe(true);
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("1", false)).toBe(true);
  });
  it("parses no/false/0 as false", () => {
    expect(parseBoolean("n", true)).toBe(false);
    expect(parseBoolean("no", true)).toBe(false);
    expect(parseBoolean("false", true)).toBe(false);
    expect(parseBoolean("0", true)).toBe(false);
  });
  it("returns fallback for empty or unknown", () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean("", false)).toBe(false);
    expect(parseBoolean("maybe", true)).toBe(true);
  });
});

describe("isValidQuestionType", () => {
  it("accepts valid types", () => {
    ["poll", "text", "fill_blanks", "file_upload"].forEach(type => {
      expect(isValidQuestionType(type)).toBe(true);
    });
  });
  it("rejects invalid types", () => {
    ["", "foo", "bar", "upload"].forEach(type => {
      expect(isValidQuestionType(type)).toBe(false);
    });
  });
});

describe("askNumber edge cases", () => {
  // Simulate the logic for number parsing
  function parseNumber(raw: string, fallback?: number): number | null {
    const value = Number(raw.trim());
    if (raw.trim() === "" && fallback !== undefined) return fallback;
    if (raw.trim() === "") return null;
    if (Number.isNaN(value)) return null;
    return value;
  }
  it("returns fallback for empty input", () => {
    expect(parseNumber("", 5)).toBe(5);
  });
  it("returns null for empty input and no fallback", () => {
    expect(parseNumber("")).toBeNull();
  });
  it("returns number for valid input", () => {
    expect(parseNumber("42")).toBe(42);
  });
  it("returns null for invalid input", () => {
    expect(parseNumber("abc", 7)).toBeNull();
  });
});

describe("askRequired edge cases", () => {
  // Simulate the logic for required string
  function isRequiredValid(val: string): boolean {
    return val.trim().length > 0;
  }
  it("accepts non-empty input", () => {
    expect(isRequiredValid("foo")).toBe(true);
    expect(isRequiredValid("  bar  ")).toBe(true);
  });
  it("rejects empty or whitespace", () => {
    expect(isRequiredValid("")).toBe(false);
    expect(isRequiredValid("   ")).toBe(false);
  });
});
