/*
 * OCR benchmark: FoodDecode v1 (prototype) vs v2 on-device (Tesseract + preprocessing variants + new parser)
 * vs v2 server (RapidOCR / PaddleOCR models). Also runs each v2 preprocessing variant on its own, which is
 * the evidence used to choose the variant order in src/lib/ocr/image.ts.
 *
 *   npm run bench:ocr                    # all engines (server engine needs the OCR service on :8765)
 *   npm run bench:ocr -- --no-server     # skip the server engine
 *   npm run bench:ocr -- --only=sample   # labels whose file name contains "sample"
 *
 * Output: bench/results.json and bench/RESULTS.md
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { basePrep, variantsFor, toGray, resizeGray, downscaleGray, isRGBA, type Gray, type RGBA } from "../src/lib/ocr/image";
import { ocrImage, type OcrEngine } from "../src/lib/ocr/pipeline";
import { parseLabel, type OcrLine, type ParsedLabel } from "../src/lib/ocr/parser";

const ROOT = path.resolve(__dirname, "..");
const require_ = createRequire(__filename);
const v1 = require_("./legacy/v1-parser.cjs") as { parseLabel(t: string): { fields: Record<string, { value: number }>; servingSize: number | null; basis: string } };

interface GT {
  file: string; product: string; condition: string; unit: "g" | "ml"; basis: "100" | "serving";
  servingSize: number | null; values: Record<string, number>; text: string;
}
const gt: GT[] = JSON.parse(fs.readFileSync(path.join(ROOT, "bench/ground-truth.json"), "utf8")).labels;
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const noServer = args.includes("--no-server");
const SERVER = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8765";

/* ---------------- metrics ---------------- */
function lev<T>(a: T[], b: T[]): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
const normLine = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** Line-matched CER/WER: each ground-truth line is compared with its closest OCR line. */
function cerWer(gtText: string, ocrText: string) {
  const gl = gtText.split("\n").map(normLine).filter(Boolean);
  const ol = ocrText.split("\n").map(normLine).filter(Boolean);
  let ce = 0, cn = 0, we = 0, wn = 0;
  for (const g of gl) {
    let bestC = g.length, bestW = g.split(" ").length;
    for (const o of ol) {
      const c = lev([...g], [...o]);
      if (c < bestC) { bestC = c; bestW = lev(g.split(" "), o.split(" ")); }
    }
    ce += bestC; cn += g.length; we += bestW; wn += g.split(" ").length;
  }
  return { cer: cn ? ce / cn : 0, wer: wn ? we / wn : 0 };
}
const close = (a: number | null | undefined, b: number) => a != null && Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.005);

interface Score { fieldsCorrect: number; fieldsTotal: number; fieldsPredicted: number; wrong: string[]; unitOk: number; unitTotal: number; servingOk: boolean | null; cer: number; wer: number; ms: number }

function scoreValues(g: GT, pred: Record<string, number | null>, serving: number | null, text: string, ms: number): Score {
  let fc = 0, fp = 0, uo = 0, ut = 0;
  const wrong: string[] = [];
  for (const [k, v] of Object.entries(g.values)) {
    const p = pred[k];
    if (p != null) fp++;
    if (close(p, v)) fc++;
    else wrong.push(`${k}: ${p ?? "—"} (truth ${v})`);
    if ((k === "sodiumMg" || k === "energyKcal") && p != null && v > 0) { ut++; if (p / v > 0.5 && p / v < 2) uo++; }
  }
  return { fieldsCorrect: fc, fieldsTotal: Object.keys(g.values).length, fieldsPredicted: fp, wrong, unitOk: uo, unitTotal: ut, servingOk: g.servingSize == null ? null : close(serving, g.servingSize), ...cerWer(g.text, text), ms };
}
const v2values = (g: GT, p: ParsedLabel) => Object.fromEntries(Object.keys(g.values).map((k) => [k, (g.basis === "100" ? p.fields[k as keyof ParsedLabel["fields"]]?.per100 : p.fields[k as keyof ParsedLabel["fields"]]?.perServing) ?? null]));

/* ---------------- engines ---------------- */
/** Gray images as PNG; colour images as JPEG (q92), matching what the browser client uploads. */
async function toPng(g: Gray | RGBA): Promise<Buffer> {
  const img = sharp(Buffer.from(g.data), { raw: { width: g.width, height: g.height, channels: isRGBA(g) ? 4 : 1 } });
  return isRGBA(g) ? img.removeAlpha().jpeg({ quality: 92 }).toBuffer() : img.png().toBuffer();
}
let worker: Worker;
async function tesseract(g: Gray | RGBA): Promise<{ lines: OcrLine[]; text: string; ms: number }> {
  const t = Date.now();
  const { data } = await worker.recognize(await toPng(g));
  const lines = (data.lines || []).map((l) => ({ text: l.text.trim(), conf: l.confidence }));
  return { lines, text: data.text, ms: Date.now() - t };
}
const tesseractEngine: OcrEngine = { id: "tesseract", label: "Tesseract 5 (on-device)", remote: false, variants: "all", recognize: tesseract };
const rapidEngine: OcrEngine = {
  id: "rapidocr", label: "RapidOCR / PaddleOCR (server)", remote: true, variants: "base-only",
  async recognize(g) {
    const t = Date.now();
    const res = await fetch(`${SERVER}/ocr`, { method: "POST", body: new Uint8Array(await toPng(g)), headers: { "Content-Type": isRGBA(g) ? "image/jpeg" : "image/png", "X-OCR-Token": process.env.OCR_SERVICE_TOKEN || "" } });
    if (!res.ok) throw new Error(`OCR service ${res.status}`);
    const j = (await res.json()) as { lines: OcrLine[] };
    return { lines: j.lines, ms: Date.now() - t };
  },
};

/** v1 preprocessing, ported from the prototype: 2% contrast stretch, upscale only below 1000 px. */
function v1prep(img: RGBA): Gray {
  let g = toGray(img);
  const long = Math.max(g.width, g.height);
  const scale = long < 1000 ? Math.min(2.5, 1500 / long) : Math.min(1, 2600 / long);
  if (scale > 1) g = resizeGray(g, g.width * scale, g.height * scale);
  else if (scale < 1) g = downscaleGray(g, 2600);
  const hist = new Uint32Array(256);
  for (const v of g.data) hist[v]++;
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > g.data.length * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > g.data.length * 0.02) { hi = i; break; } }
  const r = Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = ((g.data[i] - lo) * 255) / r;
  return { ...g, data: out };
}

async function load(file: string): Promise<RGBA> {
  const { data, info } = await sharp(path.join(ROOT, "bench/images", file)).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}

type Row = { file: string; product: string; condition: string; scores: Record<string, Score>; detail: Record<string, string> };

async function main() {
  const labels = gt.filter((g) => !only || g.file.includes(only));
  let serverOk = !noServer;
  if (serverOk) {
    try { serverOk = (await fetch(`${SERVER}/health`)).ok; } catch { serverOk = false; }
    if (!serverOk) console.warn(`OCR service not reachable at ${SERVER}; skipping the server engine.`);
  }
  worker = await createWorker("eng", 1, { langPath: path.join(ROOT, "public/ocr/lang"), cachePath: path.join(ROOT, ".data/tess-cache"), gzip: true });
  const rows: Row[] = [];
  for (const g of labels) {
    const img = await load(g.file);
    const row: Row = { file: g.file, product: g.product, condition: g.condition, scores: {}, detail: {} };
    process.stdout.write(`${g.product.padEnd(34)} `);

    // v1 baseline
    {
      const r = await tesseract(v1prep(img));
      const p = v1.parseLabel(r.text);
      // v1 always reported its first column; it is scored against the ground-truth basis
      const pred = Object.fromEntries(Object.keys(g.values).map((k) => [k, p.fields[k]?.value ?? null]));
      row.scores.v1 = scoreValues(g, pred, p.servingSize, r.text, r.ms);
    }
    // v2 variants, each alone (Tesseract)
    const base = basePrep(img);
    for (const v of variantsFor(base)) {
      const r = await tesseract(v.image);
      const p = parseLabel(r.lines);
      row.scores[`variant:${v.name}`] = scoreValues(g, v2values(g, p), p.servingSize, r.text, r.ms);
    }
    // v2 on-device pipeline (variant selection + early exit + auto-rotate)
    {
      const res = await ocrImage(img, tesseractEngine);
      row.scores.v2device = scoreValues(g, v2values(g, res.parsed), res.parsed.servingSize, res.text, res.ms);
      row.detail.v2device = `chose ${res.variant}; tried ${res.attempts.map((a) => `${a.variant}(${a.fields}f/${a.errors}e)`).join(", ")}`;
    }
    if (serverOk) {
      const res = await ocrImage(img, rapidEngine);
      row.scores.v2server = scoreValues(g, v2values(g, res.parsed), res.parsed.servingSize, res.text, res.ms);
      row.detail.v2server = `chose ${res.variant}; tried ${res.attempts.map((a) => `${a.variant}(${a.fields}f/${a.errors}e)`).join(", ")}`;
    }
    rows.push(row);
    console.log(Object.entries(row.scores).filter(([k]) => !k.startsWith("variant")).map(([k, s]) => `${k} ${s.fieldsCorrect}/${s.fieldsTotal}`).join("  "));
  }
  await worker.terminate();

  const systems = Array.from(new Set(rows.flatMap((r) => Object.keys(r.scores))));
  const agg = Object.fromEntries(systems.map((sys) => {
    const ss = rows.map((r) => r.scores[sys]).filter(Boolean);
    const sum = (f: (s: Score) => number) => ss.reduce((a, s) => a + f(s), 0);
    const serv = ss.filter((s) => s.servingOk != null);
    const times = ss.map((s) => s.ms).sort((a, b) => a - b);
    return [sys, {
      labels: ss.length,
      fieldAccuracy: sum((s) => s.fieldsCorrect) / sum((s) => s.fieldsTotal),
      fieldsCorrect: sum((s) => s.fieldsCorrect), fieldsTotal: sum((s) => s.fieldsTotal),
      wrongWhenRead: 1 - sum((s) => s.fieldsCorrect) / Math.max(1, sum((s) => s.fieldsPredicted)),
      unitAccuracy: sum((s) => s.unitOk) / Math.max(1, sum((s) => s.unitTotal)),
      servingAccuracy: serv.filter((s) => s.servingOk).length / Math.max(1, serv.length), servingLabels: serv.length,
      cer: sum((s) => s.cer) / ss.length, wer: sum((s) => s.wer) / ss.length,
      medianMs: times[Math.floor(times.length / 2)], totalMs: sum((s) => s.ms),
      perfectLabels: ss.filter((s) => s.fieldsCorrect === s.fieldsTotal).length,
    }];
  }));
  const out = { runAt: new Date().toISOString(), node: process.version, server: serverOk ? SERVER : null, aggregate: agg, rows };
  fs.writeFileSync(path.join(ROOT, "bench/results.json"), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(ROOT, "bench/RESULTS.md"), report(out));
  console.log("\n" + report(out).split("## Per label")[0]);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
function report(o: { runAt: string; node: string; server: string | null; aggregate: Record<string, Record<string, number>>; rows: Row[] }) {
  const names: Record<string, string> = {
    v1: "v1 prototype (Tesseract, 2% stretch, v1 parser)",
    v2device: "v2 on-device (Tesseract, variant selection, v2 parser)",
    v2server: "v2 server (RapidOCR / PaddleOCR models, v2 parser)",
    "variant:base": "  variant: base (gray + resize + stretch)",
    "variant:inverted": "  variant: inverted",
    "variant:adaptive": "  variant: median + adaptive threshold",
    "variant:sharpened": "  variant: unsharp mask",
  };
  const order = ["v1", "v2device", "v2server", "variant:base", "variant:inverted", "variant:adaptive", "variant:sharpened"].filter((k) => o.aggregate[k]);
  let md = `# OCR benchmark results\n\nGenerated by \`npm run bench:ocr\` on ${o.runAt} (Node ${o.node}). ${o.server ? `Server engine at ${o.server}.` : "Server engine not run."}\n\n`;
  md += `${o.rows.filter((r) => !r.file.startsWith("sample")).length} real Indian packaged-food label photos (Open Food Facts, CC BY-SA) plus one synthetic label; ground truth was transcribed by hand from each photo (bench/ground-truth.json). Field accuracy counts a nutrient as correct only if the value read for the label's main column matches the printed value (±0.5%, or ±0.05 for small numbers).\n\n`;
  md += `| System | Field accuracy | Labels fully correct | Wrong when a value was read | Unit/scale correct (energy, sodium) | Serving size correct | CER | WER | Median time / label |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const k of order) {
    const a = o.aggregate[k];
    md += `| ${names[k] ?? k} | ${pct(a.fieldAccuracy)} (${a.fieldsCorrect}/${a.fieldsTotal}) | ${a.perfectLabels}/${a.labels} | ${pct(a.wrongWhenRead)} | ${pct(a.unitAccuracy)} | ${pct(a.servingAccuracy)} (${a.servingLabels} labels) | ${pct(a.cer)} | ${pct(a.wer)} | ${(a.medianMs / 1000).toFixed(1)} s |\n`;
  }
  md += `\nCER/WER are line-matched: each ground-truth table line is compared with the closest OCR output line (Levenshtein distance), so text outside the nutrition table does not count against an engine. Times are wall-clock on the benchmark machine (CPU only); the v2 pipelines may run several OCR passes per label.\n\n## Per label\n\n`;
  for (const r of o.rows) {
    md += `### ${r.product}\n*${r.condition}* — \`${r.file}\`\n\n| System | Fields correct | Misses / errors |\n|---|---|---|\n`;
    for (const k of ["v1", "v2device", "v2server"]) {
      const s = r.scores[k];
      if (s) md += `| ${k} | ${s.fieldsCorrect}/${s.fieldsTotal} | ${s.wrong.join("; ") || "—"} |\n`;
    }
    if (r.detail.v2device) md += `\nOn-device pipeline: ${r.detail.v2device}\n`;
    if (r.detail.v2server) md += `\nServer pipeline: ${r.detail.v2server}\n`;
    md += "\n";
  }
  return md;
}

main().catch((e) => { console.error(e); process.exit(1); });
