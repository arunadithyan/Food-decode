/* Server-side OCR adapters. Keys and service URLs stay here; the browser only talks to /api/ocr/server. */
import "server-only";
import { HttpError } from "./http";

export interface ServerOcrResult { engine: string; ms: number; lines: { text: string; conf: number | null }[] }
export interface EngineInfo { id: string; label: string; available: boolean }

async function rapidAvailable(): Promise<boolean> {
  const url = process.env.OCR_SERVICE_URL;
  if (!url) return false;
  try {
    return (await fetch(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(1500), cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

export async function serverOcrEngines(): Promise<EngineInfo[]> {
  return [
    { id: "rapidocr", label: "FoodDecode OCR server (RapidOCR / PaddleOCR models)", available: await rapidAvailable() },
    ...(process.env.GOOGLE_VISION_API_KEY ? [{ id: "google-vision", label: "Google Cloud Vision", available: true }] : []),
  ];
}

export async function runServerOcr(image: Uint8Array, contentType: string, engine = "rapidocr"): Promise<ServerOcrResult> {
  if (engine === "google-vision") return googleVision(image);
  const url = process.env.OCR_SERVICE_URL;
  if (!url) throw new HttpError(503, "ocr_unavailable", "Online OCR is not configured on this server. Use on-device OCR.");
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/ocr`, {
      method: "POST",
      body: new Blob([image as Uint8Array<ArrayBuffer>], { type: contentType }),
      headers: { "Content-Type": contentType, "X-OCR-Token": process.env.OCR_SERVICE_TOKEN || "" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new HttpError(503, "ocr_unavailable", "The online OCR service can't be reached. Use on-device OCR.");
  }
  if (!res.ok) throw new HttpError(502, "ocr_failed", "The online OCR service could not read this image.");
  const j = (await res.json()) as ServerOcrResult;
  return { engine: "rapidocr", ms: j.ms, lines: (j.lines || []).map((l) => ({ text: String(l.text), conf: typeof l.conf === "number" ? l.conf : null })) };
}

/**
 * Google Cloud Vision adapter (DOCUMENT_TEXT_DETECTION). Included as an optional alternative; it was NOT
 * exercised in FoodDecode's test runs because no API key was available. Lines come from the full text.
 */
async function googleVision(image: Uint8Array): Promise<ServerOcrResult> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) throw new HttpError(503, "ocr_unavailable", "Google Vision is not configured.");
  const t = Date.now();
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: Buffer.from(image).toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["en"] } }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new HttpError(502, "ocr_failed", "Google Vision could not read this image.");
  const j = (await res.json()) as { responses?: { fullTextAnnotation?: { text?: string } }[] };
  const text = j.responses?.[0]?.fullTextAnnotation?.text || "";
  return { engine: "google-vision", ms: Date.now() - t, lines: text.split("\n").filter(Boolean).map((l) => ({ text: l, conf: null })) };
}
