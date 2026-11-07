import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { addCorrection, listCorrections } from "@/lib/server/repo";

/** Users can report a wrong value in a product record. Reports are stored for review; they never change data automatically. */
export const POST = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const b = await readJson<{ productId?: unknown; field?: unknown; value?: unknown; note?: unknown }>(req);
  if (typeof b.productId !== "string" || typeof b.field !== "string" || typeof b.value !== "string" || !b.value.trim()) throw new HttpError(400, "invalid", "Say which value is wrong and what the label shows.");
  return json(addCorrection(user.id, { productId: b.productId, field: b.field, value: b.value, note: typeof b.note === "string" ? b.note : "" }), 201);
});

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ corrections: listCorrections(user.id) });
});
