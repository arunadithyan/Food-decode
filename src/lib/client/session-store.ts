/*
 * In-memory store for this browser tab: products read by OCR in this session and the OCR draft being
 * reviewed. Nothing here is written to localStorage. Scans are only kept on the server if the user has
 * switched scan history on.
 */
import type { Product } from "../types";
import type { LabelDraft, Issue } from "../ocr/validate";
import type { ParsedLabel } from "../ocr/parser";

export interface PendingReview {
  draft: LabelDraft;
  parsed: ParsedLabel;
  text: string;
  engine: string;
  variant: string;
  ms: number;
  qualityWarnings: string[];
  photoUrls: string[];
  illustrative: boolean;
}

const products = new Map<string, Product>();
let pending: PendingReview | null = null;
const listeners = new Set<() => void>();

export const sessionStore = {
  putProduct(p: Product) { products.set(p.id, p); listeners.forEach((l) => l()); },
  getProduct(id: string) { return products.get(id) || null; },
  listProducts() { return [...products.values()]; },
  setPending(r: PendingReview | null) { if (pending) pending.photoUrls.forEach((u) => URL.revokeObjectURL(u)); pending = r; },
  getPending() { return pending; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
export type { Issue };
