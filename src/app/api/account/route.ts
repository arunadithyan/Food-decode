import { NextRequest } from "next/server";
import { checkLogin, cookieOptions, SESSION_COOKIE } from "@/lib/server/auth";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { deleteAccount } from "@/lib/server/repo";

/** Permanently deletes the account and everything linked to it. Requires the password again. */
export const DELETE = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const b = await readJson<{ password?: unknown; confirm?: unknown }>(req);
  if (b.confirm !== "DELETE" || typeof b.password !== "string") throw new HttpError(400, "confirm_required", "Type DELETE and your password to confirm.");
  try {
    await checkLogin(user.username, b.password);
  } catch {
    throw new HttpError(403, "wrong_password", "That password is not correct.");
  }
  deleteAccount(user.id);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions());
  return res;
});
