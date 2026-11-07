import { NextRequest } from "next/server";
import { handler, json, requireUser } from "@/lib/server/http";
import { getConsents, getProfile, getSettings } from "@/lib/server/repo";

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const p = getProfile(user.id);
  return json({ user, settings: getSettings(user.id), consents: getConsents(user.id), hasProfile: !!p, profileUpdatedAt: p?.updatedAt ?? null });
});
