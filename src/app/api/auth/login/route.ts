import { NextRequest } from "next/server";
import { checkLogin, cookieOptions, createSession, rateLimit, resetRateLimit, SESSION_COOKIE } from "@/lib/server/auth";
import { clientIp, handler, HttpError, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: NextRequest) => {
  const body = await readJson<{ username?: unknown; password?: unknown }>(req);
  if (typeof body.username !== "string" || typeof body.password !== "string" || body.password.length > 200) throw new HttpError(400, "invalid", "Enter your username and password.");
  const key = `login:${clientIp(req)}:${body.username.toLowerCase()}`;
  rateLimit(key, 8);
  const user = await checkLogin(body.username, body.password);
  resetRateLimit(key);
  const { token, expires } = createSession(user.id);
  const res = json({ user });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expires));
  return res;
});
