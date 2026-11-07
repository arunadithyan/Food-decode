import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { deleteProfile, getConsents, getProfile, saveProfile, setConsent } from "@/lib/server/repo";

/** The health profile: encrypted at rest, readable only by its owner. */
export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const p = getProfile(user.id);
  return json({ profile: p?.profile ?? null, updatedAt: p?.updatedAt ?? null, consent: getConsents(user.id).health_data });
});

export const PUT = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const body = await readJson<{ profile?: unknown; consent?: unknown; summary?: unknown }>(req);
  if (body.consent === true) setConsent(user.id, "health_data", true);
  if (!getConsents(user.id).health_data) throw new HttpError(403, "consent_required", "Please agree to FoodDecode storing your health information before saving it.");
  const summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : "Profile updated";
  const profile = saveProfile(user.id, body.profile, summary);
  return json({ profile });
});

export const DELETE = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  deleteProfile(user.id);
  return json({ ok: true });
});
