import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    hasIpActivityToday: vi.fn(),
    getLatestUpdates: vi.fn(),
    getUpdatesByQuestion: vi.fn(),
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
    expect(mockedDb.getLatestUpdates).not.toHaveBeenCalled();
  });

  it("returns paragraphs when allowed", async () => {
    mockedDb.hasIpActivityToday.mockResolvedValue(true);
    mockedDb.getLatestUpdates.mockResolvedValue([
      {
        id: 1,
        date: new Date("2025-11-12T00:00:00Z"),
        person: "Ops",
        content: "Line1\n\nLine2\n\nLine3",
        relevance: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.updates.top();
    expect(result[0].paragraphs).toEqual(["Line1", "Line2", "Line3"]);
    expect(result[0].person).toBe("Ops");
    expect(result[0].questionId).toBe(42);
    expect(mockedDb.getLatestUpdates).toHaveBeenCalledWith();
  });

  it("returns scoped updates by question id", async () => {
    mockedDb.getUpdatesByQuestion.mockResolvedValue([
      {
        id: 7,
        date: new Date("2025-12-01T10:00:00Z"),
        person: "Safety",
        content: "ParaA\n\nParaB",
        relevance: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.updates.byQuestion({ questionId: 15, limit: 5 });
    expect(result[0].questionId).toBe(15);
    expect(result[0].paragraphs).toEqual(["ParaA", "ParaB"]);
    expect(mockedDb.getUpdatesByQuestion).toHaveBeenCalledWith(15, 5);
  });

  it("returns latest updates without gating for landing page", async () => {
    mockedDb.getLatestUpdates.mockResolvedValue([
      {
        id: 3,
        date: new Date("2025-12-20T10:00:00Z"),
        person: "Comms",
        content: "Only para",
        relevance: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.updates.latest({ limit: 3 });
    expect(result[0].questionId).toBeNull();
    expect(result[0].paragraphs).toEqual(["Only para"]);
    expect(mockedDb.getLatestUpdates).toHaveBeenCalledWith(3);
  });
});
