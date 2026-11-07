/* Browser-only helpers: load photos (with EXIF orientation), convert between canvas and pixel buffers. */
import { isRGBA, type Gray, type RGBA } from "../image";

export const MAX_SIDE = 2600;

export async function loadImageFile(file: Blob): Promise<RGBA> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This file could not be opened as an image. Use a JPEG, PNG or WebP photo.");
  }
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data };
}

export function toCanvas(img: Gray | RGBA): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  const id = ctx.createImageData(img.width, img.height);
  if (isRGBA(img)) id.data.set(img.data);
  else for (let i = 0, j = 0; i < img.data.length; i++, j += 4) { id.data[j] = id.data[j + 1] = id.data[j + 2] = img.data[i]; id.data[j + 3] = 255; }
  ctx.putImageData(id, 0, 0);
  return c;
}

export function rotateRGBA(img: RGBA, deg: 0 | 90 | 180 | 270): RGBA {
  if (deg === 0) return img;
  const src = toCanvas(img);
  const c = document.createElement("canvas");
  c.width = deg === 180 ? img.width : img.height;
  c.height = deg === 180 ? img.height : img.width;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -img.width / 2, -img.height / 2);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: d.data };
}

export function canvasBlob(c: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, q));
}
