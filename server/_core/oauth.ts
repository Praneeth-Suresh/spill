import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export async function oauthCallbackHandler(req: Request, res: Response) {
  const errorParam = getQueryParam(req, "error");
  if (errorParam) {
    res.status(400).json({ error: `OAuth error: ${errorParam}` });
    return;
  }

  const code = getQueryParam(req, "code");
  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  try {
    // 1) Exchange authorization code for tokens
    const tokenResponse = await sdk.exchangeCodeForToken(code);

    // 2) Retrieve user info from Google UserInfo endpoint
    const userInfo = await sdk.getUserInfo(tokenResponse.access_token);

    // Google OIDC unique user id is in `sub`
    if (!userInfo.sub) {
      res.status(400).json({ error: "Missing 'sub' in Google user info" });
      return;
    }

    // 3) Upsert local user record
    await db.upsertUser({
      openId: userInfo.sub,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: "google",
      lastSignedIn: new Date(),
    });

    // 4) Create session token and set cookie
    const sessionToken = await sdk.createSessionToken(userInfo.sub, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS };
    console.log("Setting cookie with options:", cookieOptions);
    res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

    // 5) Redirect to app root (or consider preserving original state/redirect)
    res.redirect(302, "/");
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", oauthCallbackHandler);
}
