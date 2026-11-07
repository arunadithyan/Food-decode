import { NextRequest } from "next/server";
import { handler, HttpError, json, requireUser } from "@/lib/server/http";
import { deleteComparison } from "@/lib/server/repo";

export const DELETE = handler<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params }) => {
  const user = requireUser(req);
  if (!deleteComparison(user.id, (await params).id)) throw new HttpError(404, "not_found", "Comparison not found.");
  return json({ ok: true });
});
