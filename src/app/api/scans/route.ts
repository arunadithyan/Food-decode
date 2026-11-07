import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { addScan, clearScans, getConsents, listScans } from "@/lib/server/repo";
import { validateScanInput } from "@/lib/server/validators";

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ scans: listScans(user.id), enabled: getConsents(user.id).scan_history });
});

/** Saves a scan only when the user has switched scan history on (off by default). */
export const POST = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  if (!getConsents(user.id).scan_history) return json({ saved: false, reason: "history_off" });
  const body = await readJson(req, 256 * 1024);
  const rec = validateScanInput(body);
  if (!rec) throw new HttpError(400, "invalid_scan", "That scan could not be saved.");
  return json({ saved: true, scan: addScan(user.id, rec) }, 201);
});

export const DELETE = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  clearScans(user.id);
  return json({ ok: true });
});
