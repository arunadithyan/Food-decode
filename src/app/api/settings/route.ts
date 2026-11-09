import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { clearFood, clearScans, getConsents, getSettings, setConsent, setLanguage } from "@/lib/server/repo";

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ settings: getSettings(user.id), consents: getConsents(user.id) });
});

export const PUT = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const b = await readJson<{ language?: unknown; consents?: Record<string, unknown> }>(req);
  if (b.language !== undefined) {
    if (!["en", "hi", "ta"].includes(String(b.language))) throw new HttpError(400, "invalid", "Unknown language.");
    setLanguage(user.id, b.language as "en" | "hi" | "ta");
  }
  for (const kind of ["cloud_ocr", "scan_history", "food_log"] as const) {
    const v = b.consents?.[kind];
    if (typeof v === "boolean") {
      setConsent(user.id, kind, v);
      if (kind === "scan_history" && !v) clearScans(user.id); // turning history off deletes it
      if (kind === "food_log" && !v) clearFood(user.id); // turning the food diary off deletes it
    }
  }
  // health_data consent is withdrawn by deleting the profile (DELETE /api/profile), so it is not toggled here
  return json({ settings: getSettings(user.id), consents: getConsents(user.id) });
});
