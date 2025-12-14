import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getNormalizedIpFromRequest } from "./ip";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * Create tRPC context for each request
 * 
 * This runs before every tRPC procedure call
 * Extracts JWT from cookie, verifies it, and loads user from database
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    ipAddress: getNormalizedIpFromRequest(opts.req),
    userAgent: opts.req.headers["user-agent"] ?? null,
  };
}
