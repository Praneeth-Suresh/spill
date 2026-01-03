import { describe, expect, it, vi, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import type { MySql2Database } from "drizzle-orm/mysql2";
import "dotenv/config";

const baseContext: TrpcContext = {
  user: null,
  req: {
    protocol: "https",
    headers: {},
    ip: "127.0.0.1",
  } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  ipAddress: "::1",
  userAgent: "vitest",
};

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockDb(resultCount: number) {
  const where = vi.fn().mockResolvedValue([{ count: resultCount }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const mockDb = { select } as unknown as MySql2Database;

  return { mockDb, select, from, where };
}

describe("questions.getResponseCount", () => {
  it("returns the number of responses for a question", async () => {
    const { mockDb } = createMockDb(7);
    vi.spyOn(db, "getDb").mockResolvedValueOnce(mockDb);

    const caller = appRouter.createCaller(baseContext);
    const result = await caller.questions.getResponseCount({ questionId: 5 });

    expect(result).toEqual({ count: 7 });
  });

  it("throws when the database is unavailable", async () => {
    vi.spyOn(db, "getDb").mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(baseContext);

    await expect(
      caller.questions.getResponseCount({ questionId: 5 })
    ).rejects.toThrow("Database not available");
  });
});
