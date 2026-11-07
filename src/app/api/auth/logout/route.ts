import { NextRequest } from "next/server";
import { cookieOptions, destroySession, SESSION_COOKIE } from "@/lib/server/auth";
import { handler, json } from "@/lib/server/http";

export const POST = handler(async (req: NextRequest) => {
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions());
  return res;
});
