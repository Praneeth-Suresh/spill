import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    hasIpActivityToday: vi.fn(),
    getTopUpdates: vi.fn(),
  } satisfies Partial<typeof actual>;
});

import * as db from "./db";
import { appRouter } from "./routers";

const mockedDb = vi.mocked(db);

const baseReq = { protocol: "https", headers: {}, ip: "192.168.0.10" } as TrpcContext["req"];
const baseRes = { clearCookie: () => {} } as TrpcContext["res"];

const createContext = (options: Partial<TrpcContext> = {}): TrpcContext => ({
  req: baseReq,
  res: baseRes,
  user: null,
  ipAddress: "::ffff:192.168.0.10",
  userAgent: "vitest",
  ...options,
});

describe("updates router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks when ip activity not found", async () => {
    mockedDb.hasIpActivityToday.mockResolvedValue(false);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.updates.top()).rejects.toThrowError();
    expect(mockedDb.getTopUpdates).not.toHaveBeenCalled();
  });

  it("returns paragraphs when allowed", async () => {
    mockedDb.hasIpActivityToday.mockResolvedValue(true);
    mockedDb.getTopUpdates.mockResolvedValue([
      {
        id: 1,
        date: new Date("2025-11-12T00:00:00Z"),
        person: "Ops",
        content: "Line1\n\nLine2\n\nLine3",
        relevance: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.updates.top();
    expect(result[0].paragraphs).toEqual(["Line1", "Line2", "Line3"]);
    expect(result[0].person).toBe("Ops");
    expect(mockedDb.getTopUpdates).toHaveBeenCalledWith();
  });
});
