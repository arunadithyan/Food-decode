/*
 * Personalised alternatives. Only real products from the FoodDecode database are suggested — never
 * invented ones. Allergy and diet compatibility come first, then improvement on the nutrients that
 * triggered the original NO/CAUTION, all at the same portion size.
 */
import { forPortion, unitOf } from "../nutrition/calc";
import type { HealthProfile } from "../profile";
import type { NutrientKey, Product } from "../types";
import { assess, type Assessment } from "./suitability";

export interface Alternative {
  product: Product;
  assessment: Assessment;
  amount: number;
  /** relative improvement on the triggering nutrients (positive = better) */
  improvements: { key: NutrientKey; from: number; to: number }[];
}

const RANK = { YES: 0, CAUTION: 1, NO: 2 } as const;
const HIGHER_IS_BETTER: NutrientKey[] = ["proteinG", "fibreG"];

export function triggeringNutrients(a: Assessment): NutrientKey[] {
  const out = new Set<NutrientKey>();
  for (const f of a.findings) if ((f.level === "NO" || f.level === "CAUTION") && f.nutrients) f.nutrients.forEach((k) => out.add(k));
  return [...out];
}

export function findAlternatives(product: Product, profile: HealthProfile, amount: number, catalogue: Product[], max = 3): Alternative[] {
  const current = assess(product, profile, amount);
  if (current.status === "YES") return [];
  const unit = unitOf(product);
  const triggers = triggeringNutrients(current);
  const blockedByIngredients = current.findings.some((f) => (f.level === "NO" || f.level === "CAUTION") && f.priority <= 2);

  const out: (Alternative & { score: number })[] = [];
  for (const c of catalogue) {
    if (c.id === product.id || c.category !== product.category || unitOf(c) !== unit) continue;
    if (c.provenance === "illustrative") continue;
    const a = assess(c, profile, amount);
    if (a.status === "NO") continue;
    if (RANK[a.status] > RANK[current.status]) continue;
    // never suggest something that is uncertain on the same allergen/diet grounds
    if (blockedByIngredients && a.findings.some((f) => (f.level === "NO" || f.level === "CAUTION") && f.priority <= 2)) continue;
    const pa = forPortion(product.nutrition, amount);
    const pc = forPortion(c.nutrition, amount);
    const improvements: Alternative["improvements"] = [];
    let score = (2 - RANK[a.status]) * 100;
    let worse = false;
    for (const k of triggers) {
      const from = pa[k], to = pc[k];
      if (from == null || to == null) continue;
      const better = HIGHER_IS_BETTER.includes(k) ? to > from : to < from;
      const rel = from === 0 ? (to === 0 ? 0 : -1) : Math.abs(to - from) / Math.max(from, 1e-9);
      if (better && rel >= 0.15) {
        improvements.push({ key: k, from, to });
        score += rel * 50;
      } else if (!better && rel >= 0.05) worse = true;
    }
    if (triggers.length && !blockedByIngredients && !improvements.length) continue;
    if (worse && a.status !== "YES") continue;
    score -= a.findings.filter((f) => f.level === "CAUTION").length * 5;
    out.push({ product: c, assessment: a, amount, improvements, score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, max).map(({ score: _s, ...rest }) => rest);
}
