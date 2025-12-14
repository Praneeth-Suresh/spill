import ipaddr from "ipaddr.js";
import type { Request } from "express";

const normalize = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const candidate = raw.split(",")[0]?.trim();
  if (!candidate) return null;

  try {
    const parsed = ipaddr.parse(candidate);
    if (parsed.kind() === "ipv4") {
      return parsed.toIPv4MappedAddress().toNormalizedString();
    }
    return parsed.toNormalizedString();
  } catch {
    return null;
  }
};

/**
 * Extract and normalize an IP address from the incoming request, preferring X-Forwarded-For.
 * IPv4 addresses are stored as IPv4-mapped IPv6 strings for consistency.
 */
export function getNormalizedIpFromRequest(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  const ipFromForwarded = normalize(forwardedValue);
  if (ipFromForwarded) return ipFromForwarded;

  const ipFromReq = normalize(req.ip);
  if (ipFromReq) return ipFromReq;

  return null;
}
