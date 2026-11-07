import { NextRequest } from "next/server";
import { cookieOptions, createSession, createUser, rateLimit, SESSION_COOKIE, validateCredentials } from "@/lib/server/auth";
import { clientIp, handler, HttpError, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: NextRequest) => {
  const body = await readJson<{ username?: unknown; password?: unknown; acceptTerms?: unknown }>(req);
  rateLimit(`register:${clientIp(req)}`, Number(process.env.FD_REGISTER_LIMIT) || 10);
  if (body.acceptTerms !== true) throw new HttpError(400, "terms_required", "Please confirm you have read how FoodDecode handles your data.");
  const { username, password } = validateCredentials(body.username, body.password);
  const user = await createUser(username, password);
  const { token, expires } = createSession(user.id);
  const res = json({ user }, 201);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expires));
  return res;
});
