/* Strict shape checks for user-submitted records that are stored (scan history). */
import "server-only";
import { NUTRIENT_KEYS, type Product } from "../types";
import type { ScanRecord } from "./repo";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown, max = 100000) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

export function validateProduct(v: unknown): Product | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const provenance = p.provenance;
  if (!["ocr-user-verified", "illustrative", "community", "label-photo-checked"].includes(String(provenance))) return null;
  const n = (p.nutrition || {}) as Record<string, unknown>;
  const nutrition = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(n[k], 50000)])) as Product["nutrition"];
  const s = (p.source || {}) as Record<string, unknown>;
  const id = str(p.id, 80);
  if (!id || !/^[a-z0-9-]+$/.test(id)) return null;
  return {
    id,
    barcode: str(p.barcode, 20),
    brand: str(p.brand, 120) || "Unknown brand",
    name: str(p.name, 160) || "Scanned product",
    category: str(p.category, 60) || "Scanned label",
    variant: str(p.variant, 120),
    packSize: num(p.packSize),
    servingSize: num(p.servingSize, 5000),
    unit: p.unit === "ml" ? "ml" : "g",
    servingsPerPack: num(p.servingsPerPack, 1000),
    nutrition,
    ingredientsText: str(p.ingredientsText, 4000) ?? null,
    allergenStatement: str(p.allergenStatement, 1000) ?? null,
    provenance: provenance as Product["provenance"],
    source: {
      name: str(s.name, 120) || "Unknown",
      url: typeof s.url === "string" && /^https:\/\/world\.openfoodfacts\.org\//.test(s.url) ? s.url.slice(0, 200) : undefined,
      sourceType: str(s.sourceType, 120),
      sourceDate: str(s.sourceDate, 20),
      checkedDate: str(s.checkedDate, 20),
      verificationStatus: str(s.verificationStatus, 120) || "Unverified",
      notes: str(s.notes, 600),
    },
    unresolvedIssues: Array.isArray(p.unresolvedIssues) ? p.unresolvedIssues.slice(0, 20).map((x) => String(x).slice(0, 300)) : undefined,
  };
}

export function validateScanInput(v: unknown): Omit<ScanRecord, "id" | "createdAt"> | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const kind = b.kind === "ocr" ? "ocr" : b.kind === "lookup" ? "lookup" : null;
  if (!kind) return null;
  const amount = num(b.amount, 5000) ?? undefined;
  if (kind === "lookup") {
    const productId = str(b.productId, 80);
    if (!productId || !/^[a-z0-9-]+$/.test(productId)) return null;
    const product = b.product ? validateProduct(b.product) ?? undefined : undefined;
    return { kind, productId, product, amount };
  }
  const product = validateProduct(b.product);
  if (!product) return null;
  return { kind, productId: product.id, product, amount };
}
