import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

/**
 * Authentication Test Suite
 * Tests authentication flows, role-based access control, and session management.
 */

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * Helper function to create authenticated context for testing
 */
function createAuthContext(role: 'user' | 'admin' | 'super_admin' = 'user'): { 
  ctx: TrpcContext; 
  clearedCookies: CookieCall[] 
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "google",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "192.168.1.100",
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

/**
 * Helper function to create unauthenticated context
 */
function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      ip: "192.168.1.100",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => { },
    } as unknown as TrpcContext["res"],
  };
}

describe("Authentication", () => {
  describe("auth.me", () => {
    it("returns user when authenticated", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.email).toBe("test@example.com");
      expect(result?.role).toBe("user");
    });

    it("returns null when not authenticated", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });

  describe("auth.logout", () => {
    it("clears session cookie and reports success", async () => {
      const { ctx, clearedCookies } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
      expect(clearedCookies[0]?.options).toMatchObject({
        maxAge: -1,
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      });
    });

    it("works for unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
    });
  });
});

describe("Role-Based Access Control", () => {
  describe("admin.getFacilities", () => {
    it("allows admin access", async () => {
      const { ctx } = createAuthContext('admin');
      const caller = appRouter.createCaller(ctx);

      // Should not throw
      await expect(caller.admin.getFacilities()).resolves.toBeDefined();
    });

    it("allows super_admin access", async () => {
      const { ctx } = createAuthContext('super_admin');
      const caller = appRouter.createCaller(ctx);

      // Should not throw
      await expect(caller.admin.getFacilities()).resolves.toBeDefined();
    });

    it("denies regular user access", async () => {
      const { ctx } = createAuthContext('user');
      const caller = appRouter.createCaller(ctx);

      await expect(caller.admin.getFacilities()).rejects.toThrow("Admin access required");
    });

    it("denies unauthenticated access", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.admin.getFacilities()).rejects.toThrow();
    });
  });

  describe("admin.assignAdmin", () => {
    it("allows super_admin to assign admins", async () => {
      const { ctx } = createAuthContext('super_admin');
      const caller = appRouter.createCaller(ctx);

      // Should succeed (database is available in test environment)
      const result = await caller.admin.assignAdmin({ userId: 2, facilityId: 1 });
      expect(result).toEqual({ success: true });
    });

    it("denies regular admin from assigning admins", async () => {
      const { ctx } = createAuthContext('admin');
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.admin.assignAdmin({ userId: 2, facilityId: 1 })
      ).rejects.toThrow("Super admin access required");
    });

    it("denies regular user from assigning admins", async () => {
      const { ctx } = createAuthContext('user');
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.admin.assignAdmin({ userId: 2, facilityId: 1 })
      ).rejects.toThrow();
    });
  });
});

describe("Public Endpoints", () => {
  describe("facilities.getAll", () => {
    it("allows unauthenticated access", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw
      await expect(caller.facilities.getAll()).resolves.toBeDefined();
    });

    it("allows authenticated access", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw
      await expect(caller.facilities.getAll()).resolves.toBeDefined();
    });
  });

  describe("questions.getById", () => {
    it("allows unauthenticated access", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      // Should throw NOT_FOUND (expected), not UNAUTHORIZED
      await expect(
        caller.questions.getById({ id: 999 })
      ).rejects.toThrow("Question not found");
    });
  });
});
