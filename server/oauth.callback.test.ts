import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "../shared/const";


const upsertUser = vi.hoisted(() => vi.fn(async () => {}));
const getUserByEmail = vi.hoisted(() => vi.fn(async () => undefined));
const updateUserById = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./db", () => ({
  upsertUser,
  getUserByEmail,
  updateUserById,
}));

// Import after mocks
import { oauthCallbackHandler } from "./_core/oauth";

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: vi.fn(async (_code: string) => ({
      access_token: "mock-access-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
      id_token: "mock-id-token",
    })),
    getUserInfo: vi.fn(async (_accessToken: string) => ({
      sub: "google-sub-123",
      name: "Test User",
      email: "test@example.com",
      picture: "https://example.com/avatar.png",
    })),
    createSessionToken: vi.fn(async (_sub: string, _opts?: any) => "session.jwt.token"),
  },
}));

function mockReq(query: Record<string, string> = {}): Request {
  return {
    query,
    protocol: "https",
    headers: {},
  } as unknown as Request;
}

function mockRes() {
  const res: Partial<Response> & {
    _status?: number;
    _json?: any;
    _cookie?: { name: string; value: string; options: any };
    _redirect?: { status: number; url: string };
  } = {};
  res.status = (code: number) => {
    res._status = code;
    return res as Response;
  };
  res.json = (payload: any) => {
    res._json = payload;
    return res as Response;
  };
  (res as any).cookie = (name: string, value: any, options?: any) => {
    res._cookie = { name, value, options };
    return res as Response;
  };
  (res as any).redirect = (arg1: any, arg2?: any) => {
    const status = typeof arg2 === "string" ? arg1 : 302;
    const url = typeof arg2 === "string" ? arg2 : arg1;
    res._redirect = { status, url };
    return res as unknown as Response;
  };
  return res as Response & any;
}


describe("OAuth Callback (Google)", () => {
  beforeEach(() => {
    upsertUser.mockClear();
    getUserByEmail.mockClear();
    updateUserById.mockClear();
  });

  it("creates new user if not found by email", async () => {
    getUserByEmail.mockResolvedValue(undefined);
    const req = mockReq({ code: "abc123" });
    const res = mockRes();

    await oauthCallbackHandler(req, res);

    expect(getUserByEmail).toHaveBeenCalledWith("test@example.com");
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google-sub-123",
        name: "Test User",
        email: "test@example.com",
        loginMethod: "google",
      })
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(res._cookie?.name).toBe(COOKIE_NAME);
    expect(res._redirect).toEqual({ status: 302, url: "/" });
  });

  it("updates existing user by email, does not change email or role", async () => {
    getUserByEmail.mockResolvedValue({ id: 42, email: "test@example.com", role: "admin" });
    const req = mockReq({ code: "abc123" });
    const res = mockRes();

    await oauthCallbackHandler(req, res);

    expect(getUserByEmail).toHaveBeenCalledWith("test@example.com");
    expect(updateUserById).toHaveBeenCalledWith(42, expect.objectContaining({
      openId: "google-sub-123",
      name: "Test User",
      loginMethod: "google",
      lastSignedIn: expect.any(Date),
    }));
    expect(upsertUser).not.toHaveBeenCalled();
    expect(res._cookie?.name).toBe(COOKIE_NAME);
    expect(res._redirect).toEqual({ status: 302, url: "/" });
  });

  it("returns 400 when code is missing", async () => {
    const req = mockReq();
    const res = mockRes();

    await oauthCallbackHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/Missing authorization code/);
  });

  it("returns 400 when error param present", async () => {
    const req = mockReq({ error: "access_denied" });
    const res = mockRes();

    await oauthCallbackHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/OAuth error: access_denied/);
  });
});
