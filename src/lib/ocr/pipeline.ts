/*
 * OCR pipeline, engine-agnostic. The same code drives on-device Tesseract in the browser, the self-hosted
 * RapidOCR (PaddleOCR models) service, and the Node benchmark.
 *
 *   photo → (user crop / rotate / perspective) → quality check → base preprocessing
 *         → try preprocessing variants, best-first, with early exit → parse → validate → score → best result
 */
import { basePrep, colorPrep, rotateGray, variantsFor, type Gray, type RGBA, type VariantName } from "./image";
import { assessQuality, type QualityReport } from "./quality";
import { fieldCount, parseLabel, FIELD_KEYS, type OcrLine, type ParsedLabel } from "./parser";
import { draftFromParsed, validateDraft } from "./validate";

export interface EngineResult { lines: OcrLine[]; ms: number }
export interface OcrEngine {
  id: "tesseract" | "rapidocr" | "google-vision" | string;
  label: string;
  /** whether images leave the device */
  remote: boolean;
  /** engines that do their own binarisation (deep-learning detectors) should get only the base image */
  variants: "all" | "base-only";
  /** receives a 1-channel (Gray) or 4-channel (RGBA) image; use isRGBA() to tell them apart */
  recognize(img: Gray | RGBA): Promise<EngineResult>;
}

export interface Attempt { variant: VariantName | `rot${number}`; fields: number; errors: number; meanConf: number | null; score: number; ms: number }
export interface ImageOcrResult {
  parsed: ParsedLabel;
  text: string;
  quality: QualityReport;
  variant: string;
  attempts: Attempt[];
  ms: number;
}

export function scoreParsed(p: ParsedLabel): { score: number; fields: number; errors: number } {
  const fields = fieldCount(p);
  const issues = validateDraft(draftFromParsed(p, { name: "x", ingredientsText: "x" }));
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning" && !i.id.startsWith("missing-")).length;
  const extras = (p.servingSize ? 1 : 0) + (p.basisDetected ? 1 : 0) + (p.ingredientsText ? 1 : 0);
  const conf = p.meanConf ?? 70;
  return { score: fields * 10 + extras * 3 - errors * 6 - warnings * 2 + conf / 20, fields, errors };
}

export interface PipelineOptions {
  /** stop trying variants once a result has at least this many fields and no validation errors */
  goodEnoughFields?: number;
  onProgress?: (stage: string) => void;
  /** try 90°/270° rotations if the best result is very poor */
  autoRotate?: boolean;
}

export async function ocrImage(rgba: RGBA, engine: OcrEngine, opts: PipelineOptions = {}): Promise<ImageOcrResult> {
  const t0 = Date.now();
  const goodEnough = opts.goodEnoughFields ?? 7;
  opts.onProgress?.("Checking photo quality");
  const base = basePrep(rgba);
  const quality = assessQuality(base);
  const variants: { name: VariantName; image: Gray | RGBA }[] =
    engine.variants === "base-only"
      ? [{ name: "color", image: colorPrep(rgba) }, ...variantsFor(base).filter((v) => v.name === "base" || v.name === "inverted")]
      : variantsFor(base);
  const attempts: Attempt[] = [];
  let best: { parsed: ParsedLabel; text: string; variant: string; score: number; fields: number; errors: number } | null = null;

  const run = async (name: Attempt["variant"], img: Gray | RGBA) => {
    opts.onProgress?.(`Reading text (${name})`);
    const r = await engine.recognize(img);
    const parsed = parseLabel(r.lines);
    const s = scoreParsed(parsed);
    attempts.push({ variant: name, fields: s.fields, errors: s.errors, meanConf: parsed.meanConf, score: Math.round(s.score * 10) / 10, ms: r.ms });
    if (!best || s.score > best.score) best = { parsed, text: r.lines.map((l) => l.text).join("\n"), variant: name, ...s };
    return s;
  };

  for (const v of variants) {
    const s = await run(v.name, v.image);
    if (s.fields >= goodEnough && s.errors === 0) break;
  }
  if (opts.autoRotate !== false && best && (best as { fields: number }).fields < 3) {
    for (const deg of [90, 270, 180] as const) {
      const s = await run(`rot${deg}`, rotateGray(base, deg));
      if (s.fields >= 3) break;
    }
  }
  const b = best as unknown as { parsed: ParsedLabel; text: string; variant: string };
  return { parsed: b.parsed, text: b.text, quality, variant: b.variant, attempts, ms: Date.now() - t0 };
}

/**
 * Merge results from several photos of one pack (e.g. nutrition table + ingredients side).
 * For each field the reading from the higher-scoring photo wins; nothing is averaged or invented.
 */
export function mergeParsed(results: ParsedLabel[]): ParsedLabel {
  if (results.length === 1) return results[0];
  const ranked = [...results].sort((a, b) => scoreParsed(b).score - scoreParsed(a).score);
  const out: ParsedLabel = { ...ranked[0], fields: { ...ranked[0].fields } };
  for (const r of ranked.slice(1)) {
    for (const k of FIELD_KEYS) if (!out.fields[k] && r.fields[k]) out.fields[k] = r.fields[k];
    out.servingSize ??= r.servingSize;
    out.servingUnit ??= r.servingUnit;
    out.servingsPerPack ??= r.servingsPerPack;
    out.packSize ??= r.packSize;
    out.packUnit ??= r.packUnit;
    out.unit ??= r.unit;
    if (!out.ingredientsText || (r.ingredientsText && r.ingredientsText.length > out.ingredientsText.length)) out.ingredientsText = r.ingredientsText ?? out.ingredientsText;
    if (r.allergenStatement && !out.allergenStatement?.includes(r.allergenStatement)) out.allergenStatement = [out.allergenStatement, r.allergenStatement].filter(Boolean).join(" ");
  }
  out.insCodes = Array.from(new Set(ranked.flatMap((r) => r.insCodes)));
  out.lineCount = ranked.reduce((a, r) => a + r.lineCount, 0);
  return out;
}
