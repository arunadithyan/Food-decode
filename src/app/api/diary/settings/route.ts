import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { getDiarySettings, setDiarySettings } from "@/lib/server/repo";

/** The user's own daily calorie target (optional; null falls back to their profile limit or the label reference). */
export const PUT = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const b = await readJson<{ energyTargetKcal?: unknown }>(req);
  const v = b.energyTargetKcal;
  if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 800 || v > 6000)) throw new HttpError(400, "invalid", "Enter a daily target between 800 and 6,000 kcal, or clear it.");
  setDiarySettings(user.id, { energyTargetKcal: v === null ? null : Math.round(v as number) });
  return json({ settings: getDiarySettings(user.id) });
});
