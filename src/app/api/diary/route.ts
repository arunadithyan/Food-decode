import { NextRequest } from "next/server";
import { addDays, DiaryValidationError, isDay, validateEntry } from "@/lib/diary";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { addFood, getConsents, getDiarySettings, listFood } from "@/lib/server/repo";

/** Server's idea of "today" is only used to bound dates; the client sends its local day. */
const serverToday = () => new Date().toISOString().slice(0, 10);

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const to = req.nextUrl.searchParams.get("to");
  const from = req.nextUrl.searchParams.get("from");
  const t = isDay(to) ? to : addDays(serverToday(), 1);
  const f = isDay(from) ? from : addDays(t, -400);
  if (f > t) throw new HttpError(400, "invalid_range", "from must be before to.");
  return json({ enabled: getConsents(user.id).food_log, settings: getDiarySettings(user.id), entries: getConsents(user.id).food_log ? listFood(user.id, f, t) : [] });
});

/** Log something the user ate. Needs the food-diary consent (off by default). */
export const POST = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  if (!getConsents(user.id).food_log) throw new HttpError(403, "consent_required", "Turn on the food diary first.");
  try {
    return json({ entry: addFood(user.id, validateEntry(await readJson(req), serverToday())) }, 201);
  } catch (e) {
    if (e instanceof DiaryValidationError) throw new HttpError(400, "invalid_entry", e.issues.join("; "));
    throw e;
  }
});
