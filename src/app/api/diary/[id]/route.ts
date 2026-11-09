import { NextRequest } from "next/server";
import { DiaryValidationError, validateEntry } from "@/lib/diary";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { deleteFood, getFood, updateFood } from "@/lib/server/repo";

type Ctx = { params: Promise<{ id: string }> };

/** Edit an entry (e.g. change the amount or meal). */
export const PUT = handler<Ctx>(async (req: NextRequest, { params }) => {
  const user = requireUser(req);
  const id = (await params).id;
  if (!getFood(user.id, id)) throw new HttpError(404, "not_found", "Entry not found.");
  try {
    const e = validateEntry(await readJson(req), new Date().toISOString().slice(0, 10));
    updateFood(user.id, id, e);
    return json({ entry: getFood(user.id, id) });
  } catch (e) {
    if (e instanceof DiaryValidationError) throw new HttpError(400, "invalid_entry", e.issues.join("; "));
    throw e;
  }
});

export const DELETE = handler<Ctx>(async (req: NextRequest, { params }) => {
  const user = requireUser(req);
  if (!deleteFood(user.id, (await params).id)) throw new HttpError(404, "not_found", "Entry not found.");
  return json({ ok: true });
});
