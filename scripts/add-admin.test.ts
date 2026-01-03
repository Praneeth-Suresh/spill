import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizeRoleInput, parseFacilitySelection } from "./add-admin";

describe("normalizeRoleInput", () => {
  it("defaults to admin when empty", () => {
    expect(normalizeRoleInput("")).toBe("admin");
    expect(normalizeRoleInput(undefined)).toBe("admin");
  });

  it("accepts super aliases", () => {
    expect(normalizeRoleInput("super"))
      .toBe("super_admin");
    expect(normalizeRoleInput("super_admin"))
      .toBe("super_admin");
    expect(normalizeRoleInput("super-admin"))
      .toBe("super_admin");
  });

  it("rejects invalid roles", () => {
    expect(() => normalizeRoleInput("viewer")).toThrow(/invalid role/i);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Test@Example.com  ")).toBe("test@example.com");
  });

  it("rejects invalid emails", () => {
    expect(() => normalizeEmail("not-an-email")).toThrow(/valid email/i);
    expect(() => normalizeEmail("")).toThrow(/valid email/i);
  });
});

describe("parseFacilitySelection", () => {
  const valid = [1, 2, 3, 10];

  it("parses comma and space separated ids and de-duplicates", () => {
    expect(parseFacilitySelection("1, 2 2 3", valid)).toEqual([1, 2, 3]);
    expect(parseFacilitySelection("10", valid)).toEqual([10]);
  });

  it("rejects non-numeric values", () => {
    expect(() => parseFacilitySelection("1, x", valid)).toThrow(/numbers/i);
  });

  it("rejects invalid ids", () => {
    expect(() => parseFacilitySelection("5", valid)).toThrow(/invalid facility ids/i);
  });

  it("requires at least one id", () => {
    expect(() => parseFacilitySelection("   ", valid)).toThrow(/at least one/i);
  });
});
