/*
 * Image preprocessing for OCR — pure functions on raw pixel buffers, so the same code runs in the
 * browser (canvas ImageData) and in Node (benchmark via sharp). No DOM access here.
 */

export interface Gray { width: number; height: number; data: Uint8ClampedArray } // 1 byte per pixel
export interface RGBA { width: number; height: number; data: Uint8ClampedArray } // 4 bytes per pixel

export function toGray(img: RGBA): Gray {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  return { width, height, data: out };
}

export function grayToRGBA(g: Gray): RGBA {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  for (let j = 0, i = 0; j < g.data.length; j++, i += 4) {
    out[i] = out[i + 1] = out[i + 2] = g.data[j];
    out[i + 3] = 255;
  }
  return { width: g.width, height: g.height, data: out };
}

/** Bilinear resize. */
export function resizeGray(g: Gray, w: number, h: number): Gray {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const out = new Uint8ClampedArray(w * h);
  const sx = g.width / w, sy = g.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(g.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(g.height - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(g.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(g.width - 1, x0 + 1), wx = fx - x0;
      const a = g.data[y0 * g.width + x0], b = g.data[y0 * g.width + x1], c = g.data[y1 * g.width + x0], d = g.data[y1 * g.width + x1];
      out[y * w + x] = a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
    }
  }
  return { width: w, height: h, data: out };
}

/** Area-average downscale (better than bilinear for big reductions). */
export function downscaleGray(g: Gray, maxSide: number): Gray {
  const s = maxSide / Math.max(g.width, g.height);
  if (s >= 1) return g;
  const w = Math.max(1, Math.round(g.width * s)), h = Math.max(1, Math.round(g.height * s));
  const out = new Uint8ClampedArray(w * h);
  const fx = g.width / w, fy = g.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let sum = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { sum += g.data[yy * g.width + xx]; n++; }
      out[y * w + x] = sum / n;
    }
  }
  return { width: w, height: h, data: out };
}

/** Scale so the long side is OCR-friendly: upscale small images (≤2.5×), cap large ones. */
export function normaliseSize(g: Gray, target = 2000, maxSide = 2600): Gray {
  const long = Math.max(g.width, g.height);
  if (long < 1400) {
    const s = Math.min(2.5, target / long);
    return resizeGray(g, g.width * s, g.height * s);
  }
  if (long > maxSide) return downscaleGray(g, maxSide);
  return g;
}

export function percentiles(g: Gray, lo = 0.01, hi = 0.99): [number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const total = g.data.length;
  let acc = 0, a = 0, b = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * lo) { a = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * (1 - hi)) { b = i; break; } }
  return [a, b];
}

/** Linear contrast stretch between the lo/hi percentiles. */
export function stretch(g: Gray, lo = 0.01, hi = 0.99): Gray {
  const [a, b] = percentiles(g, lo, hi);
  const r = Math.max(1, b - a);
  const out = new Uint8ClampedArray(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = ((g.data[i] - a) * 255) / r;
  return { ...g, data: out };
}

export function invert(g: Gray): Gray {
  const out = new Uint8ClampedArray(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = 255 - g.data[i];
  return { ...g, data: out };
}

export function mean(g: Gray): number {
  let s = 0;
  for (let i = 0; i < g.data.length; i++) s += g.data[i];
  return s / g.data.length;
}

/** 3×3 box blur (used by unsharp mask and noise reduction). */
function blur3(g: Gray): Gray {
  const { width: w, height: h, data } = g;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += data[yy * w + xx]; n++;
        }
      }
      out[y * w + x] = s / n;
    }
  return { ...g, data: out };
}

export function unsharp(g: Gray, amount = 0.8): Gray {
  const b = blur3(g);
  const out = new Uint8ClampedArray(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = g.data[i] + amount * (g.data[i] - b.data[i]);
  return { ...g, data: out };
}

/** 3×3 median filter — removes salt-and-pepper noise and fine print texture. */
export function median3(g: Gray): Gray {
  const { width: w, height: h, data } = g;
  const out = new Uint8ClampedArray(data.length);
  const win = new Uint8Array(9);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, x + dx));
        win[n++] = data[yy * w + xx];
      }
      win.sort();
      out[y * w + x] = win[4];
    }
  return { ...g, data: out };
}

/** Bradley–Roth adaptive threshold using an integral image. Handles uneven lighting and coloured bands. */
export function adaptiveThreshold(g: Gray, windowFrac = 1 / 24, t = 0.15): Gray {
  const { width: w, height: h, data } = g;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += data[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + row;
    }
  }
  const r = Math.max(8, Math.round((w * windowFrac) / 2));
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * (w + 1) + (x1 + 1)] - integral[y0 * (w + 1) + (x1 + 1)] - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      out[y * w + x] = data[y * w + x] * count < sum * (1 - t) ? 0 : 255;
    }
  }
  return { ...g, data: out };
}

/** True when the image is mostly light text on a dark background. */
export function looksInverted(g: Gray): boolean {
  const small = downscaleGray(g, 400);
  const [a, b] = percentiles(small, 0.05, 0.95);
  const mid = (a + b) / 2;
  let dark = 0;
  for (let i = 0; i < small.data.length; i++) if (small.data[i] < mid) dark++;
  return dark / small.data.length > 0.6;
}

export function rotateGray(g: Gray, deg: 0 | 90 | 180 | 270): Gray {
  if (deg === 0) return g;
  const { width: w, height: h, data } = g;
  const nw = deg === 180 ? w : h, nh = deg === 180 ? h : w;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let nx: number, ny: number;
      if (deg === 90) { nx = h - 1 - y; ny = x; }
      else if (deg === 180) { nx = w - 1 - x; ny = h - 1 - y; }
      else { nx = y; ny = w - 1 - x; }
      out[ny * nw + nx] = data[y * w + x];
    }
  return { width: nw, height: nh, data: out };
}

/* ---------------- perspective correction ---------------- */
export interface Pt { x: number; y: number }

/** Solve the 3×3 homography mapping 4 source points to 4 destination points (h33 = 1). */
export function homography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error("Corner points are degenerate");
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = new Array(8).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * h[k];
    h[r] = s / A[r][r];
  }
  return [...h, 1];
}

export function applyH(H: number[], p: Pt): Pt {
  const d = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / d, y: (H[3] * p.x + H[4] * p.y + H[5]) / d };
}

/**
 * Warp the quadrilateral `corners` (top-left, top-right, bottom-right, bottom-left) of an RGBA image to a
 * flat rectangle, sized from the average edge lengths.
 */
export function warpPerspective(img: RGBA, corners: Pt[]): RGBA {
  const [tl, tr, br, bl] = corners;
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const W = Math.max(10, Math.round((dist(tl, tr) + dist(bl, br)) / 2));
  const Hh = Math.max(10, Math.round((dist(tl, bl) + dist(tr, br)) / 2));
  // map destination → source (inverse mapping)
  const Hm = homography([{ x: 0, y: 0 }, { x: W - 1, y: 0 }, { x: W - 1, y: Hh - 1 }, { x: 0, y: Hh - 1 }], corners);
  const out = new Uint8ClampedArray(W * Hh * 4);
  const { width: sw, height: sh, data } = img;
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const s = applyH(Hm, { x, y });
      const x0 = Math.floor(s.x), y0 = Math.floor(s.y);
      const o = (y * W + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 255; continue; }
      const wx = s.x - x0, wy = s.y - y0;
      for (let c = 0; c < 4; c++) {
        const a = data[(y0 * sw + x0) * 4 + c], b = data[(y0 * sw + x0 + 1) * 4 + c], cc = data[((y0 + 1) * sw + x0) * 4 + c], d = data[((y0 + 1) * sw + x0 + 1) * 4 + c];
        out[o + c] = a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + cc * (1 - wx) * wy + d * wx * wy;
      }
    }
  return { width: W, height: Hh, data: out };
}

/** Colour copy, long side capped (deep-learning OCR engines do better with the original colours). */
export function colorPrep(img: RGBA, maxSide = 2200): RGBA {
  const s = maxSide / Math.max(img.width, img.height);
  if (s >= 1) return img;
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const out = new Uint8ClampedArray(w * h * 4);
  const fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.width + xx) * 4; acc[0] += img.data[i]; acc[1] += img.data[i + 1]; acc[2] += img.data[i + 2]; acc[3] += img.data[i + 3]; n++; }
      const o = (y * w + x) * 4;
      out[o] = acc[0] / n; out[o + 1] = acc[1] / n; out[o + 2] = acc[2] / n; out[o + 3] = acc[3] / n;
    }
  }
  return { width: w, height: h, data: out };
}
export const isRGBA = (img: Gray | RGBA) => img.data.length === img.width * img.height * 4;

/* ---------------- variants ---------------- */
export type VariantName = "color" | "base" | "sharpened" | "inverted" | "adaptive";
export interface Variant { name: VariantName; image: Gray; description: string }

/** Base preprocessing shared by all variants: grayscale → size normalisation → contrast stretch. */
export function basePrep(img: RGBA): Gray {
  return stretch(normaliseSize(toGray(img)));
}

/** Candidate preprocessings, in the order the pipeline tries them. */
export function variantsFor(base: Gray): Variant[] {
  const inv = looksInverted(base);
  const v: Variant[] = [{ name: "base", image: base, description: "Grayscale, resized, contrast-stretched" }];
  if (inv) v.push({ name: "inverted", image: invert(base), description: "Inverted (light text on dark background)" });
  v.push({ name: "adaptive", image: adaptiveThreshold(median3(inv ? invert(base) : base)), description: "Noise-reduced + adaptive threshold (uneven light, coloured bands)" });
  v.push({ name: "sharpened", image: unsharp(inv ? invert(base) : base), description: "Sharpened (soft or slightly blurred photos)" });
  return v;
}
