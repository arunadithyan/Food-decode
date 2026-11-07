/* On-device OCR: Tesseract.js running in a Web Worker, with all files served from this site (/ocr). Works offline once cached. */
import { createWorker, type Worker } from "tesseract.js";
import type { OcrEngine } from "../pipeline";
import { toCanvas } from "./browser-image";

let worker: Promise<Worker> | null = null;
let logger: ((m: { status: string; progress: number }) => void) | null = null;

function getWorker() {
  if (!worker) {
    worker = createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      gzip: true,
      logger: (m) => logger?.(m),
    }).catch((e) => {
      worker = null;
      throw e;
    });
  }
  return worker;
}

export function tesseractEngine(onLog?: (m: { status: string; progress: number }) => void): OcrEngine {
  logger = onLog ?? null;
  return {
    id: "tesseract",
    label: "On-device (Tesseract)",
    remote: false,
    variants: "all",
    async recognize(img) {
      const w = await getWorker();
      const t = performance.now();
      const { data } = await w.recognize(toCanvas(img));
      return { lines: (data.lines || []).map((l) => ({ text: l.text.trim(), conf: l.confidence })), ms: Math.round(performance.now() - t) };
    },
  };
}

/** Download and cache the on-device OCR files so scanning works offline. */
export async function warmUpTesseract() {
  await getWorker();
}
