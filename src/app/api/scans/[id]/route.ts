import { NextRequest } from "next/server";
import { handler, HttpError, json, requireUser } from "@/lib/server/http";
import { deleteScan, getScan } from "@/lib/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req: NextRequest, { params }) => {
  const user = requireUser(req);
  const scan = getScan(user.id, (await params).id);
  if (!scan) throw new HttpError(404, "not_found", "Scan not found.");
  return json({ scan });
});

export const DELETE = handler<Ctx>(async (req: NextRequest, { params }) => {
  const user = requireUser(req);
  if (!deleteScan(user.id, (await params).id)) throw new HttpError(404, "not_found", "Scan not found.");
  return json({ ok: true });
});
