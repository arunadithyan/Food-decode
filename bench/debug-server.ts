/* Debug helper: npx tsx bench/debug-server.ts <image file>... — prints RapidOCR lines (base variant) and parsed fields. Needs the OCR service. */
import sharp from "sharp"; import path from "node:path";
import { basePrep } from "../src/lib/ocr/image";
import { parseLabel } from "../src/lib/ocr/parser";
const ROOT = path.resolve(__dirname, "..");
(async () => {
  for (const file of process.argv.slice(2)) {
    const { data, info } = await sharp(path.join(ROOT, "bench/images", file)).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const g = basePrep({ width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) });
    const png = await sharp(Buffer.from(g.data), { raw: { width: g.width, height: g.height, channels: 1 } }).png().toBuffer();
    const r = await fetch((process.env.OCR_SERVICE_URL || "http://127.0.0.1:8765") + "/ocr", { method: "POST", body: new Uint8Array(png), headers: { "Content-Type": "image/png" } });
    const j = (await r.json()) as { lines: { text: string; conf: number }[] };
    console.log("=====", file); console.log(j.lines.map((l) => l.text).join("\n"));
    const p = parseLabel(j.lines);
    console.log("cols", p.columns, p.basisDetected, "serving", p.servingSize, Object.fromEntries(Object.entries(p.fields).map(([k, f]) => [k, [f!.per100, f!.perServing]])));
  }
})();
