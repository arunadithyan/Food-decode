/* Bundled product catalogue (works offline) + search. */
import raw from "./data/products.json";
import type { Product } from "./types";

export const PRODUCTS: Product[] = (raw as unknown as Product[]).map((p) => ({ ...p, unit: p.unit === "ml" ? "ml" : "g" }));
export const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))];

export const getLocalProduct = (id: string) => PRODUCTS.find((p) => p.id === id) || null;
export const getByBarcode = (code: string) => PRODUCTS.find((p) => p.barcode === code) || null;

export const norm = (s: string) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[’'`!]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function searchLocal(q: string, cat = ""): Product[] {
  const terms = norm(q).split(" ").filter(Boolean);
  return PRODUCTS.map((p) => {
    if (cat && p.category !== cat) return null;
    const hay = norm([p.name, p.brand, p.category, p.variant, p.barcode].join(" "));
    if (!terms.length) return { p, s: 0 };
    let s = 0;
    for (const t of terms) {
      if (hay.includes(t)) s += norm(p.name).includes(t) ? 3 : 2;
      else if (t.length > 3 && hay.split(" ").some((w) => w.startsWith(t.slice(0, -1)))) s += 1;
      else return null;
    }
    return { p, s };
  })
    .filter((x): x is { p: Product; s: number } => !!x)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

export const PROVENANCE_LABEL: Record<Product["provenance"], { short: string; long: string }> = {
  "label-photo-checked": { short: "Label-photo checked", long: "Community record checked by FoodDecode against a photo of the printed label" },
  community: { short: "Community data", long: "Open Food Facts community record, checked only for internal consistency" },
  "ocr-user-verified": { short: "Your scan (verified by you)", long: "Read from your photo by OCR and confirmed or corrected by you" },
  illustrative: { short: "Illustrative demo", long: "Fictional data for demonstration only" },
};
