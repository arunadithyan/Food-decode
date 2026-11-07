/* Online OCR from the browser: the image goes to this site's /api/ocr/server, which forwards it to the configured engine. */
import { api } from "../../client/api";
import { isRGBA } from "../image";
import type { OcrEngine } from "../pipeline";
import { canvasBlob, toCanvas } from "./browser-image";

export function serverEngine(engineId = "rapidocr"): OcrEngine {
  return {
    id: engineId,
    label: "Online (FoodDecode OCR server)",
    remote: true,
    variants: "base-only",
    async recognize(img) {
      const c = toCanvas(img);
      const type = isRGBA(img) ? "image/jpeg" : "image/png";
      const blob = await canvasBlob(c, type, 0.92);
      const t = performance.now();
      const r = await api<{ lines: { text: string; conf: number | null }[] }>(`/api/ocr/server?engine=${encodeURIComponent(engineId)}`, { raw: blob, contentType: type });
      return { lines: r.lines, ms: Math.round(performance.now() - t) };
    },
  };
}
