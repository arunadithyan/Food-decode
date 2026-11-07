/*
 * Reference values used by FoodDecode. Every number here is documented in docs/REFERENCE-VALUES.md.
 * These are GENERAL-POPULATION references for labelling and education. They are not medical targets
 * for any condition. Condition-specific limits come only from values the user enters as clinician advice.
 */
import type { NutrientKey, Unit } from "../types";

export interface DailyReference {
  value: number;
  unit: "kcal" | "g" | "mg";
  source: string;
}

/** FSSAI (Labelling & Display) Regulations 2020 reference values used for %RDA on Indian labels (2,000 kcal adult). */
export const DAILY_REFERENCE: Partial<Record<NutrientKey, DailyReference>> = {
  energyKcal: { value: 2000, unit: "kcal", source: "FSSAI labelling reference, 2,000 kcal/day" },
  totalFatG: { value: 67, unit: "g", source: "FSSAI labelling reference, 67 g/day" },
  saturatedFatG: { value: 22, unit: "g", source: "FSSAI labelling reference, 22 g/day" },
  transFatG: { value: 2, unit: "g", source: "FSSAI labelling reference, 2 g/day" },
  addedSugarG: { value: 50, unit: "g", source: "FSSAI labelling reference for added sugar, 50 g/day" },
  sodiumMg: { value: 2000, unit: "mg", source: "FSSAI labelling reference, 2,000 mg/day" },
  proteinG: { value: 50, unit: "g", source: "≈50 g adult reference (ICMR-NIN 2020 RDA ≈ 46–54 g)" },
  fibreG: { value: 30, unit: "g", source: "30 g/day reference" },
};

/**
 * "Substantial contribution" convention for one portion: ≥20% of the daily reference is "high",
 * ≤5% is "low" (the US FDA %Daily Value 5/20 rule, applied here to FSSAI reference values).
 */
export const PORTION_HIGH_SHARE = 0.2;
export const PORTION_LOW_SHARE = 0.05;

/** UK Food Standards Agency front-of-pack criteria per 100 g (foods) / 100 ml (drinks). [low ≤ a, high > b] */
export const PER100_BANDS: Record<Unit, Partial<Record<NutrientKey, [number, number]>>> = {
  g: { sugarsG: [5, 22.5], totalFatG: [3, 17.5], saturatedFatG: [1.5, 5], sodiumMg: [120, 600] },
  ml: { sugarsG: [2.5, 11.25], totalFatG: [1.5, 8.75], saturatedFatG: [0.75, 2.5], sodiumMg: [120, 300] },
};
export const PER100_BAND_SOURCE = "UK FSA front-of-pack criteria (used as an explicit framework until FSSAI's thresholds are final)";

/** Codex/FSSAI claim-style thresholds for "source of" and "high in" (per 100 g / 100 ml). */
export const GOOD_THRESHOLDS: Record<Unit, Partial<Record<NutrientKey, [number, number]>>> = {
  g: { proteinG: [5, 10], fibreG: [3, 6] },
  ml: { proteinG: [2.5, 5], fibreG: [1.5, 3] },
};

/** Salt ↔ sodium: salt (NaCl) is ~39.3% sodium; labels conventionally use salt = sodium × 2.5. */
export const SALT_PER_SODIUM = 2.5;
export const sodiumMgToSaltG = (mg: number) => (mg * SALT_PER_SODIUM) / 1000;
export const saltGToSodiumMg = (g: number) => (g * 1000) / SALT_PER_SODIUM;

/** Atwater factors used for the energy consistency check. */
export const ATWATER = { carb: 4, protein: 4, fat: 9, fibre: 2 };
