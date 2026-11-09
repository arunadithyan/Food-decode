/* Accounts and sessions. Session tokens live only in an HttpOnly cookie; the DB stores their SHA-256. */
import "server-only";
import { cookies } from "next/headers";
import { getDb, tx } from "./db";
import { hashPassword, newId, newToken, sha256, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "fd_session";
const SESSION_DAYS = 7;

export interface SessionUser { id: string; username: string }

export class AuthError extends Error {
  constructor(public code: "invalid" | "exists" | "weak" | "unauthorized" | "rate_limited", message: string) {
    super(message);
  }
}

export function validateCredentials(username: unknown, password: unknown): { username: string; password: string } {
  if (typeof username !== "string" || typeof password !== "string") throw new AuthError("invalid", "Enter a username and password.");
  const u = username.trim();
  if (!/^[A-Za-z0-9._@+-]{3,64}$/.test(u)) throw new AuthError("invalid", "Usernames are 3–64 characters: letters, numbers and . _ @ + -");
  if (password.length < 10) throw new AuthError("weak", "Use at least 10 characters for your password.");
  if (password.length > 200) throw new AuthError("weak", "That password is too long.");
  if (password.toLowerCase().includes(u.toLowerCase().split("@")[0]) && u.length >= 4) throw new AuthError("weak", "Your password shouldn't contain your username.");
  return { username: u, password };
}

export async function createUser(username: string, password: string): Promise<SessionUser> {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) throw new AuthError("exists", "That username is taken.");
  const id = newId();
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  tx((d) => {
    d.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(id, username, hash, now);
    d.prepare("INSERT INTO settings (user_id, language, updated_at) VALUES (?, 'en', ?)").run(id, now);
    // privacy-first defaults: nothing optional is switched on
    for (const kind of ["health_data", "cloud_ocr", "scan_history", "food_log"]) d.prepare("INSERT INTO consents (user_id, kind, granted, updated_at) VALUES (?, ?, 0, ?)").run(id, kind, now);
  });
  return { id, username };
}

// Uniform-time login failure: always run scrypt once, even for unknown usernames.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function checkLogin(username: string, password: string): Promise<SessionUser> {
  const row = getDb().prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(username.trim()) as
    | { id: string; username: string; password_hash: string }
    | undefined;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new AuthError("invalid", "Username or password is incorrect.");
  return { id: row.id, username: row.username };
}

export function createSession(userId: string): { token: string; expires: Date } {
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString());
  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha256(token), userId, now.toISOString(), expires.toISOString());
  return { token, expires };
}

export function userForToken(token: string | undefined): SessionUser | null {
  if (!token || token.length > 200) return null;
  const row = getDb()
    .prepare("SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?")
    .get(sha256(token)) as { id: string; username: string; expires_at: string } | undefined;
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return { id: row.id, username: row.username };
}

export function destroySession(token: string | undefined) {
  if (token) getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token));
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

export function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.FD_INSECURE_COOKIES !== "1",
    path: "/",
    ...(expires ? { expires } : { maxAge: 0 }),
  };
}

/* simple in-memory rate limiter for login/registration (per IP + username) */
const attempts = new Map<string, { n: number; until: number }>();
export function rateLimit(key: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { n: 1, until: now + windowMs });
    return;
  }
  a.n++;
  if (a.n > max) throw new AuthError("rate_limited", "Too many attempts. Please wait a few minutes and try again.");
}
export function resetRateLimit(key: string) {
  attempts.delete(key);
}
