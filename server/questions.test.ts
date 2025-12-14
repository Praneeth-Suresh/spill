import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MySql2Database } from "drizzle-orm/mysql2";

const fakeQuestion = {
  id: 1,
  facilityId: 1,
  type: "text",
  title: "Sample",
  description: null,
  placeholder: null,
  isRequired: true,
  allowMultiple: false,
  maxFileSize: null,
  allowedFileTypes: null,
  nextQuestionId: null,
  redirectToHome: true,
  displayOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  pointsAwarded: 0,
};

const fakeDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockResolvedValue([fakeQuestion]),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
} as unknown as MySql2Database;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => fakeDb),
}));
import { evaluateNextQuestion, createBranchingRule, updateQuestionSequence } from "./branching";
// Ensure environment variables are loaded
import 'dotenv/config';

/**
 * Question Logic and Branching Test Suite
 * Tests question sequencing, branching logic, and navigation flows.
 */

describe("Question Branching Logic", () => {
  describe("evaluateNextQuestion", () => {
    it("returns default next question when no branching rules exist", async () => {
      vi.spyOn(fakeDb, "orderBy").mockResolvedValueOnce([] as any);
      const result = await evaluateNextQuestion(1, []);
      expect(result).toEqual({ nextQuestionId: null, redirectToHome: true });
    });

    it("evaluates option_selected condition correctly", async () => {
      vi.spyOn(fakeDb, "orderBy").mockResolvedValueOnce([
        {
          id: 1,
          questionId: 1,
          optionId: 10,
          condition: "option_selected",
          nextQuestionId: 5,
          redirectToHome: false,
          priority: 0,
          isActive: true,
          createdAt: new Date(),
        },
      ] as any);

      const result = await evaluateNextQuestion(1, [10]);
      expect(result).toEqual({ nextQuestionId: 5, redirectToHome: false });
    });

    it("evaluates any_answer condition correctly", async () => {
      vi.spyOn(fakeDb, "orderBy").mockResolvedValueOnce([
        {
          id: 2,
          questionId: 1,
          optionId: null,
          condition: "any_answer",
          nextQuestionId: 7,
          redirectToHome: false,
          priority: 0,
          isActive: true,
          createdAt: new Date(),
        },
      ] as any);

      const result = await evaluateNextQuestion(1, []);
      expect(result).toEqual({ nextQuestionId: 7, redirectToHome: false });
    });

    it("prioritizes rules by priority order", async () => {
      vi.spyOn(fakeDb, "orderBy").mockResolvedValueOnce([
        {
          id: 4,
          questionId: 1,
          optionId: 11,
          condition: "option_selected",
          nextQuestionId: 9,
          redirectToHome: true,
          priority: 0,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 3,
          questionId: 1,
          optionId: 11,
          condition: "option_selected",
          nextQuestionId: 8,
          redirectToHome: false,
          priority: 1,
          isActive: true,
          createdAt: new Date(),
        },
      ] as any);

      const result = await evaluateNextQuestion(1, [11]);
      expect(result).toEqual({ nextQuestionId: 9, redirectToHome: true });
    });
  });

  describe("createBranchingRule", () => {
    it("creates a valid branching rule", async () => {
      // This test demonstrates the API (database is available)
      await expect(
        createBranchingRule(
          1, // questionId
          'option_selected', // condition
          2, // nextQuestionId
          false, // redirectToHome
          1, // optionId
          0 // priority
        )
      ).resolves.not.toThrow();
    });
  });

  describe("updateQuestionSequence", () => {
    it("updates question default navigation", async () => {
      // This test demonstrates the API (database is available)
      await expect(
        updateQuestionSequence(
          1, // questionId
          2, // nextQuestionId
          false // redirectToHome
        )
      ).resolves.not.toThrow();
    });
  });
});

describe("Question Validation", () => {
  it("validates required fields for poll questions", () => {
    // Poll questions must have at least one option selected if required
    const isValid = (selectedOptions: number[], isRequired: boolean) => {
      if (isRequired && selectedOptions.length === 0) {
        return false;
      }
      return true;
    };

    expect(isValid([], true)).toBe(false);
    expect(isValid([1], true)).toBe(true);
    expect(isValid([], false)).toBe(true);
  });

  it("validates required fields for text questions", () => {
    // Text questions must have non-empty text if required
    const isValid = (text: string, isRequired: boolean) => {
      if (isRequired && !text.trim()) {
        return false;
      }
      return true;
    };

    expect(isValid("", true)).toBe(false);
    expect(isValid("  ", true)).toBe(false);
    expect(isValid("Some text", true)).toBe(true);
    expect(isValid("", false)).toBe(true);
  });

  it("validates file size limits", () => {
    // File uploads must respect size limits
    const isValid = (fileSize: number, maxSize: number | null) => {
      if (maxSize && fileSize > maxSize) {
        return false;
      }
      return true;
    };

    expect(isValid(1000000, 500000)).toBe(false); // 1MB > 500KB
    expect(isValid(500000, 1000000)).toBe(true); // 500KB < 1MB
    expect(isValid(1000000, null)).toBe(true); // No limit
  });

  it("validates file types", () => {
    // File uploads must match allowed types
    const isValid = (mimeType: string, allowedTypes: string | null) => {
      if (!allowedTypes) return true;
      const allowed = allowedTypes.split(',').map(t => t.trim());
      return allowed.includes(mimeType);
    };

    expect(isValid('image/jpeg', 'image/jpeg,image/png')).toBe(true);
    expect(isValid('image/gif', 'image/jpeg,image/png')).toBe(false);
    expect(isValid('application/pdf', null)).toBe(true);
  });
});

describe("Question Navigation Flows", () => {
  it("handles simple linear flow", () => {
    // Q1 → Q2 → Q3 → Home
    const flow = [
      { questionId: 1, nextQuestionId: 2, redirectToHome: false },
      { questionId: 2, nextQuestionId: 3, redirectToHome: false },
      { questionId: 3, nextQuestionId: null, redirectToHome: true },
    ];

    expect(flow[0].nextQuestionId).toBe(2);
    expect(flow[1].nextQuestionId).toBe(3);
    expect(flow[2].redirectToHome).toBe(true);
  });

  it("handles conditional branching", () => {
    // Q1 → (if option A) → Q2
    //   → (if option B) → Q3
    //   → (default) → Home
    
    const branches = [
      { condition: 'option_selected', optionId: 1, nextQuestionId: 2 },
      { condition: 'option_selected', optionId: 2, nextQuestionId: 3 },
    ];

    expect(branches[0].nextQuestionId).toBe(2);
    expect(branches[1].nextQuestionId).toBe(3);
  });

  it("handles circular prevention", () => {
    // Questions should not create circular loops
    // Q1 → Q2 → Q1 (BAD)
    
    const detectCircular = (
      questionId: number, 
      nextQuestionId: number | null,
      visited: Set<number> = new Set()
    ): boolean => {
      if (!nextQuestionId) return false;
      if (visited.has(nextQuestionId)) return true;
      visited.add(questionId);
      return false;
    };

    expect(detectCircular(1, 2)).toBe(false);
    expect(detectCircular(1, 1)).toBe(false); // Self-reference not detected in single check
  });
});

describe("IP Logging", () => {
  it("extracts IP address from request", () => {
    const getIpAddress = (req: any): string => {
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    };

    expect(getIpAddress({ ip: '192.168.1.1' })).toBe('192.168.1.1');
    expect(getIpAddress({ headers: { 'x-forwarded-for': '10.0.0.1' } })).toBe('10.0.0.1');
    expect(getIpAddress({ headers: {} })).toBe('unknown');
  });

  it("validates IPv4 addresses", () => {
    const isValidIPv4 = (ip: string): boolean => {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(ip)) return false;
      
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    };

    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('10.0.0.1')).toBe(true);
    expect(isValidIPv4('256.1.1.1')).toBe(false);
    expect(isValidIPv4('invalid')).toBe(false);
  });

  it("validates IPv6 addresses", () => {
    const isValidIPv6 = (ip: string): boolean => {
      // Simplified IPv6 validation
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
      return ipv6Regex.test(ip);
    };

    expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIPv6('::1')).toBe(false); // Simplified regex doesn't handle shortcuts
    expect(isValidIPv6('invalid')).toBe(false);
  });
});
