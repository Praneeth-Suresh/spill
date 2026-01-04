import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getUserFacilities: vi.fn(),
    getAllQuestionsByFacility: vi.fn(),
  } satisfies Partial<typeof actual>;
});

import * as db from "./db";

const mockedDb = vi.mocked(db);

const createContext = (overrides: Partial<TrpcContext> = {}): TrpcContext => ({
  req: { headers: {}, protocol: "https" } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
  user: {
    id: 10,
    email: "admin@test.com",
    openId: "admin-open-id",
    name: "Admin",
    loginMethod: "google",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    points: 0,
  },
  ipAddress: "::1",
  userAgent: "vitest",
  ...overrides,
});

describe("admin.getFacilityQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedDb.getUserFacilities.mockResolvedValue([
      { id: 1, name: "Main", code: "MAIN", isActive: true } as any,
    ]);

    mockedDb.getAllQuestionsByFacility.mockResolvedValue([
      {
        id: 11,
        facilityId: 1,
        title: "Which movie do you want to watch?",
        description: null,
        type: "poll",
        displayOrder: 0,
        isActive: true,
        isRequired: true,
        allowMultiple: false,
        maxFileSize: null,
        allowedFileTypes: null,
        nextQuestionId: null,
        redirectToHome: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        pointsAwarded: 0,
      },
      {
        id: 12,
        facilityId: 1,
        title: "What should we improve?",
        description: "Share one thing",
        type: "text",
        displayOrder: 1,
        isActive: false,
        isRequired: true,
        allowMultiple: false,
        maxFileSize: null,
        allowedFileTypes: null,
        nextQuestionId: null,
        redirectToHome: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        pointsAwarded: 0,
      },
    ] as any);
  });

  it("returns questions when the admin can access the facility", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.admin.getFacilityQuestions({ facilityId: 1 });

    expect(mockedDb.getUserFacilities).toHaveBeenCalledWith(10, "admin");
    expect(mockedDb.getAllQuestionsByFacility).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(2);
    expect(result[0].title).toContain("movie");
  });

  it("blocks access to facilities the admin does not control", async () => {
    mockedDb.getUserFacilities.mockResolvedValueOnce([
      { id: 2, name: "Another", code: "ANR", isActive: true } as any,
    ]);

    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.admin.getFacilityQuestions({ facilityId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
