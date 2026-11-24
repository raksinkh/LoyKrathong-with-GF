import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "lk_session";

const ROOM_ID_RE = /^[0-9a-f]{32}$/;
const TOKEN_HEX_RE = /^[0-9a-f]{64}$/;

export function generateRoomId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateParticipantId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateSecretToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function isValidRoomId(value: unknown): value is string {
  return typeof value === "string" && ROOM_ID_RE.test(value);
}

export function isValidTokenHex(value: unknown): value is string {
  return typeof value === "string" && TOKEN_HEX_RE.test(value);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (!TOKEN_HEX_RE.test(a) || !TOKEN_HEX_RE.test(b)) {
    return false;
  }
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  sessionToken: string,
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export function getSessionCookie(request: NextRequest): string | null {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw || !isValidTokenHex(raw)) {
    return null;
  }
  return raw;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "local";
}

function getExpectedHost(request: NextRequest): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return host || null;
}

export function validateCsrf(request: NextRequest): string | null {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return "Invalid content type";
  }

  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "fetch") {
    return "Missing required request header";
  }

  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none"
  ) {
    return "Cross-site request rejected";
  }

  const expectedHost = getExpectedHost(request);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (expectedHost && originHost !== expectedHost) {
        return "Origin mismatch";
      }
    } catch {
      return "Invalid origin";
    }
  } else {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererHost = new URL(referer).host.toLowerCase();
        if (expectedHost && refererHost !== expectedHost) {
          return "Referer mismatch";
        }
      } catch {
        return "Invalid referer";
      }
    }
  }

  return null;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 4096;
const globalRateStore = globalThis as unknown as {
  __moonlightRateBuckets?: Map<string, RateBucket>;
};
const buckets = (globalRateStore.__moonlightRateBuckets ??= new Map());

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (existing && existing.resetAt > now) {
    if (existing.count >= limit) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  if (buckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
  }

  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

export function jsonNoStore(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
