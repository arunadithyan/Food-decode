/* Photo quality checks shown before OCR: blur, glare, darkness, contrast, resolution. */
import { downscaleGray, percentiles, type Gray } from "./image";

export interface QualityReport {
  blurScore: number;
  glareFraction: number;
  meanBrightness: number;
  contrast: number;
  longSide: number;
  warnings: { code: "blur" | "glare" | "dark" | "contrast" | "resolution"; message: string }[];
}

/** Thresholds were calibrated on the benchmark photos in bench/images (see docs/OCR.md). */
export function assessQuality(g: Gray): QualityReport {
  const longSide = Math.max(g.width, g.height);
  const s = downscaleGray(g, 900);
  const { width: w, height: h, data } = s;
  // variance of the Laplacian — low values mean few sharp edges (blur)
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += lap; sum2 += lap * lap; n++;
    }
  const blurScore = n ? sum2 / n - (sum / n) ** 2 : 0;
  let bright = 0, total = 0;
  for (let i = 0; i < data.length; i++) { total += data[i]; if (data[i] >= 250) bright++; }
  const glareFraction = bright / data.length;
  const meanBrightness = total / data.length;
  const [lo, hi] = percentiles(s, 0.02, 0.98);
  const contrast = hi - lo;
  const warnings: QualityReport["warnings"] = [];
  if (blurScore < 120) warnings.push({ code: "blur", message: "The photo looks blurry. Hold the phone steady and tap to focus, then retake." });
  if (glareFraction > 0.06 && meanBrightness < 200) warnings.push({ code: "glare", message: "There are bright glare spots. Tilt the pack away from the light and retake." });
  if (meanBrightness < 60) warnings.push({ code: "dark", message: "The photo is quite dark. Move to better light." });
  if (contrast < 70) warnings.push({ code: "contrast", message: "Text and background have low contrast. Text may be hard to read." });
  if (longSide < 700) warnings.push({ code: "resolution", message: "The image is small. Move closer so the table fills the frame." });
  return { blurScore, glareFraction, meanBrightness, contrast, longSide, warnings };
}
