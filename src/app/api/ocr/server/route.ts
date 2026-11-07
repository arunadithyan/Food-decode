import { NextRequest } from "next/server";
import { handler, HttpError, json, requireUser } from "@/lib/server/http";
import { getConsents } from "@/lib/server/repo";
import { serverOcrEngines, runServerOcr } from "@/lib/server/ocr";

/** Which online OCR engines are configured (the browser never sees URLs or keys). */
export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ engines: await serverOcrEngines(), consent: getConsents(user.id).cloud_ocr });
});

/**
 * Online OCR: the label image is forwarded to the configured engine and the text lines are returned.
 * Requires login and the user's explicit consent. The image is not stored or logged.
 */
export const POST = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  if (!getConsents(user.id).cloud_ocr) throw new HttpError(403, "consent_required", "Turn on online OCR in Privacy & Settings first. Your photo is only sent after you agree.");
  const ct = req.headers.get("content-type") || "";
  if (!/^image\/(png|jpeg|webp)$/.test(ct)) throw new HttpError(415, "unsupported_media_type", "Send a PNG, JPEG or WebP image.");
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) throw new HttpError(413, "too_large", "Images must be under 8 MB.");
  const engine = req.nextUrl.searchParams.get("engine") || undefined;
  const result = await runServerOcr(buf, ct, engine);
  return json(result);
});
