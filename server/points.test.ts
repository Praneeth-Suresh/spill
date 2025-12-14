import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getQuestionById: vi.fn(),
    submitResponse: vi.fn(),
    incrementPointsByIp: vi.fn(),
    incrementUserPoints: vi.fn(),
    getPointsByIp: vi.fn(),
    getUserByOpenId: vi.fn(),
  } satisfies Partial<typeof actual>;
});

vi.mock("./branching", () => ({
  evaluateNextQuestion: vi.fn(async () => ({ nextQuestionId: null, redirectToHome: true })),
}));

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

const question = {
  question: {
    id: 1,
    facilityId: 1,
    type: "text" as const,
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
    pointsAwarded: 300,
  },
  options: [],
};

describe("Points awarding on submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_DEFAULT_POINTS = "0";

    mockedDb.submitResponse.mockResolvedValue(101);
    mockedDb.getQuestionById.mockResolvedValue(question as any);
  });

  it("awards points to IP when user is anonymous", async () => {
    let ipPoints = 500;
    mockedDb.getPointsByIp.mockImplementation(async () => ({ id: 1, ipAddress: "::ffff:192.168.0.10", points: ipPoints, createdAt: new Date(), updatedAt: new Date() }));
    mockedDb.incrementPointsByIp.mockImplementation(async (_ip, delta) => {
      ipPoints += delta;
    });

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.questions.submit({
      questionId: 1,
      facilityId: 1,
      answers: [{ textAnswer: "Hello" }],
    });

    expect(mockedDb.incrementPointsByIp).toHaveBeenCalledWith("::ffff:192.168.0.10", 300);
    expect(mockedDb.incrementUserPoints).not.toHaveBeenCalled();
    expect(result.points.points).toBe(ipPoints);
    expect(result.points.source).toBe("ip");
  });

  it("awards points to both IP and logged-in user", async () => {
    let ipPoints = 200;
    let userPoints = 700;

    mockedDb.incrementPointsByIp.mockImplementation(async (_ip, delta) => { ipPoints += delta; });
    mockedDb.incrementUserPoints.mockImplementation(async (_userId, delta) => { userPoints += delta; });
    mockedDb.getPointsByIp.mockImplementation(async () => ({ id: 1, ipAddress: "::ffff:192.168.0.10", points: ipPoints, createdAt: new Date(), updatedAt: new Date() }));
    mockedDb.getUserByOpenId.mockImplementation(async () => ({
      id: 1,
      openId: "user-open-id",
      name: "User",
      email: "user@test.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      points: userPoints,
    } as any));

    const ctx = createContext({
      user: {
        id: 1,
        openId: "user-open-id",
        email: "user@test.com",
        name: "User",
        loginMethod: "google",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        points: userPoints,
      },
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.questions.submit({
      questionId: 1,
      facilityId: 1,
      answers: [{ textAnswer: "Logged in" }],
    });

    expect(mockedDb.incrementPointsByIp).toHaveBeenCalledWith("::ffff:192.168.0.10", 300);
    expect(mockedDb.incrementUserPoints).toHaveBeenCalledWith(1, 300);
    expect(result.points.source).toBe("user");
    expect(result.points.points).toBe(userPoints);
  });

  it("warns when IP is missing and still updates user", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let userPoints = 400;

    mockedDb.incrementUserPoints.mockImplementation(async (_id, delta) => { userPoints += delta; });
    mockedDb.getUserByOpenId.mockImplementation(async () => ({
      id: 2,
      openId: "user-no-ip",
      name: "User",
      email: "user@test.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      points: userPoints,
    } as any));

    const ctx = createContext({
      user: {
        id: 2,
        openId: "user-no-ip",
        email: "user@test.com",
        name: "User",
        loginMethod: "google",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        points: userPoints,
      },
      ipAddress: null,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.questions.submit({
      questionId: 1,
      facilityId: 1,
      answers: [{ textAnswer: "No ip" }],
    });

    expect(mockedDb.incrementPointsByIp).not.toHaveBeenCalled();
    expect(mockedDb.incrementUserPoints).toHaveBeenCalledWith(2, 300);
    expect(warnSpy).toHaveBeenCalledWith("IP address not found: not updating points");
    expect(result.points.source).toBe("user");
    expect(result.points.points).toBe(userPoints);

    warnSpy.mockRestore();
  });
});
