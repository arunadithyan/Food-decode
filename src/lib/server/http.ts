/* Helpers for API route handlers: auth guard, CSRF origin check, JSON parsing, uniform errors. */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, SESSION_COOKIE, userForToken, type SessionUser } from "./auth";
import { ProfileValidationError } from "../profile";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Mutating requests must come from this site (defence in depth on top of SameSite=Lax cookies). */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "bad_origin", "Request origin could not be verified.");
  let oh: string;
  try {
    oh = new URL(origin).host;
  } catch {
    throw new HttpError(403, "bad_origin", "Request origin could not be verified.");
  }
  if (oh !== host) throw new HttpError(403, "bad_origin", "Cross-site requests are not allowed.");
}

export function requireUser(req: NextRequest): SessionUser {
  const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!u) throw new HttpError(401, "unauthorized", "Please log in.");
  return u;
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest, maxBytes = 64 * 1024): Promise<T> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new HttpError(415, "unsupported_media_type", "Send JSON.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "too_large", "Request is too large.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "bad_json", "Request body is not valid JSON.");
  }
}

/** Wrap a handler: same-origin check, uniform error responses, and no request bodies in logs. */
export function handler<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      if (e instanceof AuthError) return json({ error: e.code, message: e.message }, e.code === "rate_limited" ? 429 : e.code === "exists" ? 409 : e.code === "unauthorized" ? 401 : 400);
      if (e instanceof ProfileValidationError) return json({ error: "invalid_profile", message: "Some profile fields are not valid.", issues: e.issues }, 400);
      // Log only the error type and route — never the body, which may contain health data.
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} failed: ${(e as Error)?.name}`);
      // Stack traces only when explicitly debugging locally; they never include request bodies.
      if (process.env.FD_DEBUG_ERRORS === "1") console.error((e as Error)?.stack);
      return json({ error: "server_error", message: "Something went wrong on our side." }, 500);
    }
  };
}

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}
