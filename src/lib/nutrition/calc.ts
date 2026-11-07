/* Portion maths and general (non-personal) nutrient interpretation. Pure functions, no UI. */
import { NUTRIENT_KEYS, type Nutrition, type NutrientKey, type Product, type Unit } from "../types";
import { ATWATER, DAILY_REFERENCE, GOOD_THRESHOLDS, PER100_BANDS, PORTION_HIGH_SHARE, PORTION_LOW_SHARE } from "./reference";

export const unitOf = (p: Pick<Product, "unit">): Unit => (p.unit === "ml" ? "ml" : "g");

/** Nutrient amounts for a portion of `amount` g/ml, scaled from per-100 values. Missing stays missing. */
export function forPortion(n: Nutrition, amount: number): Nutrition {
  const out = {} as Nutrition;
  for (const k of NUTRIENT_KEYS) out[k] = n[k] == null ? null : (n[k]! * amount) / 100;
  return out;
}

export function servingsIn(p: Pick<Product, "servingSize">, amount: number): number | null {
  return p.servingSize ? amount / p.servingSize : null;
}

export function defaultAmount(p: Pick<Product, "servingSize" | "packSize">): number {
  if (p.servingSize) return p.servingSize;
  if (p.packSize && p.packSize <= 250) return p.packSize;
  return 100;
}

/** Quick portion presets: 1 serving, 2 servings, half pack, full pack, 100 g/ml. */
export function portionPresets(p: Pick<Product, "servingSize" | "packSize" | "unit">): { label: string; amount: number }[] {
  const u = unitOf(p);
  const out: { label: string; amount: number }[] = [];
  if (p.servingSize) {
    out.push({ label: "1 serving", amount: p.servingSize });
    out.push({ label: "2 servings", amount: p.servingSize * 2 });
  }
  if (p.packSize) {
    if (!p.servingSize || Math.abs(p.packSize / 2 - p.servingSize) > 0.5) out.push({ label: "Half pack", amount: p.packSize / 2 });
    if (!p.servingSize || Math.abs(p.packSize - p.servingSize) > 0.5) out.push({ label: "Full pack", amount: p.packSize });
  }
  out.push({ label: `100 ${u}`, amount: 100 });
  const seen = new Set<number>();
  return out.filter((o) => (seen.has(Math.round(o.amount * 10)) ? false : (seen.add(Math.round(o.amount * 10)), true)));
}

export type BandCode = "low" | "moderate" | "high";
export interface Band { code: BandCode; rule: string }

export function per100Band(key: NutrientKey, per100: number | null, unit: Unit): Band | null {
  const b = PER100_BANDS[unit][key];
  if (!b || per100 == null) return null;
  const per = unit === "ml" ? "100 ml" : "100 g";
  const f = (x: number) => (key === "sodiumMg" ? `${x} mg` : `${x} g`);
  if (per100 <= b[0]) return { code: "low", rule: `${f(b[0])} or less per ${per}` };
  if (per100 > b[1]) return { code: "high", rule: `more than ${f(b[1])} per ${per}` };
  return { code: "moderate", rule: `between ${f(b[0])} and ${f(b[1])} per ${per}` };
}

export type GoodCode = "high" | "source" | "none";
export function goodBand(key: NutrientKey, per100: number | null, unit: Unit): { code: GoodCode; rule: string } | null {
  const g = GOOD_THRESHOLDS[unit][key];
  if (!g || per100 == null) return null;
  const per = unit === "ml" ? "100 ml" : "100 g";
  if (per100 >= g[1]) return { code: "high", rule: `at least ${g[1]} g per ${per}` };
  if (per100 >= g[0]) return { code: "source", rule: `at least ${g[0]} g per ${per}` };
  return { code: "none", rule: `below ${g[0]} g per ${per}` };
}

/** Share (0–1+) of the daily reference supplied by `amount` of the nutrient. Sugar uses the added-sugar reference. */
export function shareOfReference(key: NutrientKey, amountOfNutrient: number): number | null {
  const ref = DAILY_REFERENCE[key === "sugarsG" ? "addedSugarG" : key];
  return ref ? amountOfNutrient / ref.value : null;
}

export function portionShareBand(share: number | null): BandCode | null {
  if (share == null) return null;
  if (share >= PORTION_HIGH_SHARE) return "high";
  if (share <= PORTION_LOW_SHARE) return "low";
  return "moderate";
}

/** Energy check: stated kcal vs 4×carb + 4×protein + 9×fat (+2×fibre). Returns null when not checkable. */
export function energyCheck(n: Nutrition): { estimate: number; deviation: number; ok: boolean } | null {
  const { carbohydratesG: c, proteinG: p, totalFatG: f, energyKcal: e } = n;
  if (c == null || p == null || f == null || e == null || e < 20) return null;
  const estimate = ATWATER.carb * c + ATWATER.protein * p + ATWATER.fat * f + (n.fibreG ? ATWATER.fibre * n.fibreG : 0);
  const deviation = Math.abs(estimate - e) / e;
  return { estimate, deviation, ok: deviation <= 0.15 };
}

export function fmt(v: number | null | undefined, dp?: number): string {
  if (v == null || Number.isNaN(v)) return "–";
  const d = dp ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : 2);
  return Number(v.toFixed(d)).toLocaleString("en-IN", { maximumFractionDigits: d });
}
