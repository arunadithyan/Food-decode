/*
 * Open Food Facts integration (server side only): barcode lookup, text search, caching, attribution.
 * OFF data is a community record. FoodDecode labels it as such everywhere and never treats it as
 * medically verified; the suitability engine lowers its confidence for community data.
 */
import "server-only";
import { emptyNutrition, type Nutrition, type Product } from "../types";
import { getDb } from "./db";

const API = "https://world.openfoodfacts.org/api/v2/product";
const SEARCH = "https://search.openfoodfacts.org/search";
const FIELDS = "code,product_name,product_name_en,brands,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,nutrition_data_per,nutriments,ingredients_text_en,ingredients_text,allergens_tags,traces_tags,categories_tags,image_front_small_url,image_nutrition_url,last_modified_t,countries_tags";
const TTL_FOUND = 7 * 86400_000;
const TTL_MISSING = 86400_000;

export const offEnabled = () => process.env.OFF_ENABLED !== "0";
const UA = () => process.env.OFF_USER_AGENT || "FoodDecode/2.0 (student project)";

export class OffUnavailable extends Error {}

const CATEGORY_MAP: [RegExp, string][] = [
  [/instant-noodles|noodles/, "Instant Noodles"],
  [/biscuits|cookies|crackers/, "Biscuits"],
  [/chips|crisps|namkeen|snacks|bhujia/, "Chips & Namkeen"],
  [/chocolate/, "Chocolates"],
  [/breakfast-cereals|cereals/, "Breakfast Cereals"],
  [/malt|health-drink|cocoa-and-chocolate-powders/, "Malt & Health Drinks"],
  [/sodas|soft-drinks|colas|carbonated/, "Soft Drinks"],
  [/fruit-juices|fruit-based-beverages|nectars|fruit-drinks/, "Fruit Drinks"],
  [/dairy-drinks|lassi|milk-drinks|fermented-milk/, "Dairy Drinks"],
];

interface OffProduct {
  code: string; product_name?: string; product_name_en?: string; brands?: string; quantity?: string;
  product_quantity?: number | string; product_quantity_unit?: string; serving_size?: string; serving_quantity?: number | string;
  nutrition_data_per?: string; nutriments?: Record<string, number | string>; ingredients_text_en?: string; ingredients_text?: string;
  allergens_tags?: string[]; traces_tags?: string[]; categories_tags?: string[]; image_front_small_url?: string; image_nutrition_url?: string;
  last_modified_t?: number; countries_tags?: string[];
}

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const tagWord = (t: string) => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");

export function normaliseOff(p: OffProduct, fetchedAt: string): Product {
  const n = p.nutriments || {};
  const nutrition: Nutrition = emptyNutrition();
  const notes: string[] = [];
  nutrition.energyKcal = numOrNull(n["energy-kcal_100g"]);
  if (nutrition.energyKcal == null && numOrNull(n["energy_100g"]) != null) {
    nutrition.energyKcal = Math.round((numOrNull(n["energy_100g"])! / 4.184) * 10) / 10;
    notes.push("Energy converted from kJ.");
  }
  nutrition.carbohydratesG = numOrNull(n["carbohydrates_100g"]);
  nutrition.sugarsG = numOrNull(n["sugars_100g"]);
  nutrition.addedSugarG = numOrNull(n["added-sugars_100g"]);
  nutrition.proteinG = numOrNull(n["proteins_100g"]);
  nutrition.totalFatG = numOrNull(n["fat_100g"]);
  nutrition.saturatedFatG = numOrNull(n["saturated-fat_100g"]);
  nutrition.transFatG = numOrNull(n["trans-fat_100g"]);
  const sodiumG = numOrNull(n["sodium_100g"]);
  nutrition.sodiumMg = sodiumG == null ? null : Math.round(sodiumG * 1000 * 10) / 10;
  nutrition.fibreG = numOrNull(n["fiber_100g"]);
  const unitHint = `${p.nutrition_data_per || ""} ${p.product_quantity_unit || ""} ${p.quantity || ""}`.toLowerCase();
  const unit = /ml|\bl\b|litre|liter/.test(unitHint) ? "ml" : "g";
  const cats = (p.categories_tags || []).join(" ");
  const category = CATEGORY_MAP.find(([re]) => re.test(cats))?.[1] ?? "Other packaged foods";
  const allergens = (p.allergens_tags || []).map(tagWord);
  const traces = (p.traces_tags || []).map(tagWord);
  const stmt = [allergens.length ? `Contains: ${allergens.join(", ")}.` : "", traces.length ? `May contain: ${traces.join(", ")}.` : ""].filter(Boolean).join(" ");
  const missing = (Object.keys(nutrition) as (keyof Nutrition)[]).filter((k) => nutrition[k] == null);
  if (missing.length) notes.push(`Not in the community record: ${missing.length} nutrition value(s).`);
  return {
    id: `off-${p.code}`,
    barcode: p.code,
    brand: (p.brands || "").split(",")[0].trim() || "Unknown brand",
    name: (p.product_name_en || p.product_name || "").trim() || `Product ${p.code}`,
    category,
    market: (p.countries_tags || []).includes("en:india") ? "India" : undefined,
    packSize: numOrNull(p.product_quantity),
    servingSize: numOrNull(p.serving_quantity),
    unit,
    servingsPerPack: null,
    nutrition,
    ingredientsText: (p.ingredients_text_en || p.ingredients_text || "").trim() || null,
    allergenStatement: stmt || null,
    provenance: "community",
    source: {
      name: "Open Food Facts",
      url: `https://world.openfoodfacts.org/product/${p.code}`,
      sourceType: "Crowdsourced label transcription (Open Food Facts, ODbL)",
      sourceDate: p.last_modified_t ? new Date(p.last_modified_t * 1000).toISOString().slice(0, 10) : undefined,
      checkedDate: fetchedAt.slice(0, 10),
      verificationStatus: "Community record — not verified by FoodDecode",
      notes: [...notes, "Allergen tags are the community's reading of the label; check the pack."].join(" "),
      labelImageUrl: p.image_nutrition_url,
    },
  };
}

async function offFetch(url: string): Promise<Response> {
  if (!offEnabled()) throw new OffUnavailable("Open Food Facts lookups are disabled");
  try {
    return await fetch(url, { headers: { "User-Agent": UA(), Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new OffUnavailable("Open Food Facts could not be reached");
  }
}

/** Barcode lookup with a 7-day cache (1 day for "not found"). Returns null when OFF has no record. */
export async function lookupBarcode(code: string): Promise<{ product: Product | null; cached: boolean; fetchedAt: string }> {
  if (!/^\d{6,14}$/.test(code)) return { product: null, cached: false, fetchedAt: new Date().toISOString() };
  const db = getDb();
  const row = db.prepare("SELECT data, fetched_at FROM product_cache WHERE barcode = ?").get(code) as { data: string; fetched_at: string } | undefined;
  if (row) {
    const age = Date.now() - new Date(row.fetched_at).getTime();
    const data = JSON.parse(row.data) as Product | null;
    if (age < (data ? TTL_FOUND : TTL_MISSING)) return { product: data, cached: true, fetchedAt: row.fetched_at };
  }
  let res: Response;
  try {
    res = await offFetch(`${API}/${code}.json?fields=${FIELDS}`);
  } catch (e) {
    if (row) return { product: JSON.parse(row.data), cached: true, fetchedAt: row.fetched_at }; // stale is better than nothing
    throw e;
  }
  const fetchedAt = new Date().toISOString();
  let product: Product | null = null;
  if (res.ok) {
    const j = (await res.json()) as { status?: number; product?: OffProduct };
    if (j.product && j.status !== 0) product = normaliseOff({ ...j.product, code }, fetchedAt);
  } else if (res.status !== 404) {
    throw new OffUnavailable(`Open Food Facts returned ${res.status}`);
  }
  db.prepare("INSERT INTO product_cache (barcode, data, source, fetched_at) VALUES (?, ?, 'openfoodfacts', ?) ON CONFLICT(barcode) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at")
    .run(code, JSON.stringify(product), fetchedAt);
  return { product, cached: false, fetchedAt };
}

export interface OffHit { barcode: string; name: string; brand: string; image?: string; india: boolean }

export async function searchOff(q: string): Promise<OffHit[]> {
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&page_size=24&fields=code,product_name,product_name_en,brands,image_front_small_url,countries_tags`;
  const res = await offFetch(url);
  if (!res.ok) throw new OffUnavailable(`Open Food Facts search returned ${res.status}`);
  const j = (await res.json()) as { hits?: (Omit<OffProduct, "brands"> & { brands?: string[] | string })[] };
  return (j.hits || [])
    .filter((h) => h.code && (h.product_name_en || h.product_name))
    .map((h) => ({
      barcode: h.code,
      name: (h.product_name_en || h.product_name || "").trim(),
      brand: (Array.isArray(h.brands) ? h.brands[0] : (h.brands || "").split(",")[0]) || "",
      image: h.image_front_small_url,
      india: (h.countries_tags || []).includes("en:india"),
    }))
    .sort((a, b) => Number(b.india) - Number(a.india))
    .slice(0, 12);
}
