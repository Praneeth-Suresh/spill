export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate Google OAuth login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  // Optional but recommended: random state for CSRF protection
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  try { sessionStorage.setItem("oauth_state", state); } catch {}

  const url = new URL(googleAuthUrl);
  url.searchParams.set("client_id", clientId ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  // Ensure refresh token on first consent and better UX
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
};

// Per Google OAuth docs for Web server apps:
// - Use response_type=code (Authorization Code flow)
// - Exchange code on the server for tokens
// - Use access_token with the UserInfo endpoint or decode id_token