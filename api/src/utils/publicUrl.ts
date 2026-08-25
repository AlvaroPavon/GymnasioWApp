import type { Request } from "express";
import { env } from "../config/env.js";

function isAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function requestBaseUrl(req: Request) {
  if (req.protocol !== "http" && req.protocol !== "https") return undefined;

  const host = req.host;
  if (!host) return undefined;

  try {
    const parsed = new URL(`${req.protocol}://${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** Returns the sole origin trusted to represent API-owned absolute asset URLs. */
export function trustedPublicOrigin(req: Request) {
  const baseUrl = env.PUBLIC_BASE_URL ? new URL(env.PUBLIC_BASE_URL) : requestBaseUrl(req);
  return baseUrl?.origin;
}

/**
 * Converts an API-owned relative asset path into an absolute HTTP(S) URL.
 * PUBLIC_BASE_URL is preferred in production so reverse proxies cannot affect
 * generated links; request origin remains a safe development/test fallback.
 */
export function absolutePublicUrl(req: Request, value?: string | null) {
  if (!value) return null;
  if (isAbsoluteHttpUrl(value)) return value;

  const normalizedPath = `/${value.replace(/^\/+/, "")}`;
  const publicOrigin = trustedPublicOrigin(req);
  if (!publicOrigin) return normalizedPath;

  const result = new URL(publicOrigin);
  result.pathname = normalizedPath;
  return result.toString();
}
